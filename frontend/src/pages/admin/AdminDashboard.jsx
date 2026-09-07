import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Users, ShieldCheck, Plus, Search, MoreVertical, Loader2, X, Mail, User as UserIcon, UploadCloud, FileText } from 'lucide-react';

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

const StatCard = ({ icon: Icon, value, label }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-slate-600" />
    </div>
    <div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  </div>
);

function InviteModal({ onClose, onInvited }) {
  const [tab, setTab] = useState('manual'); // 'manual' | 'csv'

  // Manual invite state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV invite state
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

        {/* Tabs */}
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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const comingSoon = () => toast('Coming soon.');

  const handleInvited = () => {
    setShowInviteModal(false);
    fetchUsers();
  };

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
          <StatCard icon={Users} value={users.length} label="Total users" />
          <StatCard icon={ShieldCheck} value={activeCount} label="Active users" />
          <StatCard icon={ShieldCheck} value={adminCount} label="Admins" />
        </div>

        {/* User Management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap p-5 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">User management</h2>
              <p className="text-xs text-slate-400 mt-0.5">Invite, deactivate, and edit roles</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 w-48"
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
                      <button
                        onClick={comingSoon}
                        className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-auto"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
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