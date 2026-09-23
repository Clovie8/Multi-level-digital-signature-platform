import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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

export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreview = searchParams.get('mode') === 'preview';
  const isResume = searchParams.get('mode') === 'resume';

  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingFields, setPendingFields] = useState([]);

  const isTemplate = searchParams.get('model') === 'Template';

  useEffect(() => {
    const loadReviewFile = async () => {
      try {
        const [docRes, downloadRes] = await Promise.all([
          api.get(isTemplate ? `/api/templates/${id}` : `/api/documents/${id}`),
          api.get(isTemplate ? `/api/templates/${id}/download` : `/api/documents/${id}/download`)
        ]);

        const document = docRes.data.document;
        
        if (!isTemplate) {
          if (!isPreview && !isResume && document.status !== 'pending_review') {
            toast.error("This document is not awaiting review.", { id: 'status-error' });
            navigate('/documents');
            return;
          }

          if (isResume && document.status !== 'declined') {
            toast.error("Only declined documents can be resumed.", { id: 'status-error' });
            navigate('/documents');
            return;
          }
        }

        setFileUrl(downloadRes.data.url);
        setFileName(downloadRes.data.fileName);

        if (isTemplate) {
          // Extract template fields
          const fields = document.templateConfig?.fields || [];
          setPendingFields(fields.map(f => ({
            ...f,
            signerName: `Signer ${f.signerOrder}`,
            signerEmail: ''
          })));
        } else if (document.steps && (isPreview || isResume)) {
          let fields = [];
          document.steps.forEach(step => {
            if (step.status === 'pending' || step.status === 'in_progress' || step.status === 'declined') {
              try {
                const stepFields = typeof step.signatureUiData === 'string' 
                  ? JSON.parse(step.signatureUiData) 
                  : (step.signatureUiData || []);
                stepFields.forEach(f => {
                  fields.push({
                    ...f,
                    signerName: step.signerName,
                    signerEmail: step.signerEmail
                  });
                });
              } catch (e) {
                console.error("Failed to parse signatureUiData", e);
              }
            }
          });
          setPendingFields(fields);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load this file.');
        navigate('/documents');
      } finally {
        setIsLoading(false);
      }
    };
    loadReviewFile();
  }, [id, navigate, isPreview, isResume, isTemplate]);

  // Continuous Scroll Functions
  const handleScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop;
    
    let bestPage = 1;
    let minDistance = Infinity;

    for (let i = 1; i <= totalPages; i++) {
      const pageEl = document.getElementById(`review-page-${i}`);
      if (pageEl) {
        const distance = Math.abs(pageEl.offsetTop - scrollPosition);
        if (distance < minDistance) {
          minDistance = distance;
          bestPage = i;
        }
      }
    }

    if (bestPage !== currentPage) {
      setCurrentPage(bestPage);
    }
  };

  const scrollToPage = (pageNum) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    const pageEl = document.getElementById(`review-page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth' });
    } else {
      setCurrentPage(pageNum);
    }
  };

  const handleApprove = async () => {
    setShowConfirm(false);
    setIsApproving(true);
    try {
      const res = await api.post(`/api/documents/${id}/approve`);
      toast.success(res.data.message);
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not approve this document.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleResume = async () => {
    setShowConfirm(false);
    setIsResuming(true);
    try {
      await api.post(`/api/documents/${id}/resume`);
      toast.success('Document has been resumed. The signer has been re-notified.');
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resume this document.');
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        <button onClick={() => navigate('/documents')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => scrollToPage(Math.max(currentPage - 1, 1))} disabled={currentPage <= 1} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
          <button onClick={() => scrollToPage(Math.min(currentPage + 1, totalPages))} disabled={currentPage >= totalPages} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{fileName} <span className="text-slate-400 font-normal">· read-only</span></span>

        <div className="flex items-center gap-3">
          <button 
            disabled={isDownloading}
            onClick={async () => {
              setIsDownloading(true);
              try {
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error('Failed to fetch file');
                const blob = await response.blob();
                const objectUrl = window.URL.createObjectURL(blob);
                const link = window.document.createElement('a');
                link.href = objectUrl;
                link.download = fileName || 'document.pdf';
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                window.URL.revokeObjectURL(objectUrl);
              } catch (err) {
                toast.error('Could not download file directly.');
                window.open(fileUrl, '_blank', 'noopener,noreferrer');
              } finally {
                setIsDownloading(false);
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
          {!isPreview && !isTemplate && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isApproving || isResuming}
              className="flex items-center gap-1.5 py-1.5 px-4 bg-teal-600 text-white text-sm font-semibold rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isResume 
                ? (isResuming ? 'Resuming...' : 'Confirm & Resume')
                : (isApproving ? 'Sealing...' : 'Approve and Seal')
              }
            </button>
          )}
          {isTemplate && (
            <button
              onClick={async () => {
                try {
                  const res = await api.post(`/api/templates/${id}/use`);
                  toast.success(`Started from template.`);
                  navigate(`/upload?edit=${res.data.document.id}`);
                } catch (err) {
                  toast.error(err.response?.data?.error || 'Could not start a document from this template.');
                }
              }}
              className="flex items-center gap-1.5 py-1.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors"
            >
              Use Template
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 flex justify-center" onScroll={handleScroll}>
        {isLoading ? (
          <div className="text-slate-400 text-sm py-20">Loading document…</div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
            className="flex flex-col items-center"
            loading={
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-slate-300" />
                <p>Loading document...</p>
              </div>
            }
            error={<div className="p-20 text-red-500">Failed to load PDF.</div>}
          >
            <div className="w-[750px] flex flex-col">
              {Array.from(new Array(totalPages), (el, index) => {
                const pageIndex = index + 1;
                return (
                  <div 
                    key={`review-page-${pageIndex}`} 
                    id={`review-page-${pageIndex}`} 
                    className="relative bg-white shadow-xl mb-6 last:mb-0 aspect-[8.5/11]"
                  >
                    <Page 
                      pageNumber={pageIndex} 
                      width={750} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                      loading={<div className="w-[750px] aspect-[8.5/11] bg-slate-50 animate-pulse flex items-center justify-center text-slate-400">Loading page {pageIndex}...</div>}
                    />
                    
                    {/* Overlay Pending Signature Fields */}
                    {pendingFields.filter(f => f.page === pageIndex).map((field, idx) => (
                      <div
                        key={`pending-field-${idx}`}
                        style={{
                          position: 'absolute',
                          left: `${field.x || 0}px`,
                          top: `${field.y || 0}px`,
                          width: `${field.width || 120}px`,
                          height: `${field.height || 40}px`,
                        }}
                        className="border-2 border-dashed border-amber-500 bg-amber-100/40 rounded flex items-center justify-center pointer-events-none z-10"
                      >
                        <div className="flex flex-col text-center opacity-90 overflow-hidden w-full px-1">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate">{field.type}</span>
                          <span className="text-[9px] font-medium text-amber-600 truncate max-w-full">{field.signerName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Document>
        )}
      </div>

      <ConfirmModal 
        isOpen={showConfirm}
        title={isResume ? "Resume Document" : "Approve Document"}
        message={
          isResume 
            ? "Are you sure you want to resume this document? The signer will be notified to try again." 
            : "Approve and finalize this document? It will be sealed and emailed to everyone."
        }
        confirmText={isResume ? "Resume Document" : "Approve and Seal"}
        isDanger={false}
        onConfirm={isResume ? handleResume : handleApprove}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
