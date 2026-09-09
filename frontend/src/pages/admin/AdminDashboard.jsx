import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { Users, ShieldCheck, Plus, MoreVertical, Loader2, X, Mail, User as UserIcon, UploadCloud, FileText, Ban, CheckCircle2 } from 'lucide-react';

const STATUS_META = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  invited: { label: 'Invited', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  deactivated: { label: 'Deactivated', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
      isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
    }`}>
      {role}
    </span>
  );
}

const StatCard = ({ icon: Icon, value, label, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`text-left bg-white rounded-xl border shadow-sm p-5 flex items-center gap-3 transition-colors ${
      isActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
    }`}
  >
    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-slate-600" />
    </div>
    <div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  </button>
);

function ConfirmModal({ isOpen, title, message, confirmText, isDanger, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        </div>
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2'
                : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2'
            }`}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserActionsMenu({ user: targetUser, currentUserId, onActionComplete }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = () => {
    if (!isMenuOpen && buttonRef.current) {
      const spaceBelow = window.innerHeight - buttonRef.current.getBoundingClientRect().bottom;
      setOpenUpward(spaceBelow < 200);
    }
    setIsMenuOpen((prev) => !prev);
  };

  const isSelf = targetUser.id === currentUserId;

  const handleToggleRole = async () => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    setIsMenuOpen(false);
    setIsProcessing(true);
    try {
      await api.patch(`/api/admin/users/${targetUser.id}/role`, { role: newRole });
      toast.success(`${targetUser.name} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}.`);
      onActionComplete();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role.');
    } finally {
      setIsProcessing(false);
    }
  };

  const runToggleActive = async (deactivate) => {
    setConfirmDialog(null);
    setIsProcessing(true);
    try {
      const endpoint = deactivate ? 'deactivate' : 'reactivate';
      await api.patch(`/api/admin/users/${targetUser.id}/${endpoint}`);
      toast.success(`${targetUser.name} has been ${deactivate ? 'deactivated' : 'reactivated'}.`);
      onActionComplete();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = () => {
    const isDeactivating = targetUser.status !== 'deactivated';
    setIsMenuOpen(false);

    if (!isDeactivating) {
      runToggleActive(false);
      return;
    }

    setConfirmDialog({
      title: 'Deactivate User',
      message: `Deactivate ${targetUser.name}? They won't be able to sign in until reactivated.`,
      confirmText: 'Deactivate',
      isDanger: true,
      action: () => runToggleActive(true),
    });
  };

  const menuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const dangerMenuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  const items = [
    {
      key: 'role',
      label: targetUser.role === 'admin' ? 'Make user' : 'Make admin',
      icon: ShieldCheck,
      onClick: handleToggleRole,
    },
    {
      key: 'status',
      label: targetUser.status === 'deactivated' ? 'Reactivate' : 'Deactivate',
      icon: targetUser.status === 'deactivated' ? CheckCircle2 : Ban,
      onClick: handleToggleActive,
      danger: targetUser.status !== 'deactivated',
    },
  ];

  return (
    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={toggleMenu}
          disabled={isSelf}
          className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={isSelf ? "You can't modify your own account here" : 'Actions'}
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {isMenuOpen && !isSelf && (
          <div className={`absolute right-0 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            {items.map((item) => (
              <button
                key={item.key}
                className={item.danger ? dangerMenuItemCls : menuItemCls}
                disabled={isProcessing}
                onClick={item.onClick}
              >
                <item.icon className={`h-4 w-4 ${item.danger ? 'text-red-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        isDanger={confirmDialog?.isDanger}
        onConfirm={confirmDialog?.action}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

function InviteModal({ onClose, onInvited }) {
  const [tab, setTab] = useState('manual'); // 'manual' | 'csv'

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return toast.error('Name and email are required.');

    setIsSubmitting(true);
    try {
      await api.post('/api/admin/users/invite', { name: name.trim(), email: email.trim() });
      toast.success(`Invitation sent to ${email}.`);
      setName('');
      setEmail('');
      onInvited();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setCsvFile(file);
    } else {
      toast.error('Please upload a valid CSV file.');
    }
  };

  const handleCsvSubmit = async () => {
    if (!csvFile) return toast.error('Please select a CSV file first.');

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.post('/api/admin/users/invite-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      setCsvFile(null);
      onInvited();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process CSV.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Invite users</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-6 pt-4 gap-1">
          <button
            onClick={() => setTab('manual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'manual' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Add manually
          </button>
          <button
            onClick={() => setTab('csv')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'csv' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Upload CSV
          </button>
        </div>

        <div className="p-6">
          {tab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">New users are invited with the "user" role. They'll receive an email to complete signup.</p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  const csvContent = 'name,email\nJane Doe,jane@company.com\n';
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'user-invite-template.csv';
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Download CSV template
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
                {csvFile ? (
                  <div className="flex flex-col items-center">
                    <FileText className="h-8 w-8 text-slate-600 mb-2" />
                    <span className="text-sm font-medium text-slate-900">{csvFile.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-700">Click to browse or drag a CSV here</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">
                CSV must have <code className="bg-slate-100 px-1 py-0.5 rounded">name</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">email</code> columns.
              </p>
              <button
                onClick={handleCsvSubmit}
                disabled={isUploading || !csvFile}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUploading ? 'Uploading...' : 'Upload and Invite'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserOption, setSelectedUserOption] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const handleInvited = () => {
    setShowInviteModal(false);
    fetchUsers();
  };

  const resetFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} — ${u.email}` }));

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Admin</p>
            <h1 className="text-2xl font-semibold text-slate-900">System Admin dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Signed in as {user?.name || user?.email} — users and access control.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={Users}
            value={users.length}
            label="Total users"
            onClick={resetFilters}
            isActive={roleFilter === 'all' && statusFilter === 'all'}
          />
          <StatCard
            icon={ShieldCheck}
            value={activeCount}
            label="Active users"
            onClick={() => { setStatusFilter('active'); setRoleFilter('all'); }}
            isActive={statusFilter === 'active'}
          />
          <StatCard
            icon={ShieldCheck}
            value={adminCount}
            label="Admins"
            onClick={() => { setRoleFilter('admin'); setStatusFilter('all'); }}
            isActive={roleFilter === 'admin'}
          />
        </div>

        {/* User Management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap p-5 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">User management</h2>
              <p className="text-xs text-slate-400 mt-0.5">Invite, deactivate, and edit roles</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-64">
                <Select
                  options={userOptions}
                  value={selectedUserOption}
                  onChange={(option) => {
                    setSelectedUserOption(option);
                    setSearchQuery(option ? option.label.split(' — ')[0] : '');
                  }}
                  onInputChange={(value, { action }) => {
                    if (action === 'input-change') setSearchQuery(value);
                  }}
                  placeholder="Search users..."
                  isClearable
                  classNamePrefix="react-select"
                  maxMenuHeight={3*40}
                  styles={{
                    control: (base) => ({ ...base, minHeight: '34px', fontSize: '13px', borderColor: '#e2e8f0' }),
                    menu: (base) => ({ ...base, fontSize: '13px' }),
                  }}
                />
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Invite user
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 mb-2 animate-spin" />
              <p className="text-sm">Loading users…</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-t border-b border-slate-100">
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Name</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Role</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-slate-900">{u.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-slate-500">{u.email}</span>
                    </td>
                    <td className="px-5 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <UserActionsMenu user={u} currentUserId={user?.id} onActionComplete={fetchUsers} />
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                      No users match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} onInvited={handleInvited} />
      )}
    </div>
  );
}