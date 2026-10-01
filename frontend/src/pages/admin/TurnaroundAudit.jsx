import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Clock, Users, Loader2, Search, X } from 'lucide-react';
import { format } from 'date-fns';

const RATING_META = {
  Fast: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  Average: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  Slow: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
};

function RatingPill({ rating }) {
  const meta = RATING_META[rating] || RATING_META.Average;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {rating}
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

export default function TurnaroundAudit() {
  const { user } = useOutletContext();
  const [data, setData] = useState({ signers: [], globalAvgTurnaroundHours: 0, totalSigners: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [selectedSigner, setSelectedSigner] = useState(null);

  const fetchAuditData = async () => {
    try {
      const res = await api.get('/api/admin/audit/turnaround');
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load turnaround audit data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const filteredSigners = data.signers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = ratingFilter === 'All' || s.rating === ratingFilter;
    return matchesSearch && matchesRating;
  });

  const formatTimeHuman = (totalHours) => {
    if (totalHours < 1) {
      return `${Math.round(totalHours * 60)} mins`;
    }
    if (totalHours < 24) {
      const hrs = Math.floor(totalHours);
      const mins = Math.round((totalHours - hrs) * 60);
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    const days = Math.floor(totalHours / 24);
    const remainingHrs = Math.floor(totalHours % 24);
    return remainingHrs > 0 ? `${days}d ${remainingHrs}h` : `${days}d`;
  };

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Admin / Audit</p>
          <h1 className="text-2xl font-semibold text-slate-900">Signer Turnaround Audit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and evaluate the average time it takes signers to complete documents.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            value={data.totalSigners}
            label="Total Signers Evaluated"
          />
          <StatCard
            icon={Clock}
            value={formatTimeHuman(data.globalAvgTurnaroundHours)}
            label="Platform Avg Turnaround"
          />
          <StatCard
            icon={Clock}
            value={data.signers.filter(s => s.rating === 'Fast').length}
            label="Fast Signers (< 12h)"
          />
          <StatCard
            icon={Clock}
            value={data.signers.filter(s => s.rating === 'Slow').length}
            label="Slow Signers (> 24h)"
          />
        </div>

        {/* Data Table Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Signer Performance</h2>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="py-1.5 px-3 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 bg-white"
              >
                <option value="All">All Ratings</option>
                <option value="Fast">Fast</option>
                <option value="Average">Average</option>
                <option value="Slow">Slow</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 mb-2 animate-spin" />
              <p className="text-sm">Crunching turnaround data…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Position</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Signer Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Email</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Docs Signed</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Avg Turnaround</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSigners.map((s, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedSigner(s)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-slate-900">{s.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-500">{s.email}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-slate-700">{s.documentsSigned}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-slate-900">{formatTimeHuman(s.avgTurnaroundHours)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <RatingPill rating={s.rating} />
                      </td>
                    </tr>
                  ))}
                  {filteredSigners.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                        No signers match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Signer Details Modal */}
      {selectedSigner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedSigner(null)}>
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedSigner.name}</h3>
                <p className="text-sm text-slate-500">{selectedSigner.email} • {selectedSigner.documentsSigned} documents signed</p>
              </div>
              <button 
                onClick={() => setSelectedSigner(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Document Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Initiated At</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Reached At</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Signed At</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">Turnaround</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSigner.history && selectedSigner.history.length > 0 ? (
                      selectedSigner.history.map((doc, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900 truncate max-w-[200px]" title={doc.fileName}>
                            {doc.fileName}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {doc.initiatedAt ? format(new Date(doc.initiatedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {doc.reachedAt ? format(new Date(doc.reachedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {doc.signedAt ? format(new Date(doc.signedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-700 text-right">
                            {formatTimeHuman(doc.turnaroundHours)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-400">
                          No document history found for this signer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedSigner(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
