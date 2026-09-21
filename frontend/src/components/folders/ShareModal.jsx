import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Plus, Loader2, Globe, Lock } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function ShareModal({ isOpen, onClose, folderId }) {
  const [accessList, setAccessList] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [isUpdating, setIsUpdating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    if (isOpen && folderId) {
      fetchAccess();
    }
  }, [isOpen, folderId]);

  const fetchAccess = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/folders/${folderId}/access`);
      setAccessList(res.data.access || []);
      setOwnerId(res.data.owner_id);
      setIsPublic(res.data.is_public || false);
    } catch (err) {
      toast.error('Failed to load folder access');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAccess = async (targetUserId, role) => {
    setIsUpdating(true);
    try {
      await api.put(`/api/folders/${folderId}/access`, { targetUserId, role });
      toast.success('Access updated');
      fetchAccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update access');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTogglePublic = async () => {
    const newStatus = !isPublic;
    setIsUpdating(true);
    try {
      await api.put(`/api/folders/${folderId}/public`, { isPublic: newStatus });
      setIsPublic(newStatus);
      toast.success(newStatus ? 'Folder is now public' : 'Folder is now private');
    } catch (err) {
      toast.error('Failed to update public status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setNewUserEmail(val);
    setSelectedUser(null);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (val.length > 1) {
      setSearchTimeout(setTimeout(async () => {
        try {
          const res = await api.get(`/api/auth/users/search?q=${val}`);
          setSuggestions(res.data.users || []);
          setShowSuggestions(true);
        } catch (err) {
          console.error(err);
        }
      }, 300));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectUser = (user) => {
    setNewUserEmail(user.email);
    setSelectedUser(user);
    setShowSuggestions(false);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail) return;

    setIsUpdating(true);
    try {
      let targetUserId = selectedUser?.id;
      
      if (!targetUserId) {
        const res = await api.get(`/api/auth/users/search?q=${newUserEmail}`);
        const user = res.data.users.find(u => u.email === newUserEmail);
        if (user) {
          targetUserId = user.id;
        } else {
          toast.error('User not found');
          setIsUpdating(false);
          return;
        }
      }

      await api.put(`/api/folders/${folderId}/access`, { targetUserId, role: newUserRole });
      toast.success('User added');
      setNewUserEmail('');
      setSelectedUser(null);
      fetchAccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Share Folder
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              {isPublic ? <Globe className="h-4 w-4 text-indigo-600" /> : <Lock className="h-4 w-4 text-slate-500" />}
              Share with everyone
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {isPublic ? 'Anyone in the system can view this folder.' : 'Only specific people can access this folder.'}
            </div>
          </div>
          <button
            onClick={handleTogglePublic}
            disabled={isUpdating}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center justify-start px-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${isPublic ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={handleAddUser} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <input
                type="email"
                placeholder="Add people by email..."
                value={newUserEmail}
                onChange={handleEmailChange}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {suggestions.map((user) => (
                    <li 
                      key={user.id} 
                      className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-slate-500 text-xs">{user.email}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="manager">Manager</option>
            </select>
            <button
              type="submit"
              disabled={isUpdating || !newUserEmail}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">People with access</h3>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {accessList.map((access) => (
                  <div key={access.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                        {access.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                          {access.username}
                          {access.userId === ownerId && (
                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Owner
                            </span>
                          )}
                          {access.inherited && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Inherited
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{access.email}</div>
                      </div>
                    </div>
                    
                    {access.userId !== ownerId && !access.inherited && (
                      <select
                        value={access.role}
                        onChange={(e) => handleUpdateAccess(access.userId, e.target.value)}
                        disabled={isUpdating}
                        className="text-sm border-0 bg-transparent text-slate-600 font-medium focus:ring-0 cursor-pointer hover:bg-slate-50 rounded"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="manager">Manager</option>
                        <option value="remove" className="text-red-600">Remove access</option>
                      </select>
                    )}
                    {access.inherited && (
                      <div className="text-sm text-slate-400 font-medium px-2">{access.role}</div>
                    )}
                  </div>
                ))}
                
                {accessList.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">Only the owner has access.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
