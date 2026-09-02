import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, XAxis } from 'recharts';
import api from '../../lib/api';
import { Plus, Loader2, ChevronRight, PenTool } from 'lucide-react';

const STATUS_COLORS = {
  awaitingSignature: '#f59e0b',
  inProgress: '#3b82f6',
  completed: '#10b981',
  voidedRejected: '#ef4444',
};

const STATUS_LABELS = {
  awaitingSignature: 'Awaiting signature',
  inProgress: 'In progress',
  completed: 'Completed',
  voidedRejected: 'Voided / rejected',
};

const ACTION_LABELS = {
  DOCUMENT_DISPATCHED: 'was dispatched',
  SIGNED_DOCUMENT: 'signed',
  DOCUMENT_COMPLETED_AND_SEALED: 'was completed',
};

const StatCard = ({ value, label }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
    <p className="text-2xl font-semibold text-slate-900">{value}</p>
    <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get('/api/documents/dashboard-summary');
        setData(res.data);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading dashboard...
      </div>
    );
  }

  const { userName, stats, statusBreakdown, completedPerWeek, needsAttention, recentActivity, documentsInProgress } = data;

  const statusPieData = Object.entries(statusBreakdown).map(([key, value]) => ({
    name: STATUS_LABELS[key],
    value,
    color: STATUS_COLORS[key]
  }));

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Overview</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {stats.waitingOnYou > 0
                ? `${stats.waitingOnYou} document${stats.waitingOnYou !== 1 ? 's' : ''} need your signature. Everything else is moving on its own.`
                : 'Nothing needs your signature right now.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New document
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard value={stats.waitingOnYou} label="Waiting on you" />
          <StatCard value={stats.inProgress} label="In progress (all)" />
          <StatCard value={stats.completedThisMonth} label="Completed this month" />
          <StatCard value={stats.overdue} label="Overdue > 5 days" />
        </div>

        {/* Status Breakdown + Completed Per Week */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Status breakdown</h2>
            {statusPieData.every(d => d.value === 0) ? (
              <p className="text-sm text-slate-400 py-8 text-center">No documents yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" outerRadius={60} stroke="none">
                      {statusPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {statusPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="text-slate-600 font-medium">{item.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Completed per week</h2>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={completedPerWeek} barCategoryGap="30%">
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Needs Attention + Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Needs your attention</h2>
              {needsAttention.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {needsAttention.length} pending on you
                </span>
              )}
            </div>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">You're all caught up.</p>
            ) : (
              <div className="space-y-1 -mx-2">
                {needsAttention.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/sign/${item.accessToken}`)}
                    className="flex items-center justify-between gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <PenTool className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.detail}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 flex items-center shrink-0">
                      Sign now <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Recent activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No activity yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm text-slate-700">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-blue-500"></span>
                      <span className="font-medium">{item.actorEmail}</span> {ACTION_LABELS[item.action] || item.action} <span className="font-medium">{item.documentName}</span>
                    </p>
                    <p className="text-xs text-slate-400 ml-3.5">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documents In Progress */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Documents in progress</h2>
            <button onClick={() => navigate('/documents')} className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors flex items-center">
              View all <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </button>
          </div>
          {documentsInProgress.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Nothing in progress right now.</p>
          ) : (
            <div className="divide-y divide-slate-100 -mx-2">
              {documentsInProgress.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2.5 px-2 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
                  onClick={() => navigate(`/documents`)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 text-xs font-bold">▢</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-400">{doc.detail}</p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ml-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    In progress
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}