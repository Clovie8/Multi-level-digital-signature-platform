import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FileText, Clock, CheckCircle2, FilePlus2, Upload, ChevronRight, Loader2, PenTool } from 'lucide-react';

axios.defaults.withCredentials = true;

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, completed: 0 });
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [docsRes, pendingRes] = await Promise.all([
          axios.get('http://localhost:5000/api/documents'),
          axios.get('http://localhost:5000/api/documents/pending-approvals'),
        ]);
        setDocuments(docsRes.data.documents || []);
        setStats(docsRes.data.stats || { total: 0, draft: 0, pending: 0, completed: 0 });
        setPendingApprovals(pendingRes.data.pending || []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">A summary of your document activity.</p>
        </div>
        <button
          onClick={() => navigate('/documents/new')}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          <FilePlus2 className="h-4 w-4" /> New Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText} label="Total Documents" value={stats.total} accent="bg-slate-100 text-slate-700" />
        <StatCard icon={Upload} label="Drafts" value={stats.draft} accent="bg-slate-100 text-slate-600" />
        <StatCard icon={Clock} label="Pending Signature" value={stats.pending} accent="bg-amber-100 text-amber-700" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} accent="bg-emerald-100 text-emerald-700" />
      </div>

      {/* Awaiting Your Signature */}
      {pendingApprovals.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50/50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <PenTool className="h-4 w-4 text-amber-600" /> Awaiting Your Signature
            </h2>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              {pendingApprovals.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {pendingApprovals.map((item) => (
              <li
                key={item.stepId}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/sign/${item.accessToken}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <PenTool className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.documentName}</p>
                    {/* <p className="text-xs text-slate-400">Step {item.stepOrder} · Requested {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p> */}
                  </div>
                </div>
                <span className="text-xs font-medium text-blue-600 flex items-center">
                  Sign now <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Documents */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Documents</h2>
          {documents.length > 0 && (
            <button
              onClick={() => navigate('/documents')}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center"
            >
              View all <ChevronRight className="h-4 w-4 ml-0.5" />
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No documents yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Upload your first PDF to get started.</p>
            <button
              onClick={() => navigate('/documents/new')}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
            >
              <Upload className="h-4 w-4" /> Upload PDF
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.slice(0, 5).map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}