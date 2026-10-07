import { useState, useEffect, useRef } from 'react';
import { useAsyncLock } from '../../hooks/useAsyncLock';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Layers, FileSignature, Download, Loader2, Search, FileText, MoreVertical, Eye, Info, X, CheckCircle2 } from 'lucide-react';
import Select from '../../components/ui/Select';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const STATUS_META = {
  draft: { label: 'Draft', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' },
  pending: { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  in_progress: { label: 'In progress', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  pending_review: { label: 'Review', dot: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  declined: { label: 'Declined', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  superseded: { label: 'Superseded', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  voided: { label: 'Voided', dot: 'bg-slate-300', text: 'text-white', bg: 'bg-slate-800' },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function RowActions({ document, onView }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  
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
      setOpenUpward(spaceBelow < 200);
    }
    setIsMenuOpen((prev) => !prev);
  };

  const [handleDownload, isDownloading] = useAsyncLock(async () => {
    
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
      setIsMenuOpen(false);
    } catch (err) {
      toast.error(err.message || 'Could not download this document.');
    }
  });

  const menuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

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
            <button
              className={menuItemCls}
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); navigate(`/review/${document.id}?mode=preview&from=admin`); }}
            >
              <Eye className="h-4 w-4 text-slate-400" />
              Review
            </button>
            <button
              className={menuItemCls}
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onView(document.id); }}
            >
              <Info className="h-4 w-4 text-slate-400" />
              Details
            </button>
            <button
              className={menuItemCls}
              disabled={isDownloading}
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin" /> : <Download className="h-4 w-4 text-slate-400" />}
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateRowActions({ template }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => window.document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!isMenuOpen && buttonRef.current) {
      const spaceBelow = window.innerHeight - buttonRef.current.getBoundingClientRect().bottom;
      setOpenUpward(spaceBelow < 200);
    }
    setIsMenuOpen((prev) => !prev);
  };

  const menuItemCls = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

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
            <button
              className={menuItemCls}
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); navigate(`/review/${template.id}?mode=preview&model=Template&from=admin`); }}
            >
              <Eye className="h-4 w-4 text-slate-400" />
              Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllDocuments() {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'templates'
  const [data, setData] = useState({ documents: [], templates: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Right sidebar state
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, sortOrder, statusFilter, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    fetchSystemFiles();
  }, []);

  const fetchSystemFiles = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/api/admin/all-files');
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load system files.');
    } finally {
      setIsLoading(false);
    }
  };

  const [handleOpenDetail, isDetailLoading] = useAsyncLock(async (id) => {
    setSelectedId(id);
    
    try {
      const res = await api.get(`/api/documents/${id}`);
      setDetail(res.data.document);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load document details.');
      setSelectedId(null);
    }
  });

  const handleCloseDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  let filteredDocuments = data.documents.filter(d => {
    let matchesDate = true;
    if (dateRangeStart || dateRangeEnd) {
      const docDate = new Date(d.updatedAt);
      if (dateRangeStart) {
        matchesDate = docDate >= new Date(dateRangeStart);
      }
      if (matchesDate && dateRangeEnd) {
        const end = new Date(dateRangeEnd);
        end.setHours(23, 59, 59, 999);
        matchesDate = docDate <= end;
      }
    }
    
    return matchesDate &&
      (d.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.initiatorEmail?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === 'all' || d.status === statusFilter);
  });

  let filteredTemplates = data.templates.filter(t => {
    let matchesDate = true;
    if (dateRangeStart || dateRangeEnd) {
      const docDate = new Date(t.updatedAt);
      if (dateRangeStart) {
        matchesDate = docDate >= new Date(dateRangeStart);
      }
      if (matchesDate && dateRangeEnd) {
        const end = new Date(dateRangeEnd);
        end.setHours(23, 59, 59, 999);
        matchesDate = docDate <= end;
      }
    }

    return matchesDate && 
      (t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.creatorEmail?.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Sorting
  const sortFn = (a, b) => {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  };
  
  filteredDocuments = filteredDocuments.sort(sortFn);
  filteredTemplates = filteredTemplates.sort(sortFn);

  const currentData = activeTab === 'documents' ? filteredDocuments : filteredTemplates;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  const handleExportCSV = () => {
    let csvContent = '';
    const date = new Date().toISOString().split('T')[0];

    if (activeTab === 'documents') {
      const headers = ['File Name', 'Status', 'Initiator Name', 'Initiator Email', 'Signers Count', 'Active Signer', 'Last Updated'];
      csvContent += headers.join(',') + '\n';
      filteredDocuments.forEach(doc => {
        const row = [
          `"${doc.fileName || 'Untitled'}"`,
          doc.status,
          `"${doc.initiatorName}"`,
          doc.initiatorEmail,
          doc.signerCount,
          doc.activeSigner || 'None',
          doc.updatedAt
        ];
        csvContent += row.join(',') + '\n';
      });
    } else {
      const headers = ['Template Name', 'Creator Name', 'Creator Email', 'Signers Required', 'Usage Count', 'Last Updated'];
      csvContent += headers.join(',') + '\n';
      filteredTemplates.forEach(t => {
        const row = [
          `"${t.name || 'Untitled'}"`,
          `"${t.creatorName}"`,
          t.creatorEmail,
          t.signerCount,
          t.usageCount,
          t.updatedAt
        ];
        csvContent += row.join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_${activeTab}_report_${date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Admin / Files</p>
              <h1 className="text-2xl font-semibold text-slate-900">All System Files</h1>
              <p className="text-sm text-slate-500 mt-0.5">Global read-only access to all platform documents and templates.</p>
            </div>
          </div>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Report (CSV)
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex space-x-2 border-b border-slate-200 pb-2 w-full">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'documents' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4" />
              Documents
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${activeTab === 'documents' ? 'bg-slate-200' : 'bg-slate-100'}`}>
                {data.documents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'templates' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileSignature className="h-4 w-4" />
              Templates
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${activeTab === 'templates' ? 'bg-slate-200' : 'bg-slate-100'}`}>
                {data.templates.length}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full flex-wrap">
            {activeTab === 'documents' && (
              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'Status: All' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'pending_review', label: 'Review' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'declined', label: 'Declined' },
                  { value: 'superseded', label: 'Superseded' },
                  { value: 'voided', label: 'Voided' }
                ]}
                className="w-36"
              />
            )}
            <Select
              value={sortOrder}
              onChange={(val) => setSortOrder(val)}
              options={[
                { value: 'newest', label: 'Sort: Newest first' },
                { value: 'oldest', label: 'Sort: Oldest first' }
              ]}
              className="w-40"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="w-32 sm:w-36 py-2 px-2.5 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 text-slate-600"
                title="Start Date"
              />
              <span className="text-slate-400 text-sm">-</span>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="w-32 sm:w-36 py-2 px-2.5 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 text-slate-600"
                title="End Date"
              />
            </div>
            <div className="relative flex-1 sm:w-56 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 mb-3 animate-spin text-slate-300" />
              <p className="text-sm font-medium">Fetching global file registry…</p>
            </div>
          ) : activeTab === 'documents' ? (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">File Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Initiator</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Active Signer</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Last Updated</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocuments.map((doc) => (
                    <tr 
                      key={doc.id} 
                      onClick={() => handleOpenDetail(doc.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{doc.fileName || 'Untitled Document'}</p>
                            <p className="text-xs text-slate-500">{doc.signerCount} signer{doc.signerCount !== 1 && 's'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1">
                            <StatusPill status={doc.status} />
                            {doc.dueDate && new Date(doc.dueDate) < new Date() && doc.status === 'pending' && (
                              <span className="text-[8px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>
                          {doc.dueDate && (
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              Due: {new Date(doc.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{doc.initiatorName}</p>
                        <p className="text-xs text-slate-500">{doc.initiatorEmail}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">{doc.activeSigner || '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-500">
                          {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-5 py-4 w-16 text-right">
                        <RowActions document={doc} onView={handleOpenDetail} />
                      </td>
                    </tr>
                  ))}
                  {filteredDocuments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        <FileText className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-medium">No documents found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Template Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Creator</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Signers</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Usage</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Last Updated</th>
                    <th className="px-3 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTemplates.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                            <FileSignature className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{t.name || 'Untitled Template'}</p>
                            <p className="text-xs text-slate-500">{t.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{t.creatorName}</p>
                        <p className="text-xs text-slate-500">{t.creatorEmail}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">{t.signerCount} required</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">{t.usageCount} times</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-500">
                          {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-3 py-4 w-16 text-right">
                        <TemplateRowActions template={t} />
                      </td>
                    </tr>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                        <FileSignature className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-medium">No templates found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {!isLoading && (
            <div className="mt-auto flex items-center justify-between px-5 py-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Show</span>
                <Select
                  value={itemsPerPage}
                  onChange={(val) => {
                    setItemsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 10, label: '10' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' }
                  ]}
                  className="w-20"
                />
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
          )}
        </div>
      </div>
      
      {/* Right Sidebar Details */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${selectedId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleCloseDetail}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl overflow-y-auto transition-transform duration-300 ${selectedId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedId && (
          <div className="p-6">
            {isDetailLoading || !detail ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                <Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading…
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 break-all">
                      {detail.fileName} <span className="text-slate-400 font-normal whitespace-nowrap">v{detail.version}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Initiated on {new Date(detail.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {detail.steps.length} signer{detail.steps.length === 1 ? '' : 's'} · sequential order
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <StatusPill status={detail.status} />
                    <button onClick={handleCloseDetail} className="text-slate-400 hover:text-slate-700 transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {detail.steps.map((step, index) => {
                    const isSigned = step.status === 'completed';
                    const isDeclined = step.status === 'declined';
                    
                    const reachedAt = step.reachedAt || (index === 0 ? detail.createdAt : detail.steps[index - 1]?.signedAt);
                    
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
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{step.signerName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{step.signerEmail}</p>
                            </div>
                          </div>
                          
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
                                <span className="font-medium text-slate-800">{formatDate(step.updatedAt || step.signedAt || detail.updatedAt)}</span>
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
                  
                  {detail.status === 'completed' && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md">
                      <CheckCircle2 className="h-4 w-4" /> All signatures collected and sealed.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
