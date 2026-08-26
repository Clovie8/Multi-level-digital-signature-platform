import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  FileSignature, RotateCcw, Layers, Ban, Clock, CheckCircle2,
  AlertTriangle, UploadCloud, X, Plus, Search,
  Eye, Bell, Download, Pencil, ArrowRight
} from 'lucide-react';

const STATUS_META = {
  draft: { label: 'Draft', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' },
  pending: { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  in_progress: { label: 'In progress', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  declined: { label: 'Declined', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  superseded: { label: 'Superseded', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  voided: { label: 'Voided', dot: 'bg-slate-300', text: 'text-white', bg: 'bg-slate-800' },
};

const generateInitials = (name) => {
  if (!name) return '—';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ProgressDots({ document }) {
  const total = document.totalSteps || 0;
  const declinedIndex = document.status === 'declined' && document.declinedStepOrder
    ? document.declinedStepOrder - 1
    : null;
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => {
        let cls = 'bg-slate-200';
        if (i === declinedIndex) cls = 'bg-red-500';
        else if (i < document.signedSteps) cls = 'bg-emerald-500';
        return <span key={i} className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cls}`} />;
      })}
    </div>
  );
}

function PendingOnCell({ document, currentUser }) {
  if (document.status === 'declined') {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {currentUser?.initials || 'Y'}
        </div>
        <span className="text-xs font-semibold text-slate-900 truncate">You (decide)</span>
      </div>
    );
  }
  if (document.pendingOn) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {generateInitials(document.pendingOn)}
        </div>
        <span className="text-xs font-semibold text-slate-900 truncate">{document.pendingOn}</span>
      </div>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

function RowActions({ document, onView }) {
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const btnCls = "h-9 w-9 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const comingSoon = (label) => toast(`${label} coming soon.`);

  const handleSendReminder = async () => {
    setIsSendingReminder(true);
    try {
      const res = await api.post(`/api/documents/${document.id}/remind`);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send the reminder.');
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get(`/api/documents/${document.id}/download`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not download this document.');
    } finally {
      setIsDownloading(false);
    }
  };

  const extra = (() => {
    switch (document.status) {
      case 'in_progress':
      case 'pending':
        return (
          <button className={btnCls} onClick={handleSendReminder} disabled={isSendingReminder} title="Send reminder">
            <Bell className="h-5 w-5" />
          </button>
        );
      case 'completed':
        return (
          <button className={btnCls} onClick={handleDownload} disabled={isDownloading} title="Download">
            <Download className="h-5 w-5" />
          </button>
        );
      case 'superseded':
        return <button className={btnCls} onClick={() => comingSoon('Version history')} title="View latest version"><ArrowRight className="h-5 w-5" /></button>;
      default:
        return null;
    }
  })();

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {document.status === 'draft' ? (
        <button className={btnCls} onClick={() => comingSoon('Draft editing')} title="Edit"><Pencil className="h-5 w-5" /></button>
      ) : (
        <button className={btnCls} onClick={() => onView(document.id)} title="View"><Eye className="h-5 w-5" /></button>
      )}
      {extra}
    </div>
  );
}

function DocumentTableRow({ document, currentUser, isChecked, onCheck, onOpen }) {
  const isDeclined = document.status === 'declined';

  return (
    <tr
      onClick={() => onOpen(document.id)}
      className={`cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${isDeclined ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50'
        }`}
    >
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onCheck(document.id)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileSignature className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{document.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {isDeclined && document.declinedBy
                ? <>Declined by <span className="font-medium text-red-600">{document.declinedBy}</span> · step {document.declinedStepOrder} of {document.totalSteps}</>
                : `${document.totalSteps} signer${document.totalSteps === 1 ? '' : 's'}`}
              {document.resumeCount > 0 && (
                <span className="ml-2 font-medium text-amber-600">
                  Declined {document.status === 'declined' ? document.resumeCount + 1 : document.resumeCount}×
                </span>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {generateInitials(document.initiatorName)}
          </div>
          <span className="text-xs font-semibold text-slate-900 truncate">
            {document.initiatorId === currentUser?.id ? 'You' : (document.initiatorName || 'Unknown')}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
        {new Date(document.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-3 py-3">
        <ProgressDots document={document} />
      </td>
      <td className="px-3 py-3 min-w-0">
        <PendingOnCell document={document} currentUser={currentUser} />
      </td>
      <td className="px-3 py-3">
        <StatusPill status={document.status} />
      </td>
      <td className="px-3 py-3">
        <RowActions document={document} onView={onOpen} />
      </td>
    </tr>
  );
}

function StepsTimeline({ steps }) {
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      {steps.map((step) => {
        const isSigned = step.status === 'completed';
        const isDeclined = step.status === 'declined';
        return (
          <div
            key={step.id}
            className={`flex-1 px-3 py-2.5 border-r border-slate-200 last:border-r-0 ${isSigned ? 'bg-emerald-50' : isDeclined ? 'bg-red-50' : 'bg-white'
              }`}
          >
            <p className="text-[10px] font-mono text-slate-400">STEP {step.stepOrder}</p>
            <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{step.signerName}</p>
            <p className={`text-[11px] font-medium mt-0.5 ${isSigned ? 'text-emerald-600' : isDeclined ? 'text-red-600' : 'text-slate-400'
              }`}>
              {isSigned ? 'Signed' : isDeclined ? 'Declined' : 'Waiting'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ReviseModal({ document, onClose, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append('pdf_file', file);
      const res = await api.post(`/api/documents/${document.id}/revise`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Revision created. Every signer has been notified.');

      if (res.data.isInitiatorFirst && res.data.redirectToken) {
        navigate(`/sign/${res.data.redirectToken}`);
      } else {
        onSubmitted();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create the revision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-slate-900">Create a revision</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          A new version of <span className="font-medium text-slate-700">{document.fileName}</span> will be created. Every signer starts over, including anyone who already signed.
        </p>

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Corrected file (optional)
        </label>
        <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="h-6 w-6 mx-auto mb-2 text-slate-400" />
          <p className="text-xs text-slate-600 font-medium">
            {file ? file.name : 'Upload the corrected PDF, or leave blank to reuse the original file'}
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create revision'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineResolutionPanel({ document, onRefresh }) {
  const [isResuming, setIsResuming] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);

  const declinedStep = document.steps.find((s) => s.status === 'declined');
  const resumeCount = document.resumeCount;
  const resumeLimitReached = resumeCount >= 3;
  const declineNumber = resumeCount + 1;

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await api.post(`/api/documents/${document.id}/resume`);
      toast.success(`${declinedStep?.signerName || 'The signer'} has been re-notified.`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resume this document.');
    } finally {
      setIsResuming(false);
    }
  };

  const handleVoid = async () => {
    setIsVoiding(true);
    try {
      await api.post(`/api/documents/${document.id}/void`);
      toast.success('Document voided.');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not void this document.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="mt-6">
      {resumeLimitReached && (
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Declined <strong>{declineNumber} times</strong>. Resume is locked — create a revision or void this document.
          </p>
        </div>
      )}

      {declinedStep && (
        <div className="flex gap-3 mb-5">
          <div className="h-9 w-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {declinedStep.signerName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{declinedStep.signerName}</span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(document.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-slate-600 italic bg-slate-50 border-l-2 border-red-400 rounded-r px-3 py-2 mt-1.5">
              "{declinedStep.declineReason}"
            </p>
          </div>
        </div>
      )}

      <StepsTimeline steps={document.steps} />

      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-6 mb-3">
        {resumeLimitReached ? 'Choose one' : 'Choose how to proceed'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`border rounded-xl p-5 flex flex-col gap-3 ${resumeLimitReached ? 'border-slate-200 opacity-50' : 'border-slate-200'}`}>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${resumeLimitReached ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
            <RotateCcw className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">{resumeLimitReached ? 'Resume — locked' : 'Resume'}</h4>
          <p className="text-xs text-slate-500 leading-relaxed flex-grow">
            {resumeLimitReached
              ? 'This document has been declined 3 times. Resume is disabled to stop it cycling without a real fix.'
              : `Reopens ${declinedStep?.signerName || "the signer's"} step with a new secure link. Nothing about the file changes — earlier signatures stay as they are.`}
          </p>
          <span className="text-[11px] font-mono text-slate-400">{resumeCount} of 3 resumes used</span>
          <button
            onClick={handleResume}
            disabled={resumeLimitReached || isResuming}
            className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isResuming ? 'Resuming…' : 'Resume signing'}
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Create a revision</h4>
          <p className="text-xs text-slate-500 leading-relaxed flex-grow">
            Upload a corrected file. A new version is created and every signer — including anyone who already signed — signs again from the start.
          </p>
          <span className="text-[11px] font-mono text-slate-400">Always available</span>
          <button
            onClick={() => setIsReviseModalOpen(true)}
            className="w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            Start revision
          </button>
        </div>
      </div>

      {resumeLimitReached && (
        <div className="flex justify-end mt-3">
          <button
            onClick={handleVoid}
            disabled={isVoiding}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" />
            {isVoiding ? 'Voiding…' : 'Void this document instead'}
          </button>
        </div>
      )}

      {isReviseModalOpen && (
        <ReviseModal
          document={document}
          onClose={() => setIsReviseModalOpen(false)}
          onSubmitted={() => { setIsReviseModalOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

const TABS = [
  { key: 'all', label: 'All documents' },
  { key: 'sent_by_you', label: 'Documents by you' },
  { key: 'needs_decision', label: 'Needs your decision' },
];

const STATUS_FILTER_OPTIONS = ['all', ...Object.keys(STATUS_META)];

export default function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [checkedIds, setCheckedIds] = useState(new Set());

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.get('/api/documents');
      setDocuments(res.data.documents);
      return res.data.documents;
    } catch (err) {
      console.error(err);
      toast.error('Could not load your documents.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    setIsDetailLoading(true);
    try {
      const res = await api.get(`/api/documents/${id}`);
      setDetail(res.data.document);
    } catch (err) {
      console.error(err);
      toast.error('Could not load that document.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialDocuments = async () => {
      await fetchDocuments();
    };
    loadInitialDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/api/auth/me');
        setCurrentUser({ id: res.data.id, name: res.data.name, initials: generateInitials(res.data.name) });
      } catch (err) {
        console.error('Failed to fetch user in Documents', err);
      }
    };
    fetchUser();
  }, []);

  const handleSelect = (id) => {
    setSelectedId(id);
    fetchDetail(id);
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const handleRefresh = async () => {
    await fetchDocuments();
    if (selectedId) fetchDetail(selectedId);
  };

  const needsDecisionCount = useMemo(
    () => documents.filter((d) => d.status === 'declined').length,
    [documents]
  );

  const sentByYouCount = useMemo(
    () => documents.filter((d) => !d.initiatorId || d.initiatorId === currentUser?.id).length,
    [documents, currentUser]
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (activeTab === 'needs_decision' && d.status !== 'declined') return false;
      if (activeTab === 'sent_by_you' && d.initiatorId && d.initiatorId !== currentUser?.id) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (searchQuery && !d.fileName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [documents, activeTab, statusFilter, searchQuery, currentUser]);

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    setCheckedIds((prev) =>
      prev.size === filteredDocuments.length ? new Set() : new Set(filteredDocuments.map((d) => d.id))
    );
  };

  const clearChecked = () => setCheckedIds(new Set());

  const handleBulkComingSoon = () => toast('Bulk actions are coming soon.');

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Document tracking</p>
            <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Everything you've sent for signature — including declines, resumes, and revisions.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New document
          </button>
        </div>

        <div className="flex gap-6 border-b border-slate-200 mb-5">
          {TABS.map((tab) => {
            const count = tab.key === 'all'
              ? documents.length
              : tab.key === 'sent_by_you'
                ? sentByYouCount
                : needsDecisionCount;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${isActive ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
                  }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm font-medium text-slate-700 border border-slate-200 rounded-md py-2 px-3 focus:ring-slate-900 focus:border-slate-900"
          >
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Status: All' : STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        {checkedIds.size > 0 && (
          <div className="flex items-center gap-4 bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2.5 mb-4">
            <span>{checkedIds.size} selected</span>
            <button onClick={handleBulkComingSoon} className="text-white/80 hover:text-white transition-colors">
              Download
            </button>
            <button onClick={handleBulkComingSoon} className="text-white/80 hover:text-white transition-colors">
              Send reminder
            </button>
            <button onClick={clearChecked} className="ml-auto text-white/60 hover:text-white transition-colors">
              Clear
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="h-6 w-6 mb-2 animate-pulse" />
              <p className="text-sm">Loading documents…</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <FileSignature className="h-10 w-10 text-slate-300 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">No documents found</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {documents.length === 0
                  ? 'Documents you send for signature will show up here.'
                  : 'Try a different search or filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <colgroup>
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checkedIds.size > 0 && checkedIds.size === filteredDocuments.length}
                        onChange={toggleCheckAll}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Document</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Initiator</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Progress</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending on</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((document) => (
                    <DocumentTableRow
                      key={document.id}
                      document={document}
                      currentUser={currentUser}
                      isChecked={checkedIds.has(document.id)}
                      onCheck={toggleCheck}
                      onOpen={handleSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${selectedId ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={handleCloseDetail}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl overflow-y-auto transition-transform duration-300 ${selectedId ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedId && (
          <div className="p-6">
            {isDetailLoading || !detail ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Loading…</div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {detail.fileName} <span className="text-slate-400 font-normal">v{detail.version}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {detail.steps.length} signer{detail.steps.length === 1 ? '' : 's'} · sequential order
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={detail.status} />
                    <button onClick={handleCloseDetail} className="text-slate-400 hover:text-slate-700 transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {detail.status === 'declined' ? (
                  <DeclineResolutionPanel document={detail} onRefresh={handleRefresh} />
                ) : (
                  <div className="mt-5">
                    <StepsTimeline steps={detail.steps} />
                    {detail.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> All signatures collected and sealed.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}