import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Users, ShieldCheck, Plus, Search, MoreVertical, Loader2 } from 'lucide-react';

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

export default function AdminDashboard() {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
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
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const comingSoon = () => toast('Coming soon.');

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
                onClick={comingSoon}
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
    </div>
  );
}