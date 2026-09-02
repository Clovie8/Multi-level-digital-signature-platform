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

export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
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
    if (!window.confirm('Approve and finalize this document? It will be sealed and emailed to everyone.')) return;
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

        <div className="flex items-center gap-2">
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors" title="Download">
              <Download className="h-5 w-5" />
            </a>
          )}
          <button
            onClick={handleApprove}
            disabled={isApproving || isLoading}
            className="flex items-center gap-1.5 py-2 px-4 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isApproving ? 'Approving…' : 'Approve & finalize'}
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
    </div>
  );
}
