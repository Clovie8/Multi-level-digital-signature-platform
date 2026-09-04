import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ArrowLeft, CheckCircle2, Download } from 'lucide-react';
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

  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadReviewFile = async () => {
      try {
        const res = await api.get(`/api/documents/${id}/review`);
        setFileUrl(res.data.url);
        setFileName(res.data.fileName);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load this document for review.');
        navigate('/documents');
      } finally {
        setIsLoading(false);
      }
    };
    loadReviewFile();
  }, [id, navigate]);

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

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        <button onClick={() => navigate('/documents')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage <= 1} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{fileName} <span className="text-slate-400 font-normal">· read-only</span></span>

        <div className="flex items-center gap-3">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
            <Download className="h-4 w-4" /> Download PDF
          </a>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isApproving}
            className="flex items-center gap-1.5 py-1.5 px-4 bg-teal-600 text-white text-sm font-semibold rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isApproving ? 'Sealing...' : 'Approve and Seal'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 flex justify-center">
        {isLoading ? (
          <div className="text-slate-400 text-sm py-20">Loading document…</div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
            loading={<div className="p-20 text-slate-400">Loading document…</div>}
            error={<div className="p-20 text-red-500">Failed to load PDF.</div>}
          >
            <Page pageNumber={currentPage} width={750} renderTextLayer={false} renderAnnotationLayer={false} className="shadow-lg" />
          </Document>
        )}
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
    </div>
  );
}
