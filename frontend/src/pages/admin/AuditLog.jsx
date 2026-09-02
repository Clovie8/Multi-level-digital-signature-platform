import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { ScrollText, RefreshCw, X, Filter } from 'lucide-react';

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

const ACTION_LABELS = {
  DOCUMENT_DISPATCHED: 'Dispatched',
  SIGNED_DOCUMENT: 'Signed',
  DOCUMENT_COMPLETED_AND_SEALED: 'Completed & sealed',
  VOIDED: 'Voided',
  USER_LOGIN: 'Logged in',
  USER_LOGOUT: 'Logged out',
};

function ActionBadge({ action }) {
  const isDecline = action?.startsWith('DECLINED');
  const label = ACTION_LABELS[action] || (isDecline ? 'Declined' : action);
  const cls = isDecline
    ? 'bg-red-50 text-red-700'
    : action === 'SIGNED_DOCUMENT' || action === 'DOCUMENT_COMPLETED_AND_SEALED'
      ? 'bg-emerald-50 text-emerald-700'
      : action === 'USER_LOGIN' || action === 'USER_LOGOUT'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function LogDetailModal({ log, onClose }) {
  if (!log) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Log entry</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Action</p>
            <ActionBadge action={log.action} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Document</p>
            <p className="text-slate-900 font-medium">{log.documentName || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Actor</p>
            <p className="text-slate-900">{log.actorEmail}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">IP address</p>
            <p className="text-slate-500 font-mono text-xs">{log.ipAddress || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Timestamp</p>
            <p className="text-slate-500">{formatTimestamp(log.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const POLL_INTERVAL_MS = 10000;

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [filters, setFilters] = useState({
    action: '',
    actorEmail: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 10,
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchLogs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const currentFilters = filtersRef.current;
      const params = Object.fromEntries(Object.entries(currentFilters).filter(([, v]) => v !== ''));
      const res = await api.get('/api/admin/audit-logs', { params });
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load audit logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refetch whenever filters change (page, search, etc.)
  useEffect(() => {
    fetchLogs();
  }, [filters, fetchLogs]);

  // Poll on an interval while auto-refresh is on, only when we're on page 1
  // (so a live tail doesn't yank the admin off a page they're reviewing).
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      if (filtersRef.current.page === 1) {
        fetchLogs(true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const activeFilterCount = ['action', 'actorEmail', 'startDate', 'endDate'].filter((k) => filters[k]).length;

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <ScrollText className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Audit logs</h1>
              <p className="text-sm text-slate-500 mt-0.5">{pagination.total} entries · global, read-only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors ${
                activeFilterCount > 0 ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
            <button
              onClick={() => fetchLogs(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Live status row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm mb-6">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-2 focus:ring-slate-900"
              />
              <span className="text-slate-600">Auto-refresh</span>
            </label>
            {autoRefreshEnabled && (
              <span className={`flex items-center gap-1.5 font-medium transition-colors ${isRefreshing ? 'text-amber-600' : 'text-emerald-600'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75 ${isRefreshing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isRefreshing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                </span>
                {isRefreshing ? 'Syncing…' : 'Live'}
              </span>
            )}
          </div>
          <span className="text-slate-400">Last updated: {formatTimestamp(lastUpdated.toISOString())}</span>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Action contains</label>
              <input
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                placeholder="e.g. SIGNED"
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Actor email</label>
              <input
                value={filters.actorEmail}
                onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
                placeholder="name@company.com"
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">From</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">To</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
          {isRefreshing && !isLoading && (
            <div className="absolute inset-0 bg-white/40 z-10 flex items-start justify-center pt-6 pointer-events-none">
              <span className="flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Syncing new entries…
              </span>
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="h-6 w-6 mb-2 animate-spin" />
              <p className="text-sm">Loading audit logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <ScrollText className="h-10 w-10 text-slate-300 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">No log entries found</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Try adjusting your filters.</p>
            </div>
          ) : (
            <table className={`w-full text-left transition-opacity ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Action</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Document</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Actor</th>
                  <th className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-5 py-3 text-sm text-slate-900 font-medium">{log.documentName || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{log.actorEmail}</td>
                    <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}