import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, XAxis } from 'recharts';
import api from '../lib/api';
import { Plus, Loader2 } from 'lucide-react';

api.defaults.withCredentials = true;

const STATUS_COLORS = {
  awaitingSignature: '#c9a15f',
  inProgress: '#5b6b8c',
  completed: '#3f5c3f',
  voidedRejected: '#8c3b3b',
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
  <div className="bg-white rounded-xl border border-slate-200 p-6">
    <p className="text-3xl font-serif font-semibold text-slate-900">{value}</p>
    <p className="text-sm text-slate-500 mt-1">{label}</p>
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
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading dashboard...
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
    <div className="min-h-screen bg-[#FAFAF8] p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold tracking-wider text-rose-800 uppercase mb-1">Overview</p>
            <h1 className="text-3xl font-serif font-semibold text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {stats.waitingOnYou > 0
                ? `${stats.waitingOnYou} document${stats.waitingOnYou !== 1 ? 's' : ''} need your signature. Everything else is moving on its own.`
                : 'Nothing needs your signature right now.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/documents/new')}
            className="flex items-center gap-2 bg-rose-800 hover:bg-rose-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" /> New document
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-serif font-semibold text-slate-900 mb-4">Status breakdown</h2>
            {statusPieData.every(d => d.value === 0) ? (
              <p className="text-sm text-slate-400 py-8 text-center">No documents yet.</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" outerRadius={65} stroke="none">
                      {statusPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-serif font-semibold text-slate-900 mb-4">Completed per week</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={completedPerWeek} barCategoryGap="30%">
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} fill="#1e293b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Needs Attention + Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-semibold text-slate-900">Needs your attention</h2>
              {needsAttention.length > 0 && (
                <span className="text-xs font-semibold bg-rose-800 text-white px-2.5 py-1 rounded-full">
                  {needsAttention.length} pending on you
                </span>
              )}
            </div>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">You're all caught up.</p>
            ) : (
              <div className="space-y-3">
                {needsAttention.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-800 mt-2 shrink-0"></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/sign/${item.accessToken}`)}
                      className="shrink-0 bg-rose-800 hover:bg-rose-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Sign now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-serif font-semibold text-slate-900 mb-4">Recent activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No activity yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm text-slate-700">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-amber-600"></span>
                      <strong>{item.actorEmail}</strong> {ACTION_LABELS[item.action] || item.action} <strong>{item.documentName}</strong>
                    </p>
                    <p className="text-xs text-slate-400 ml-3.5">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documents In Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-semibold text-slate-900">Documents in progress</h2>
            <button onClick={() => navigate('/documents')} className="text-sm font-medium text-rose-800 hover:text-rose-900 transition-colors">
              View all →
            </button>
          </div>
          {documentsInProgress.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Nothing in progress right now.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {documentsInProgress.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 text-lg">▢</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500">{doc.detail}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full ml-3">
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