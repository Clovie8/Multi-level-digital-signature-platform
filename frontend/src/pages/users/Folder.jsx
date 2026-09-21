import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { FolderOpen, LayoutTemplate, FileSignature, Search, ArrowRight, Download, Clock, CheckCircle2 } from 'lucide-react';

const TABS = [
  { key: 'templates', label: 'My Templates' },
  { key: 'signed', label: 'Signed Documents' },
];

function TemplateCard({ template, onUse, isUsing }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
          <LayoutTemplate className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{template.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {template.signerCount} signer{template.signerCount !== 1 ? 's' : ''}
            {typeof template.usageCount === 'number' ? ` · used ${template.usageCount}×` : ''}
          </p>
        </div>
      </div>
      <button
        onClick={() => onUse(template)}
        disabled={isUsing}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 flex-shrink-0 ml-4"
      >
        {isUsing ? 'Starting…' : 'Use'} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SignedDocumentRow({ document, onDownload, isDownloading }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <FileSignature className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{document.fileName}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Completed {new Date(document.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDownload(document)}
        disabled={isDownloading}
        className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:border-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50 flex-shrink-0 ml-4"
      >
        {isDownloading ? 'Loading…' : 'View certificate'} <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Folder() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('templates');
  const [searchQuery, setSearchQuery] = useState('');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [usingTemplateId, setUsingTemplateId] = useState(null);

  const [signedDocuments, setSignedDocuments] = useState([]);
  const [signedLoading, setSignedLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load templates.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchSignedDocuments = useCallback(async () => {
    setSignedLoading(true);
    try {
      const res = await api.get('/api/documents');
      const signed = (res.data.documents || []).filter(
        (d) => d.hasSigned && d.status === 'completed'
      );
      setSignedDocuments(signed);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your signed documents.');
    } finally {
      setSignedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchSignedDocuments();
  }, [fetchTemplates, fetchSignedDocuments]);

  const handleUseTemplate = async (template) => {
    setUsingTemplateId(template.id);
    try {
      const res = await api.post(`/api/templates/${template.id}/use`);
      const { document: newDoc } = res.data;
      toast.success(`Started from "${template.name}".`);
      
      navigate(`/upload?edit=${newDoc.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start a document from this template.');
    } finally {
      setUsingTemplateId(null);
    }
  };

  const handleDownloadCertificate = async (document) => {
    setDownloadingId(document.id);
    try {
      const res = await api.get(`/api/documents/${document.id}/download`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not open this certificate.');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [templates, searchQuery]
  );

  const filteredSignedDocuments = useMemo(
    () => signedDocuments.filter((d) => d.fileName.toLowerCase().includes(searchQuery.toLowerCase())),
    [signedDocuments, searchQuery]
  );

  const isLoading = activeTab === 'templates' ? templatesLoading : signedLoading;
  const items = activeTab === 'templates' ? filteredTemplates : filteredSignedDocuments;

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1000px] mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Your library</p>
          <h1 className="text-2xl font-semibold text-slate-900">Folder</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Reusable templates and everything you've signed, in one place.
          </p>
        </div>

        <div className="flex gap-6 border-b border-slate-200 mb-5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tab.key === 'templates' ? templates.length : signedDocuments.length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  isActive ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative mb-4 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search signed documents...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="h-6 w-6 mb-2 animate-pulse" />
              <p className="text-sm">Loading…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6 border border-dashed border-slate-200 rounded-xl">
              <FolderOpen className="h-10 w-10 text-slate-300 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">
                {activeTab === 'templates' ? 'No templates yet' : 'No signed documents yet'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {activeTab === 'templates'
                  ? 'Save a completed document as a template to reuse its layout here.'
                  : 'Documents you sign will show up here once they\'re fully completed.'}
              </p>
            </div>
          ) : activeTab === 'templates' ? (
            filteredTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} isUsing={usingTemplateId === t.id} />
            ))
          ) : (
            filteredSignedDocuments.map((d) => (
              <SignedDocumentRow key={d.id} document={d} onDownload={handleDownloadCertificate} isDownloading={downloadingId === d.id} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}