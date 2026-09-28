import React, { useState, useEffect } from 'react';
import { X, Folder, Loader2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function MoveModal({ isOpen, onClose, selectedItems, currentFolderId, activeTab, onMoveSuccess }) {
  const [isMoving, setIsMoving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allFolders, setAllFolders] = useState([]);
  
  // Navigation State
  const [currentViewId, setCurrentViewId] = useState(null);
  const [navigationStack, setNavigationStack] = useState([null]);
  
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/folders/all');
      setAllFolders(res.data.folders || []);
    } catch (err) {
      toast.error('Failed to fetch folders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      setCurrentViewId(null);
      setNavigationStack([null]);
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMove = async () => {
    if (!selectedItems || selectedItems.length === 0) return;
    
    setIsMoving(true);
    try {
      // Use the new bulk API endpoint
      const itemsToMove = selectedItems.map(i => ({ id: i.id, type: i.type }));
      const res = await api.put('/api/folders/move-bulk', {
        items: itemsToMove,
        destinationFolderId: currentViewId
      });
      
      const results = res.data.results || [];
      const failures = results.filter(r => !r.success);
      
      if (failures.length > 0) {
        const code = failures[0].error;
        let msg = code || 'Failed to move item(s)';
        if (code === 'NO_WRITE_ACCESS_DESTINATION') msg = 'You do not have privileges to move items into this folder.';
        if (code === 'NO_WRITE_ACCESS_SOURCE') msg = 'You do not have privileges to move items out of their current folder.';
        if (code === 'NOT_OWNER') msg = 'You do not have privileges to move this item.';
        if (code === 'CIRCULAR_DEPENDENCY') msg = 'You cannot move a folder into its own subfolder.';
        if (code === 'CANNOT_MOVE_TO_ROOT') msg = 'You cannot move a shared item to your root space.';
        if (code === 'CANNOT_MOVE_OUT_OF_SHARED_SPACE') msg = 'You cannot move a shared item out of its shared folder hierarchy.';
        toast.error(msg);
        
        if (failures.length < results.length) {
          toast.success(`Successfully moved ${results.length - failures.length} item(s)`);
        }
      } else {
        toast.success(`Successfully moved ${selectedItems.length} item(s)`);
      }
      
      onMoveSuccess();
      onClose();
    } catch (err) {
      const code = err.response?.data?.error;
      let msg = code || 'Failed to move items';
      if (code === 'NO_WRITE_ACCESS_DESTINATION') msg = 'You do not have privileges to move items into this folder.';
      if (code === 'NO_WRITE_ACCESS_SOURCE') msg = 'You do not have privileges to move items out of their current folder.';
      if (code === 'NOT_OWNER') msg = 'You do not have privileges to move this item.';
      if (code === 'CIRCULAR_DEPENDENCY') msg = 'You cannot move a folder into its own subfolder.';
      if (code === 'CANNOT_MOVE_TO_ROOT') msg = 'You cannot move a shared item to your root space.';
      if (code === 'CANNOT_MOVE_OUT_OF_SHARED_SPACE') msg = 'You cannot move a shared item out of its shared folder hierarchy.';
      toast.error(msg);
    } finally {
      setIsMoving(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    try {
      const res = await api.post('/api/folders', {
        name: newFolderName,
        parentId: currentViewId,
        type: activeTab === 'templates' ? 'template' : 'document'
      });
      setAllFolders([...allFolders, res.data.folder]);
      setIsCreatingFolder(false);
      setNewFolderName('');
      toast.success('Folder created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleEnterFolder = (folderId) => {
    setCurrentViewId(folderId);
    setNavigationStack(prev => [...prev, folderId]);
  };

  const handleGoBack = () => {
    if (navigationStack.length <= 1) return;
    const newStack = navigationStack.slice(0, -1);
    setNavigationStack(newStack);
    setCurrentViewId(newStack[newStack.length - 1]);
  };

  // Get current view details
  const currentFolder = currentViewId ? allFolders.find(f => f.id === currentViewId) : null;
  const currentFolderName = currentFolder ? currentFolder.name : 'My Documents';
  
  // Prevent moving into itself or its descendants
  // We filter out any folder that is selected for moving
  const selectedFolderIds = new Set(selectedItems.filter(i => i.type === 'folder').map(i => i.id));
  
  // Also recursively filter out descendants of selected folders
  const getDescendants = (parentId) => {
    const children = allFolders.filter(f => f.parent_folder_id === parentId);
    let descendants = [...children];
    children.forEach(c => {
      descendants = [...descendants, ...getDescendants(c.id)];
    });
    return descendants;
  };
  
  const invalidDestinationIds = new Set(selectedFolderIds);
  selectedFolderIds.forEach(id => {
    getDescendants(id).forEach(d => invalidDestinationIds.add(d.id));
  });

  const visibleFolders = allFolders.filter(f => f.parent_folder_id === currentViewId && !invalidDestinationIds.has(f.id) && f.type === (activeTab === 'templates' ? 'template' : 'document'));

  // Cannot move if the destination is exactly where it already is
  const isDestinationSameAsCurrent = currentViewId === currentFolderId;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <h2 className="text-lg font-semibold text-slate-900 truncate">Move {selectedItems.length} item(s)</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Navigation Bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <button 
            onClick={handleGoBack}
            disabled={navigationStack.length <= 1}
            className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-medium text-slate-700 text-sm truncate flex-1">{currentFolderName}</span>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {visibleFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleEnterFolder(folder.id)}
                  className="w-full flex items-center justify-between py-3 px-4 text-sm text-left transition-colors hover:bg-slate-50 text-slate-700 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5 text-indigo-500" />
                    <span className="font-medium">{folder.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              
              {visibleFolders.length === 0 && !isCreatingFolder && (
                <div className="text-center py-12">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                    <Folder className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">This folder is empty</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Folder Inline */}
        <div className="px-4 py-3 border-t border-slate-100 bg-white">
          {isCreatingFolder ? (
            <form onSubmit={handleCreateFolder} className="flex gap-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 text-sm border border-slate-200 rounded-md px-3 py-2 focus:ring-slate-900 focus:border-slate-900"
              />
              <button 
                type="submit" 
                disabled={!newFolderName.trim()}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                Create
              </button>
              <button 
                type="button" 
                onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                className="px-2 py-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <button 
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-2 hover:bg-slate-50 rounded-md"
            >
              <Plus className="h-4 w-4" /> New Folder
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={isMoving || isDestinationSameAsCurrent}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
          >
            {isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
