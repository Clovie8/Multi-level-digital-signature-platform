import MoveModal from '../../components/folders/MoveModal';
import ShareModal from '../../components/folders/ShareModal';
import ContextMenu from '../../components/folders/ContextMenu';
import { DndContext, useDraggable, useDroppable, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay, KeyboardSensor } from '@dnd-kit/core';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { FileSignature, RotateCcw, Layers, Ban, Clock, CheckCircle2, AlertTriangle, UploadCloud, X, Plus, Search, Eye, Bell, Download, Pencil, History, MoreVertical, Info, Loader2, LayoutGrid, List, Folder, Trash2, HomeIcon } from 'lucide-react';

const STATUS_META = {
  draft: { label: 'Draft', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' },
  pending: { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  in_progress: { label: 'In progress', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  pending_review: { label: 'Awaiting your review', dot: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
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

function VoidModal({ isOpen, title, message, isDraft, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in" onClick={onCancel}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">{message}</p>
          
          {!isDraft && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Reason for voiding</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Explain why you are voiding this document..."
              />
            </div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/50 rounded-md transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(isDraft ? null : reason);
              setReason('');
            }}
            disabled={!isDraft && !reason.trim()}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50"
          >
            {isDraft ? 'Delete' : 'Void Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${meta.bg} ${meta.text}`}>
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
  if (document.status === 'pending_review') {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {currentUser?.initials || 'Y'}
        </div>
        <span className="text-xs font-semibold text-slate-900 truncate">You (review)</span>
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

function VersionHistoryModal({ documentId, onClose, onOpenVersion }) {
  const [versions, setVersions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/documents/${documentId}/versions`);
        setVersions(res.data.versions);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load version history.');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [documentId, onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-slate-900">Version history</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">Every version this document has gone through, oldest first.</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="space-y-2">
            {(versions || []).map((v) => (
              <button
                key={v.id}
                onClick={() => { onOpenVersion(v.id); onClose(); }}
                className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">Version {v.version}</span>
                  <StatusPill status={v.status} />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(v.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {v.declineReason && (
                  <p className="text-xs text-slate-600 italic mt-1.5">
                    Declined by <span className="font-medium">{v.declinedBy}</span>: "{v.declineReason}"
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RowActions({ document, currentUser, onView, onVoided, onContextMenuAction }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
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
      setOpenUpward(spaceBelow < 240);
    }
    setIsMenuOpen((prev) => !prev);
  };

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
      const response = await fetch(res.data.url);
      if (!response.ok) throw new Error('Failed to fetch file for download');
      
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.fileName || 'document.pdf';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error(err.message || 'Could not download this document.');
    } finally {
      setIsDownloading(false);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState(null);

  const isDraft = document.status === 'draft';

  const handleVoid = () => {
    setConfirmDialog({
      title: isDraft ? 'Delete Draft' : 'Void Document',
      message: isDraft
        ? `Delete "${document.fileName}"? This permanently removes it — it will not show up anywhere and cannot be recovered.`
        : `Void "${document.fileName}"? This cannot be undone, and any remaining signers will be notified.`,
      isDraft,
      action: async (reason) => {
        setConfirmDialog(null);
        setIsMenuOpen(false);
        setIsVoiding(true);
        try {
          const res = await api.post(`/api/documents/${document.id}/void`, { reason });
          toast.success(res.data.message);
          onVoided?.();
        } catch (err) {
          toast.error(err.response?.data?.error || `Could not ${isDraft ? 'delete' : 'void'} this document.`);
        } finally {
          setIsVoiding(false);
        }
      }
    });
  };

  const menuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const dangerMenuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  const VOIDABLE_STATUSES = ['draft', 'pending', 'in_progress', 'pending_review', 'declined'];

  const items = [];
    if (document.status === 'draft') {
      items.push({ key: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/upload?edit=${document.id}`) });
    } else {
      items.push({ key: 'details', label: 'Details', icon: Info, onClick: () => onView(document.id) });
      const isInitiatorReviewing = document.status === 'pending_review' && document.initiatorId === currentUser?.id;
      const isInitiatorDeclined = document.status === 'declined' && document.initiatorId === currentUser?.id;
      
      let reviewUrl;
      if (isInitiatorReviewing) {
        reviewUrl = `/review/${document.id}`;
      } else if (isInitiatorDeclined) {
        reviewUrl = `/review/${document.id}?mode=resume`;
      } else {
        reviewUrl = `/review/${document.id}?mode=preview`;
      }
      
      items.push({ key: 'review', label: 'Review', icon: Eye, onClick: () => navigate(reviewUrl) });
    }
  if (document.pendingSignerToken) {
    items.push({ 
      key: 'sign', 
      label: 'Sign Document', 
      icon: FileSignature, 
      onClick: () => window.open(`/sign/${document.pendingSignerToken}`,'_blank','noopener,noreferrer') 
    });
  }
  if ((document.status === 'in_progress' || document.status === 'pending') && !document.pendingSignerToken) {
    items.push({ key: 'remind', label: isSendingReminder ? 'Sending…' : 'Send reminder', icon: Bell, onClick: handleSendReminder, disabled: isSendingReminder });
  }
  if (document.status === 'completed') {
    items.push({ 
      key: 'download', 
      label: isDownloading ? 'Downloading...' : 'Download', 
      icon: isDownloading ? Loader2 : Download, 
      onClick: handleDownload, 
      disabled: isDownloading,
      spinIcon: isDownloading // we can add a custom spin class if we modify the render, but wait! Let's just use icon mapping
    });
  }
  items.push({ key: 'versions', label: 'Version history', icon: History, onClick: () => setIsVersionModalOpen(true) });
  if (VOIDABLE_STATUSES.includes(document.status)) {
    const voidLabel = isVoiding ? (isDraft ? 'Deleting…' : 'Voiding…') : (isDraft ? 'Delete' : 'Void');
    items.push({ key: 'void', label: voidLabel, icon: Ban, onClick: handleVoid, disabled: isVoiding, danger: true });
  }


  items.push({ separator: true });
  // items.push({ key: 'rename', label: 'Rename', icon: Pencil, onClick: () => { onContextMenuAction('rename', { ...document, type: 'document' }) } });
  if (document.initiatorId === currentUser?.id) {
    items.push({ key: 'move', label: 'Move to...', icon: Folder, onClick: () => { onContextMenuAction('move', { ...document, type: 'document' }) } });
    items.push({ key: 'delete', label: 'Delete', icon: Trash2, onClick: () => { onContextMenuAction('delete', { ...document, type: 'document' }) }, danger: true });
  }

  return (
    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          onClick={toggleMenu}
          title="Actions"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {isMenuOpen && (
          <div className={`absolute right-0 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            {items.map((item, idx) => item.separator ? (
              <div key={`sep-${idx}`} className="h-px bg-slate-100 my-1 mx-2" />
            ) : (
              <button
                key={item.key}
                className={item.danger ? dangerMenuItemCls : menuItemCls}
                disabled={item.disabled}
                onClick={(e) => { 
                  e.stopPropagation();
                  item.onClick(); 
                }}
              >
                <item.icon className={`h-4 w-4 ${item.danger ? 'text-red-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <VoidModal 
        isOpen={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        isDraft={confirmDialog?.isDraft}
        onConfirm={confirmDialog?.action}
        onCancel={() => setConfirmDialog(null)}
      />

      {isVersionModalOpen && (
        <VersionHistoryModal
          documentId={document.id}
          onClose={() => setIsVersionModalOpen(false)}
          onOpenVersion={onView}
        />
      )}
    </div>
  );
}

function DocumentTableRow({ document, currentUser, isChecked, onCheck, onOpen, onVoided, setContextMenu, onContextMenuAction }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `doc-${document.id}`,
    data: { type: 'document', item: document }
  });

  const isDeclined = document.status === 'declined';

  return (
    <tr ref={setNodeRef} {...attributes} {...listeners} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: { ...document, type: 'document' } }); }} onClick={() => onOpen(document.id)} className={`${isDragging ? 'opacity-50' : ''} cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${isDeclined ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50'
        }`}
    >
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onCheck(document.id)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
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
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {generateInitials(document.initiatorName)}
          </div>
          <span className="text-xs font-semibold text-slate-900 truncate">
            {document.initiatorId === currentUser?.id ? 'You' : (document.initiatorName || 'Unknown')}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
        {new Date(document.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-3 py-2">
        <ProgressDots document={document} />
      </td>
      <td className="px-3 py-2 min-w-0">
        <PendingOnCell document={document} currentUser={currentUser} />
      </td>
      <td className="px-3 py-2">
        <StatusPill status={document.status} />
      </td>
      <td className="px-3 py-2">
        <RowActions document={document} currentUser={currentUser} onView={onOpen} onVoided={onVoided} onContextMenuAction={onContextMenuAction} />
      </td>
    </tr>
  );
}

function StepsTimeline({ documentId, isInitiator, steps, documentCreatedAt, documentUpdatedAt, onRefresh }) {
  const [editingStepId, setEditingStepId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditSave = async (stepId) => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/api/documents/${documentId}/steps/${stepId}`, editForm);
      toast.success('Signer updated successfully!');
      setEditingStepId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update signer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 mt-4">
      {steps.map((step, index) => {
        const isSigned = step.status === 'completed';
        const isDeclined = step.status === 'declined';
        const isPending = step.status === 'pending';
        
        // Calculate when it reached this user (either document start or previous step signed time)
        const reachedAt = step.reachedAt || (index === 0 ? documentCreatedAt : steps[index - 1]?.signedAt);
        
        // Calculate average turnaround time
        let turnaroundTime = null;
        if (reachedAt && step.signedAt) {
          const diffMs = new Date(step.signedAt).getTime() - new Date(reachedAt).getTime();
          const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
          const hrs = Math.floor(totalSeconds / 3600);
          const mins = Math.floor((totalSeconds % 3600) / 60);
          const secs = totalSeconds % 60;
          const pad = (num) => String(num).padStart(2, '0');
          turnaroundTime = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }

        const formatDate = (dateString) => {
          if (!dateString) return '—';
          return new Date(dateString).toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          });
        };

        return (
          <div
            key={step.id}
            className={`p-3 rounded border transition-colors flex flex-col gap-3 ${
              isSigned ? 'bg-emerald-50/50 border-emerald-200' : 
              isDeclined ? 'bg-red-50/50 border-red-200' : 
              'bg-slate-50 border-slate-200 shadow-sm'
            }`}
          >
            {/* Top Section: Left (Info) and Right (Dates) */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              {/* Left Column: Status Badge, Step, Name, Email */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Signer {step.stepOrder}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xl tracking-wide ${
                    isSigned ? 'bg-emerald-100 text-emerald-700' : 
                    isDeclined ? 'bg-red-100 text-red-700' : 
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {isSigned ? 'Signed' : isDeclined ? 'Declined' : 'Pending'}
                  </span>
                  {isInitiator && isPending && editingStepId !== step.id && (
                    <button
                      onClick={() => {
                        setEditingStepId(step.id);
                        setEditForm({ name: step.signerName, email: step.signerEmail });
                      }}
                      className="ml-2 text-slate-400 hover:text-teal-600 transition-colors"
                      title="Edit Signer"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div>
                  {editingStepId === step.id ? (
                    <div className="mt-2 space-y-2">
                      <input 
                        type="text" 
                        value={editForm.name} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})} 
                        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-teal-500 focus:border-teal-500"
                        placeholder="Signer Name"
                      />
                      <input 
                        type="email" 
                        value={editForm.email} 
                        onChange={e => setEditForm({...editForm, email: e.target.value})} 
                        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-teal-500 focus:border-teal-500"
                        placeholder="Signer Email"
                      />
                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => handleEditSave(step.id)} 
                          disabled={isSubmitting} 
                          className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingStepId(null)} 
                          disabled={isSubmitting} 
                          className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-900">{step.signerName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{step.signerEmail}</p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Right Column: Reached, Signed, Turnaround */}
              <div className="flex flex-col gap-1 sm:text-right text-[11px] text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400 uppercase tracking-wide text-[9px] mr-1.5">Reached:</span> 
                  <span className="font-medium text-slate-800">{formatDate(reachedAt)}</span>
                </div>
                
                {isSigned && (
                  <div>
                    <span className="font-semibold text-slate-400 uppercase tracking-wide text-[9px] mr-1.5">Signed:</span> 
                    <span className="font-medium text-slate-800">{formatDate(step.signedAt)}</span>
                  </div>
                )}

                {isDeclined && (
                  <div>
                    <span className="font-semibold text-slate-400 uppercase tracking-wide text-[9px] mr-1.5">Declined:</span> 
                    <span className="font-medium text-slate-800">{formatDate(step.updatedAt || step.signedAt || documentUpdatedAt)}</span>
                  </div>
                )}
                
                {isSigned && turnaroundTime && (
                  <div>
                    <span className="font-semibold text-slate-400 uppercase tracking-wide text-[9px] mr-1.5">Turnaround:</span> 
                    <span className="font-medium text-slate-800">{turnaroundTime}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Full Width Banners (Reason, Reminded) */}
            {isDeclined && step.declineReason && (
              <div className="p-2 bg-red-50 rounded-lg border border-red-100 w-full mt-1">
                <span className="font-bold text-red-600 uppercase tracking-wide text-[9px] mr-1.5">Decline Reason:</span> 
                <span className="font-medium text-red-800 text-xs italic">"{step.declineReason}"</span>
              </div>
            )}
            
            {step.lastReminderSentAt && !isSigned && !isDeclined && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 w-full mt-1">
                <span className="font-bold text-amber-600 uppercase tracking-wide text-[9px] mr-1.5">Last Reminded:</span> 
                <span className="font-medium text-amber-800 text-xs">{formatDate(step.lastReminderSentAt)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviseModal({ document, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/documents/${document.id}/revise`);
      navigate(`/upload?edit=${res.data.documentId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create the revision draft.');
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
          A new draft version of <span className="font-medium text-slate-700">{document.fileName}</span> will be created. You will be taken to the editor where you can upload a new file, change signers, or adjust fields before sending.
        </p>

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

function ReviewPanel({ document, onRefresh }) {
  const navigate = useNavigate();
  const [isApproving, setIsApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApprove = async () => {
    setShowConfirm(false);
    setIsApproving(true);
    try {
      const res = await api.post(`/api/documents/${document.id}/approve`);
      toast.success(res.data.message);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not approve this document.');
    } finally {
      setIsApproving(false);
    }
  };

  const signerCount = document.steps.length;

  return (
    <div className="mt-5">
      <StepsTimeline documentId={document.id} isInitiator={true} steps={document.steps} documentCreatedAt={document.createdAt} onRefresh={onRefresh} />

      <div className="mt-5 border border-teal-200 bg-teal-50 rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-teal-600 flex-shrink-0">
            <Eye className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-teal-900">Ready for your review</h4>
        </div>
        <p className="text-xs text-teal-800 leading-relaxed">
          All {signerCount} signer{signerCount === 1 ? '' : 's'} have completed their part.
        </p>

        <button
          onClick={() => navigate(`/review/${document.id}`)}
          className="w-full flex flex-col items-center gap-2 mt-4 mb-3 py-6 bg-white border border-teal-200 rounded-lg hover:border-teal-400 transition-colors"
        >
          <FileSignature className="h-8 w-8 text-slate-300" />
          <span className="text-sm font-semibold text-blue-600">Preview document →</span>
        </button>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={isApproving}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isApproving ? 'Approving…' : 'Approve & finalize'}
        </button>
      </div>

      <ConfirmModal 
        isOpen={showConfirm}
        title="Approve Document"
        message="Approve and finalize this document? It will be sealed and emailed to everyone."
        confirmText="Approve and Seal"
        isDanger={false}
        onConfirm={handleApprove}
        onCancel={() => setShowConfirm(false)}
      />

      <div className="flex items-start gap-2 mt-3 p-3 bg-slate-50 rounded-lg">
        <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Approving appends the final audit trail, seals the document, and emails the sealed copy to all {signerCount} signer{signerCount === 1 ? '' : 's'} plus you.
        </p>
      </div>
    </div>
  );
}

function DeclineResolutionPanel({ document, onRefresh }) {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);

  const declinedStep = document.steps.find((s) => s.status === 'declined');
  const resumeCount = document.resumeCount;
  const resumeLimitReached = resumeCount >= 3;
  const declineNumber = resumeCount + 1;

  const handleResume = () => {
    navigate(`/review/${document.id}?mode=resume`);
  };

  const handleConfirmVoid = async (reason) => {
    setVoidModalOpen(false);
    setIsVoiding(true);
    try {
      const res = await api.post(`/api/documents/${document.id}/void`, { reason });
      toast.success(res.data.message);
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

      <StepsTimeline documentId={document.id} isInitiator={true} steps={document.steps} documentCreatedAt={document.createdAt} onRefresh={onRefresh} />

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
            onClick={() => setVoidModalOpen(true)}
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
        />
      )}

      <VoidModal 
        isOpen={voidModalOpen}
        title="Void Document"
        message={`Void "${document.fileName}"? This cannot be undone, and any remaining signers will be notified.`}
        isDraft={false}
        onConfirm={handleConfirmVoid}
        onCancel={() => setVoidModalOpen(false)}
      />
    </div>
  );
}

const TABS = [
  { key: 'all', label: 'All documents' },
  { key: 'sent_by_you', label: 'Documents by you' },
  { key: 'signed_by_me', label: 'Signed by me' },
  { key: 'needs_decision', label: 'Needs your decision' },
];

const STATUS_FILTER_OPTIONS = ['all', ...Object.keys(STATUS_META)];


function FolderTableRow({ folder, isChecked, onCheck, onOpen, setContextMenu }) {
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', item: folder }
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder', item: folder }
  });

  const setRefs = (node) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  return (
    <tr ref={setRefs} {...attributes} {...listeners} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: { ...folder, type: 'folder' } }); }} onDoubleClick={() => onOpen(folder)} className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500 z-10' : ''}`}>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        {/* Empty Checkbox Column */}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3" onPointerDown={(e) => { e.stopPropagation(); onOpen(folder); }}>
          <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900">{folder.name}</div>
            <div className="text-xs text-slate-500">Folder</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-slate-500"></td>
      <td className="px-3 py-3 text-sm text-slate-500"></td>
      <td className="px-3 py-3 text-sm text-slate-500"></td>
      <td className="px-3 py-3 text-sm text-slate-500"></td>
      <td className="px-3 py-3 text-sm text-slate-500"></td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({ x: rect.right - 150, y: rect.bottom, item: { ...folder, type: 'folder' } });
            }}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

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

  
  
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const item = active.data.current?.item;
    const type = active.data.current?.type;

    if (item) {
      setActiveDragItem({ item, type });
      if (checkedIds.has(item.id)) {
        setIsDraggingSelection(true);
      } else {
        setIsDraggingSelection(false);
      }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setIsDraggingSelection(false);

    if (!over) return;

    const sourceItem = active.data.current?.item;
    const sourceType = active.data.current?.type;
    const destFolder = over.data.current?.item;

    if (!sourceItem || !destFolder) return;

    if (sourceType === 'folder' && sourceItem.id === destFolder.id) return;

    if (checkedIds.has(sourceItem.id) && checkedIds.size > 1) {
      // Bulk move
      const itemsToMove = Array.from(checkedIds).map(id => {
        const doc = documents.find(d => d.id === id);
        if (doc) return { id, type: 'document' };
        const f = folders.find(f => f.id === id);
        if (f) return { id, type: 'folder' };
        return null;
      }).filter(Boolean);

      try {
        await api.put('/api/folders/move-bulk', {
          items: itemsToMove,
          destinationFolderId: destFolder.id
        });
        clearChecked();
        fetchDocuments();
        fetchFolders();
      } catch (err) {
        console.error(err);
        const code = err.response?.data?.error;
        let msg = code || 'Failed to move items';
        if (code === 'NO_WRITE_ACCESS_DESTINATION') msg = 'You do not have privileges to move items into this folder.';
        if (code === 'NO_WRITE_ACCESS_SOURCE') msg = 'You do not have privileges to move items out of their current folder.';
        if (code === 'NOT_OWNER') msg = 'You do not have privileges to move this item.';
        if (code === 'CIRCULAR_DEPENDENCY') msg = 'You cannot move a folder into its own subfolder.';
        toast.error(msg);
      }
    } else {
      // Single move
      try {
        await api.put('/api/folders/move', {
          itemId: sourceItem.id,
          itemType: sourceType,
          destinationFolderId: destFolder.id
        });
        fetchDocuments();
        fetchFolders();
      } catch (err) {
        console.error(err);
        const code = err.response?.data?.error;
        let msg = code || 'Failed to move item';
        if (code === 'NO_WRITE_ACCESS_DESTINATION') msg = 'You do not have privileges to move items into this folder.';
        if (code === 'NO_WRITE_ACCESS_SOURCE') msg = 'You do not have privileges to move items out of their current folder.';
        if (code === 'NOT_OWNER') msg = 'You do not have privileges to move this item.';
        if (code === 'CIRCULAR_DEPENDENCY') msg = 'You cannot move a folder into its own subfolder.';
        toast.error(msg);
      }
    }
  };

  
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isRenameFolderModalOpen, setIsRenameFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [folders, setFolders] = useState([]);

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedItemsForMove, setSelectedItemsForMove] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  const [activeDragItem, setActiveDragItem] = useState(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  
  
  
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder? All contents will be deleted.')) return;
    try {
      await api.delete('/api/folders/' + folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (currentFolderId === folderId) setCurrentFolderId(null);
      toast.success('Folder deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete folder');
    }
  };

  const handleRenameFolder = async (e) => {
    e.preventDefault();
    if (!renameFolderName.trim() || !folderToRename) return;

    try {
      const res = await api.put(`/api/folders/${folderToRename.id}/rename`, {
        name: renameFolderName
      });
      
      const updatedFolder = res.data.folder || res.data;
      setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
      setFolderToRename(null);
      setRenameFolderName('');
      setIsRenameFolderModalOpen(false);
      toast.success('Folder renamed successfully');
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error(error.response?.data?.error || 'Failed to rename folder');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await api.post('/api/folders', {
        name: newFolderName,
        parentId: currentFolderId
      });
      
      const newFolder = res.data.folder || res.data;
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setIsCreateFolderModalOpen(false);
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Error creating folder:', error);
      if (error.response?.data?.error === 'NO_WRITE_ACCESS') {
        toast.error('You do not have privileges to create a folder inside this shared folder as a viewer.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to create folder');
      }
    }
  };

  const handleOpenFolder = (folder) => {
    setCurrentFolderId(folder.id);
  };

  const handleContextMenuAction = (action, item) => {
    if (action === 'open') {
      if (item.type === 'folder') handleOpenFolder(item);
      else setDetail(item);
    } else if (action === 'rename') {
      if (item.type === 'folder') {
        setFolderToRename(item);
        setRenameFolderName(item.name);
        setIsRenameFolderModalOpen(true);
      } else {
        toast.info('Document renaming coming soon');
      }
    } else if (action === 'move') {
      setSelectedItemsForMove([item]);
      setIsMoveModalOpen(true);
    } else if (action === 'share' && item.type === 'folder') {
      setShareFolderId(item.id);
      setIsShareModalOpen(true);
    } else if (action === 'delete') {
      if (item.type === 'folder') {
        handleDeleteFolder(item.id);
      } else {
        toast.info('Document deletion coming soon');
      }
    }
    setContextMenu(null);
  };

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareFolderId, setShareFolderId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, searchQuery]);


  
  const fetchFolders = async () => {
    try {
      const res = await api.get('/api/folders/all');
      setFolders(res.data.folders || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load folders');
    }
  };

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
    fetchFolders();
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

  const currentFolderDocs = useMemo(() => {
    return documents.filter(d => {
      const docFolderId = d.folder_id || d.folderId;
      if (currentFolderId) return docFolderId === currentFolderId;
      return !docFolderId;
    });
  }, [documents, currentFolderId]);

  const needsDecisionCount = useMemo(
    () => currentFolderDocs.filter((d) => d.status === 'declined' || d.status === 'pending_review').length,
    [currentFolderDocs]
  );

  const signedByMeCount = useMemo(
    () => currentFolderDocs.filter((d) => d.hasSigned).length,
    [currentFolderDocs]
  );

  const sentByYouCount = useMemo(
    () => currentFolderDocs.filter((d) => !d.initiatorId || d.initiatorId === currentUser?.id).length,
    [currentFolderDocs, currentUser]
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      // 1. Check folder matching
      const docFolderId = d.folder_id || d.folderId;
      if (currentFolderId) {
        if (docFolderId !== currentFolderId) return false;
      } else {
        if (docFolderId) return false;
      }
      
      // 2. Check other filters
      if (activeTab === 'needs_decision' && !['declined', 'pending_review'].includes(d.status)) return false;
      if (activeTab === 'sent_by_you' && d.initiatorId && d.initiatorId !== currentUser?.id) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (searchQuery && !d.fileName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (activeTab === 'signed_by_me' && !d.hasSigned) return false;
      return true;
    });
  }, [documents, activeTab, statusFilter, searchQuery, currentUser, currentFolderId]);

  const paginatedDocuments = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocuments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);


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

  const checkedDocuments = useMemo(
    () => documents.filter((d) => checkedIds.has(d.id)),
    [documents, checkedIds]
  );

  
  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let curr = folders.find(f => f.id === currentFolderId);
    while (curr) {
      crumbs.unshift(curr);
      curr = folders.find(f => f.id === (curr.parent_folder_id || curr.parentId || curr.parent_id));
    }
    return crumbs;
  }, [currentFolderId, folders]);

  const currentLevelFolders = folders.filter(f => 
    currentFolderId ? (f.parent_folder_id === currentFolderId || f.parentId === currentFolderId || f.parent_id === currentFolderId) : (!f.parent_folder_id && !f.parentId && !f.parent_id)
  );

  const canBulkDownload = checkedDocuments.length > 0 && checkedDocuments.every((d) => d.status === 'completed');
  const canBulkRemind = checkedDocuments.length > 0 && checkedDocuments.every((d) => ['pending', 'in_progress'].includes(d.status));

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
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New document
          </button>
        </div>

        <div className="flex gap-6 border-b border-slate-200 mb-5">
          {TABS.map((tab) => {
            const count = tab.key === 'all'
              ? currentFolderDocs.length
              : tab.key === 'sent_by_you'
                ? sentByYouCount
                : tab.key === 'signed_by_me'
                ? signedByMeCount
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

        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentFolderId(null)} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!currentFolderId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><HomeIcon className="h-4 w-4" /> Root</button>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                <span className="text-slate-400">/</span>
                <button 
                  onClick={() => setCurrentFolderId(crumb.id)} 
                  className={`flex items-center gap-0.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${index === breadcrumbs.length - 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Folder className="h-4 w-4" />
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <button onClick={() => setIsCreateFolderModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium">
            <Folder className="h-4 w-4" /> New Folder
          </button>
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
            {canBulkDownload && (
              <button onClick={handleBulkComingSoon} className="text-white/80 hover:text-white transition-colors">
                Download
              </button>
            )}
            {canBulkRemind && (
              <button onClick={handleBulkComingSoon} className="text-white/80 hover:text-white transition-colors">
                Send reminder
              </button>
            )}
            <button onClick={clearChecked} className="ml-auto text-white/60 hover:text-white transition-colors">
              Clear
            </button>
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="h-6 w-6 mb-2 animate-pulse" />
              <p className="text-sm">Loading documents…</p>
            </div>
          ) : filteredDocuments.length === 0 && currentLevelFolders.length === 0 ? (
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
            <>
            <div className="overflow-visible min-h-[250px]">
              <table className="w-full text-left table-fixed">
                <colgroup>
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '5%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={checkedIds.size > 0 && checkedIds.size === filteredDocuments.length}
                        onChange={toggleCheckAll}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Document</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Initiator</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Progress</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending on</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                   
                    {currentLevelFolders.map(folder => (
                      <FolderTableRow
                        key={folder.id}
                        folder={folder}
                        isChecked={checkedIds.has(folder.id)}
                        onCheck={toggleCheck}
                        onOpen={handleOpenFolder}
                        setContextMenu={setContextMenu}
                      />
                    ))}

                    {paginatedDocuments.map((document) => (
                    <DocumentTableRow
                      key={document.id}
                      document={document}
                      currentUser={currentUser}
                      isChecked={checkedIds.has(document.id)}
                      onCheck={toggleCheck}
                      onOpen={handleSelect}
                      onVoided={handleRefresh}
                      setContextMenu={setContextMenu}
                      onContextMenuAction={handleContextMenuAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-sm font-medium text-slate-700 border border-slate-200 rounded-md py-1 px-2 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-slate-500">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-50 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-slate-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-50 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
            </>

          )}
        </div>
        </DndContext>
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
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Initiated on {new Date(detail.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
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
                ) : detail.status === 'pending_review' ? (
                  <ReviewPanel document={detail} onRefresh={handleRefresh} />
                ) : (
                  <div className="mt-5">
                    <StepsTimeline documentId={detail.id} isInitiator={currentUser?.id === detail.initiatorId} steps={detail.steps} documentCreatedAt={detail.createdAt} documentUpdatedAt={detail.updatedAt} onRefresh={handleRefresh} />
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

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} item={contextMenu.item} onClose={() => setContextMenu(null)} onAction={handleContextMenuAction} />
      )}
      
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setIsCreateFolderModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleCreateFolder} className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {currentFolderId 
                  ? `Create Subfolder inside ${folders.find(f => f.id === currentFolderId)?.name || 'Folder'}` 
                  : 'Create New Folder'}
              </h3>
              <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md mb-4 focus:ring-2 focus:ring-slate-900" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateFolderModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isRenameFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setIsRenameFolderModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleRenameFolder} className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Rename Folder
              </h3>
              <input autoFocus type="text" value={renameFolderName} onChange={e => setRenameFolderName(e.target.value)} placeholder="New folder name" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md mb-4 focus:ring-2 focus:ring-slate-900" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsRenameFolderModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                <button type="submit" disabled={!renameFolderName.trim() || renameFolderName === folderToRename?.name} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50">Rename</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <MoveModal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} selectedItems={selectedItemsForMove} currentFolderId={currentFolderId} onMoveSuccess={() => { clearChecked(); fetchDocuments(); fetchFolders(); }} />
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} folderId={shareFolderId} />
    </div>
  );
}