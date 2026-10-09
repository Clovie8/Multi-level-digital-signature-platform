import { useState, useEffect, useRef } from 'react';
import { useAsyncLock } from '../../hooks/useAsyncLock';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import {
  UploadCloud, FileSignature, Plus, Trash2,
  ArrowRight, PenTool, Calendar, Type, UserSquare, ChevronLeft, ChevronRight, Search, Send, X, LayoutTemplate, Pencil, Check, Stamp, Copy, Loader2, Folder
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- TOP-LEVEL COMPONENTS (moved out of Upload to avoid remounting on every render) ---


const DraggableField = ({ icon: Icon, label, type, activeColorClasses, onDragStart }) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, type)}
    className={`flex items-center p-2 bg-white border border-slate-100 border-l-2 ${activeColorClasses.split(' ')[2].replace('-200', '-500')} rounded-md shadow-sm cursor-grab hover:shadow hover:border-slate-200 transition-all`}
  >
    <Icon className={`h-3.5 w-3.5 mr-1.5 shrink-0 ${activeColorClasses.split(' ')[1].replace('-700', '-600')}`} />
    <span className="text-[12px] font-medium text-slate-700 truncate">{label}</span>
  </div>
);

// Styling for the template picker to match the slate/white theme used everywhere else

function TemplateBrowserModal({ folders, templates, onClose, onSelect }) {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const templateFolders = folders.filter(f => f.type === 'template' && (f.parent_folder_id || null) === currentFolderId);
  const currentTemplates = templates.filter(t => (t.folder_id || null) === currentFolderId);

  const getBreadcrumbs = () => {
    const crumbs = [{ id: null, name: 'Templates Root' }];
    let curr = currentFolderId;
    const path = [];
    while (curr) {
      const f = folders.find(folder => folder.id === curr);
      if (f) {
        path.unshift({ id: f.id, name: f.name });
        curr = f.parent_folder_id;
      } else {
        break;
      }
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header & Breadcrumbs */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-blue-600" />
              Browse Templates
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 text-sm font-medium">
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id || 'root'} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`hover:text-blue-600 transition-colors ${idx === breadcrumbs.length - 1 ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Directory View */}
        <div className="flex-grow overflow-y-auto p-6 bg-white custom-scrollbar">
          {templateFolders.length === 0 && currentTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Folder className="h-12 w-12 mb-3 opacity-20" />
              <p>This folder is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Folders */}
              {templateFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex items-center gap-3 p-3 text-left border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm hover:bg-blue-50/30 transition-all group"
                >
                  <Folder className="h-6 w-6 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  <span className="font-medium text-sm text-slate-700 group-hover:text-slate-900 truncate">{folder.name}</span>
                </button>
              ))}

              {/* Templates */}
              {currentTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className={`flex items-start gap-3 p-3 text-left border rounded-lg transition-all ${
                    selectedId === template.id 
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <LayoutTemplate className={`h-6 w-6 mt-0.5 flex-shrink-0 ${selectedId === template.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${selectedId === template.id ? 'text-blue-900' : 'text-slate-900'}`}>
                      {template.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {template.signerCount} signer{template.signerCount !== 1 ? 's' : ''}
                      {typeof template.usageCount === 'number' ? ` · used ${template.usageCount}×` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedId) {
                onSelect(selectedId);
                onClose();
              }
            }}
            disabled={!selectedId}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Selected Template
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderBrowserModal({ folders, onClose, onSelect }) {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const currentFolders = folders.filter(f => f.type !== 'template' && (f.parent_folder_id || null) === currentFolderId);

  const getBreadcrumbs = () => {
    const crumbs = [{ id: null, name: 'Root' }];
    let curr = currentFolderId;
    const path = [];
    while (curr) {
      const f = folders.find(folder => folder.id === curr);
      if (f) {
        path.unshift({ id: f.id, name: f.name });
        curr = f.parent_folder_id || f.parentId || f.parent_id;
      } else {
        break;
      }
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1].name;

  // Sync selectedId when currentFolderId changes to allow saving in the current folder quickly
  useEffect(() => {
    setSelectedId(currentFolderId);
  }, [currentFolderId]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[500px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header & Breadcrumbs */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              Select Destination Folder
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 text-sm font-medium">
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id || 'root'} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`hover:text-blue-600 transition-colors ${idx === breadcrumbs.length - 1 ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Directory View */}
        <div className="flex-grow overflow-y-auto p-6 bg-white custom-scrollbar">
          {currentFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Folder className="h-12 w-12 mb-3 opacity-20" />
              <p>This folder is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {currentFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex items-center gap-3 p-3 text-left border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm hover:bg-blue-50/30 transition-all group"
                >
                  <Folder className="h-6 w-6 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  <span className="font-medium text-sm text-slate-700 group-hover:text-slate-900 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-sm font-medium text-slate-700">
            Current Selection: <span className="text-blue-600">{currentFolderName}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelect(selectedId);
                onClose();
              }}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Upload() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDocumentId = searchParams.get('edit');

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userRes, foldersRes] = await Promise.all([
          api.get('/api/auth/me'),
          api.get('/api/folders/all').catch(() => ({ data: { folders: [] } }))
        ]);
        setCurrentUser(userRes.data);
        setFolders(foldersRes.data.folders || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  // Workflow State
  const [file, setFile] = useState(null);
  const [existingFile, setExistingFile] = useState(null); // { url, fileName } — draft being edited
  const [documentId, setDocumentId] = useState(null);

  // Upload Step Mode: 'new' PDF upload vs starting from a saved 'template'
  const [uploadMode, setUploadMode] = useState('new');
  const [templates, setTemplates] = useState([]);
  const [setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);

  const getFolderPath = (folder) => {
    const path = [];
    let curr = folder;
    while (curr) {
      path.unshift(curr.name);
      curr = folders.find(f => f.id === (curr.parent_folder_id || curr.parentId || curr.parent_id));
    }
    return path.join(' / ');
  };

  // Flag set at upload time; the actual template is saved right before dispatch,
  // once fields + signer roles are finalized (a raw upload alone has neither).
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templatesFetched, setTemplatesFetched] = useState(false);

  // Signer Hierarchy State
  const [isInitiatorFirst, setIsInitiatorFirst] = useState(false);
  const [initiatorReceivesFinalCopy, setInitiatorReceivesFinalCopy] = useState(true);
  const [signers, setSigners] = useState([
    { id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200', receivesFinalCopy: true }
  ]);
  const [editingSignerId, setEditingSignerId] = useState(1);

  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);


  // Canvas State (Preparation Phase)
  const [activeSignerId, setActiveSignerId] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fields, setFields] = useState([]);
  const [dueDate, setDueDate] = useState('');

  // Responsive Canvas Scaling
  const pdfContainerRef = useRef(null);
  const [pdfScale, setPdfScale] = useState(1);

  useEffect(() => {
    if (currentStep !== 2) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const availableWidth = entry.contentRect.width;
        // The base width is 750. We reserve 64px for padding (p-8 = 32px * 2)
        const targetScale = Math.min(1, (availableWidth - 64) / 750);
        setPdfScale(Math.max(0.3, targetScale)); 
      }
    });
    
    if (pdfContainerRef.current) {
      observer.observe(pdfContainerRef.current);
    }
    
    return () => observer.disconnect();
  }, [currentStep]);

  useEffect(() => {
    if (!editDocumentId) return;

    const loadDraft = async () => {
      try {
        const res = await api.get(`/api/documents/${editDocumentId}/file`);
        setDocumentId(editDocumentId);
        setExistingFile({ url: res.data.url, fileName: res.data.fileName });

        const draftConfig = res.data.draftConfig;
        if (draftConfig) {
          if (draftConfig.signers?.length) setSigners(draftConfig.signers);
          if (draftConfig.fields?.length) setFields(draftConfig.fields);
          if (draftConfig.isInitiatorFirst !== undefined) setIsInitiatorFirst(draftConfig.isInitiatorFirst);
          if (draftConfig.dueDate) setDueDate(draftConfig.dueDate);
          if (draftConfig.initiatorReceivesFinalCopy !== undefined) setInitiatorReceivesFinalCopy(draftConfig.initiatorReceivesFinalCopy);
          if (draftConfig.currentStep) setCurrentStep(draftConfig.currentStep);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load this draft.');
        navigate('/documents');
      }
    };
    loadDraft();
  }, [editDocumentId, navigate]);


  // LocalStorage Auto-Save & Hydration 
  const CACHE_KEY = 'upload_draft_state';

  // Hydrate from cache on mount (if NOT explicitly editing a draft)
  useEffect(() => {
    if (editDocumentId) return; // Skip if they clicked "Edit" on a draft

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.documentId) {
          // Fetch the file URL from the backend so the PDF can render
          const loadCachedDraft = async () => {
            try {
              const res = await api.get(`/api/documents/${parsed.documentId}/file`);
              setExistingFile({ url: res.data.url, fileName: res.data.fileName });
              
              setDocumentId(parsed.documentId);
              setCurrentStep(parsed.currentStep || 2);
              if (parsed.signers) setSigners(parsed.signers);
              if (parsed.fields) setFields(parsed.fields);
              if (parsed.isInitiatorFirst !== undefined) setIsInitiatorFirst(parsed.isInitiatorFirst);
              if (parsed.initiatorReceivesFinalCopy !== undefined) setInitiatorReceivesFinalCopy(parsed.initiatorReceivesFinalCopy);
            } catch (err) {
              console.error('Failed to load cached draft from server', err);
              // If the document was deleted on the server, clear the dead cache
              localStorage.removeItem(CACHE_KEY);
            }
          };
          loadCachedDraft();
        }
      } catch (err) {
        console.error('Failed to parse cached upload state', err);
      }
    }
  }, [editDocumentId]);

  const isDispatchedRef = useRef(false);

  // Auto-save to cache whenever state changes
  useEffect(() => {
    if (!documentId || isDispatchedRef.current) return; 
    
    const stateToCache = {
      documentId,
      currentStep,
      isInitiatorFirst,
      initiatorReceivesFinalCopy,
      signers,
      fields
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(stateToCache));
  }, [documentId, currentStep, isInitiatorFirst, initiatorReceivesFinalCopy, signers, fields]);


  // UX State
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const hasDraggedRef = useRef(false);
  const dragStartPositionsRef = useRef({});
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const [dragGuides, setDragGuides] = useState({ horizontal: null, vertical: null });
  const [isSignerDropdownOpen, setIsSignerDropdownOpen] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setTotalPages(numPages);
    setCurrentPage(1);
  };

  const scrollToPage = (pageNum) => {
    const element = document.getElementById(`pdf-dropzone-${pageNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  };

  const handleScroll = (e) => {
    if (totalPages <= 1) return;
    const container = e.target;
    const containerRect = container.getBoundingClientRect();
    
    for (let i = 1; i <= totalPages; i++) {
      const el = document.getElementById(`pdf-dropzone-${i}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
        // If more than 30% of the page is visible or 300px
        if (visibleHeight > (rect.height * 0.3) || visibleHeight > 300) {
          if (currentPage !== i) setCurrentPage(i);
          break;
        }
      }
    }
  };


  useEffect(() => {
    if (uploadMode !== 'template' || templatesFetched) return;

    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const res = await api.get('/api/templates');
        setTemplates(res.data.templates || []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load templates.');
      } finally {
        setTemplatesLoading(false);
        setTemplatesFetched(true);
      }
    };
    fetchTemplates();
  }, [uploadMode, templatesFetched]);


  // 1: UPLOAD HANDLERS
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      return toast.error('Please upload a valid PDF file.');
    }

    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSizeInBytes) {
      return toast.error('File size exceeds the 10MB maximum limit.');
    }

    setFile(selectedFile);
  };

  const [handleUploadSubmit, isUploading] = useAsyncLock(async () => {
    // Editing a draft and keeping its existing file — nothing to upload, just move on.
    if (!file && existingFile) {
      setCurrentStep(2);
      return;
    }

    if (!file) return toast.error('Please select a file first.');

    const formData = new FormData();
    formData.append('pdf_file', file);
    if (selectedFolderId) {
      formData.append('folder_id', selectedFolderId);
    }

    try {
      if (existingFile) {
        // Editing a draft and replacing its file.
        await api.post(`/api/documents/${documentId}/file`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('File replaced.');
      } else {
        const res = await api.post('/api/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setDocumentId(res.data.document.id);
        toast.success('Document secured in Cloudflare R2.');
      }
      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed. Check your connection.');
      console.error(error);
    }
  });
  

   const [handleUseTemplateSubmit] = useAsyncLock(async () => {
    if (!selectedTemplateId) return toast.error('Please select a template first.');

    try {
      const res = await api.post(`/api/templates/${selectedTemplateId}/use`, { folder_id: selectedFolderId });
      const { document: newDoc, signers: templateSigners, fields: templateFields } = res.data;

      setDocumentId(newDoc.id);
      setExistingFile({ url: newDoc.fileUrl, fileName: newDoc.fileName });
      setFile(null);

      if (templateSigners?.length) setSigners(templateSigners.map(s => ({ ...s, isDraft: !s.name || !s.email })));
      if (templateFields?.length) setFields(templateFields);

      toast.success(`Started from "${newDoc.templateName || 'template'}".`);
      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not start a document from this template.');
      console.error(error);
    }
  });


  // 2: HIERARCHY HANDLERS
  const toggleInitiatorFirst = () => {
    setIsInitiatorFirst(!isInitiatorFirst);
    if (!isInitiatorFirst && currentUser) {
      const newSigners = [...signers];
      newSigners[0] = { ...newSigners[0], name: currentUser.name, email: currentUser.email, locked: true };
      setSigners(newSigners);
    } else {
      const newSigners = [...signers];
      newSigners[0] = { ...newSigners[0], name: '', email: '', locked: false };
      setSigners(newSigners);
    }
  };

  const signerColors = [
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-teal-100 text-teal-700 border-teal-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-pink-100 text-pink-700 border-pink-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'bg-lime-100 text-lime-700 border-lime-200',
    'bg-violet-100 text-violet-700 border-violet-200',
    'bg-sky-100 text-sky-700 border-sky-200',
    'bg-red-100 text-red-700 border-red-200',
    'bg-yellow-100 text-yellow-700 border-yellow-200',
    'bg-green-100 text-green-700 border-green-200',
    'bg-slate-100 text-slate-700 border-slate-200',
    'bg-stone-100 text-stone-700 border-stone-200',
    'bg-zinc-100 text-zinc-700 border-zinc-200'
  ];

  const addSigner = () => {
    if (signers.length >= 20) return toast.error('Maximum 20 signers allowed for standard routing.');
    const newIndex = signers.length;
    const newId = newIndex + 1;
    setSigners([...signers, {
      id: newId,
      name: '',
      email: '',
      role: `Level ${newId} Signer`,
      color: signerColors[newIndex],
      receivesFinalCopy: true,
      isDraft: true
    }]);
    setEditingSignerId(newId);
  };

  const removeSigner = (indexToRemove) => {
    if (signers.length === 1) return;
    const updatedSigners = signers.filter((_, index) => index !== indexToRemove);
    const reindexed = updatedSigners.map((s, i) => ({
      ...s,
      id: i + 1,
      role: `Level ${i + 1} Signer`,
      color: signerColors[i]
    }));
    setSigners(reindexed);
  };

  const handleSignerChange = (index, field, value) => {
    const updatedSigners = [...signers];
    updatedSigners[index][field] = value;
    setSigners(updatedSigners);
  };

  const getSignerError = (signer) => {
    if (!signer.name || signer.name.trim() === '') return 'Name is required';
    if (!signer.email || signer.email.trim() === '') return 'Email is required';
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signer.email.trim())) {
      return 'Invalid email address';
    }

    const emailCount = signers.filter(s => s.email && s.email.trim().toLowerCase() === signer.email.trim().toLowerCase()).length;
    if (emailCount > 1) return 'Duplicate email address';
    
    const nameCount = signers.filter(s => s.name && s.name.trim().toLowerCase() === signer.name.trim().toLowerCase()).length;
    if (nameCount > 1) return 'Duplicate name';

    return null;
  };

  const validateSigners = () => {
    const isValid = signers.every(s => !getSignerError(s));
    if (!isValid) {
      toast.error('Please resolve errors in the Signers & Routing section.');
      return false;
    }
    return true;
  };

  const [handleSaveAsDraft, isSavingDraftState] = useAsyncLock(async () => {
    if (!validateSigners()) return;

    try {
      const finalSigners = signers.map((s, idx) => {
        if (isInitiatorFirst && idx === 0) {
          return { ...s, receivesFinalCopy: initiatorReceivesFinalCopy };
        }
        return s;
      });

      await api.patch(`/api/documents/${documentId}/draft-config`, { signers: finalSigners, fields, isInitiatorFirst, initiatorReceivesFinalCopy, currentStep, dueDate });
      toast.success('Saved as draft.');
      isDispatchedRef.current = true;
      localStorage.removeItem('upload_draft_state');
      setDocumentId(null);
      setCurrentStep(1);
      setFile(null);
      setExistingFile(null);
      setFields([]);
      setSigners([{ id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200', receivesFinalCopy: true }]);
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save this draft.');
    }
  });

  // DISPATCH HANDLER
  const [handleDispatchDocument, isDispatching] = useAsyncLock(async () => {
    // Validation: Check if every signer has at least one field assigned
    const signersWithoutFields = signers.filter(s => !fields.some(f => f.signerId === s.id));
    if (signersWithoutFields.length > 0) {
      return toast.error(`Please assign at least one field to: ${signersWithoutFields.map(s => s.name || s.role).join(', ')}`);
    }

    // No template name validation needed as it automatically takes the document name

    if (!validateSigners()) return;

    try {
      const token = localStorage.getItem('token');

      const finalSigners = signers.map((s, idx) => {
        if (isInitiatorFirst && idx === 0) {
          return { ...s, receivesFinalCopy: initiatorReceivesFinalCopy };
        }
        return s;
      });

      if (saveAsTemplate) {
        try {
          await api.patch(`/api/documents/${documentId}/draft-config`, {
            signers: finalSigners, fields, isInitiatorFirst, initiatorReceivesFinalCopy, currentStep, dueDate
          });
          const autoTemplateName = file?.name || existingFile?.fileName || 'Template';
          await api.post(`/api/documents/${documentId}/save-as-template`, { name: autoTemplateName });
          toast.success('Template saved.');
        } catch (templateErr) {
          toast.error(templateErr.response?.data?.error || 'Could not save as template — sending document anyway.');
        }
      }

      // We now include the dragged 'fields' in the payload
      const res = await api.post(`/api/documents/${documentId}/dispatch`, {
        signers: finalSigners,
        fields: fields,
        initiatorReceivesFinalCopy: initiatorReceivesFinalCopy,
        dueDate: dueDate || null
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success(res.data.message);
      isDispatchedRef.current = true;
      localStorage.removeItem('upload_draft_state');
      setDocumentId(null);
      setCurrentStep(1);
      setFile(null);
      setExistingFile(null);
      setFields([]);
      setSigners([{ id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200', receivesFinalCopy: true }]);

      if (res.data.isInitiatorFirst && res.data.redirectToken) {
        // Path A: Redirect instantly to signing canvas
        navigate(`/sign/${res.data.redirectToken}`);
      } else {
        // Path B: Third party is first, reset dashboard
        setCurrentStep(1);
        setFile(null);
        setDocumentId(null);
        setFields([]);
        setSigners([{ id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200', receivesFinalCopy: true }]);
        setSaveAsTemplate(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to dispatch document. Please try again.');
    }
  });

  // --- CANVAS DRAG & DROP HANDLERS ---
  const handleDragStart = (e, fieldType) => {
    e.dataTransfer.setData('fieldType', fieldType);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e, pageIndex) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData('fieldType');
    if (!fieldType) return;

    const fieldAlreadyExists = fields.some(
      (f) => f.type === fieldType && f.signerId === activeSignerId
    );

    if (fieldType === 'Initial') {
      if (fieldAlreadyExists) {
        toast.error(`You have already placed an Initial for this signer.`);
        return;
      }
      
      const dropzone = document.getElementById(`pdf-dropzone-${pageIndex}`);
      if (!dropzone) return;
      const bounds = dropzone.getBoundingClientRect();
      const scaledX = e.clientX - bounds.left;
      const scaledY = e.clientY - bounds.top;
      
      const unscaledX = scaledX / pdfScale;
      const unscaledY = scaledY / pdfScale;

      const xPct = (scaledX / bounds.width) * 100;
      const yPct = (scaledY / bounds.height) * 100;

      const newFields = [];
      for (let i = 1; i <= totalPages; i++) {
        newFields.push({
          id: `field_${Date.now()}_${i}`,
          type: fieldType,
          signerId: activeSignerId,
          page: i,
          x: unscaledX,
          y: unscaledY,
          xPct: xPct,
          yPct: yPct,
          width: 100,
          height: 35,
          required: true
        });
      }
      setFields([...fields, ...newFields]);
      
      const currentField = newFields.find(f => f.page === pageIndex);
      if (currentField) setSelectedFieldIds([currentField.id]);
      toast.success('Initial placed on all pages.');
    } else {

      const dropzone = document.getElementById(`pdf-dropzone-${pageIndex}`);
      if (!dropzone) return;
      const bounds = dropzone.getBoundingClientRect();
      const scaledX = e.clientX - bounds.left;
      const scaledY = e.clientY - bounds.top;

      const unscaledX = scaledX / pdfScale;
      const unscaledY = scaledY / pdfScale;

      const xPct = (scaledX / bounds.width) * 100;
      const yPct = (scaledY / bounds.height) * 100;

      const newField = {
        id: `field_${Date.now()}`,
        type: fieldType,
        signerId: activeSignerId,
        page: pageIndex,
        x: unscaledX,
        y: unscaledY,
        xPct: xPct,
        yPct: yPct,
        width: fieldType === 'Stamp' ? 80 : (fieldType === 'Text Box' ? 150 : 100),
        height: fieldType === 'Stamp' ? 80 : (fieldType === 'Text Box' ? 30 : 35),
        required: true
      };

      setFields([...fields, newField]);
      setSelectedFieldIds([newField.id]); 
    }
  };

  const updateFieldPosition = (id, newX, newY) => {
    const targetField = fields.find(f => f.id === id);
    if (!targetField) return;

    const dropzone = document.getElementById(`pdf-dropzone-${targetField.page}`);
    if (!dropzone) return;
    const bounds = dropzone.getBoundingClientRect();
    
    const unscaledWidth = bounds.width / pdfScale;
    const unscaledHeight = bounds.height / pdfScale;
    
    // Mathematically prevent the field from going outside the bounds of the page
    const clampedX = Math.max(0, Math.min(newX, unscaledWidth - targetField.width));
    const clampedY = Math.max(0, Math.min(newY, unscaledHeight - targetField.height));
    
    const xPct = (clampedX / unscaledWidth) * 100;
    const yPct = (clampedY / unscaledHeight) * 100;

    if (targetField.type === 'Initial') {
      setFields(prev => prev.map(f => (f.type === 'Initial' && f.signerId === targetField.signerId) ? { ...f, x: clampedX, y: clampedY, xPct: xPct, yPct: yPct } : f));
    } else {
      setFields(prev => prev.map(f => f.id === id ? { ...f, x: clampedX, y: clampedY, xPct: xPct, yPct: yPct } : f));
    }
  };

  const handleDrag = (currentFieldId, data) => {
    const currentField = fields.find(f => f.id === currentFieldId);
    if (!currentField) return;

    let newHorizontal = null;
    let newVertical = null;
    const threshold = 3;

    fields.forEach(f => {
      if (f.id === currentField.id || f.page !== currentField.page) return;

      if (Math.abs(data.y - f.y) < threshold) newHorizontal = f.y;
      else if (Math.abs((data.y + currentField.height) - (f.y + f.height)) < threshold) newHorizontal = f.y + f.height;
      else if (Math.abs((data.y + currentField.height/2) - (f.y + f.height/2)) < threshold) newHorizontal = f.y + f.height/2;
      
      if (Math.abs(data.x - f.x) < threshold) newVertical = f.x;
      else if (Math.abs((data.x + currentField.width) - (f.x + f.width)) < threshold) newVertical = f.x + f.width;
      else if (Math.abs((data.x + currentField.width/2) - (f.x + f.width/2)) < threshold) newVertical = f.x + f.width/2;
    });

    if (dragGuides.horizontal !== newHorizontal || dragGuides.vertical !== newVertical) {
      setDragGuides({ horizontal: newHorizontal, vertical: newVertical });
    }
  };

  const updateFieldSize = (id, width, height) => {
    const targetField = fields.find(f => f.id === id);
    if (targetField && targetField.type === 'Initial') {
      setFields(prev => prev.map(f => (f.type === 'Initial' && f.signerId === targetField.signerId) ? { ...f, width, height } : f));
    } else {
      setFields(prev => prev.map(f => f.id === id ? { ...f, width, height } : f));
    }
  };


  const updateFieldProperty = (id, property, value) => {
    const targetField = fields.find(f => f.id === id);
    if (targetField && targetField.type === 'Initial') {
      setFields(prev => prev.map(f => (f.type === 'Initial' && f.signerId === targetField.signerId) ? { ...f, [property]: value } : f));
    } else {
      setFields(prev => prev.map(f => f.id === id ? { ...f, [property]: value } : f));
    }
  };

  const deleteField = (id) => {
    const targetField = fields.find(f => f.id === id);
    if (targetField && targetField.type === 'Initial') {
      setFields(prev => prev.filter(f => !(f.type === 'Initial' && f.signerId === targetField.signerId)));
    } else {
      setFields(prev => prev.filter(f => f.id !== id));
    }
  };

  const activeSigner = signers.find(s => s.id === activeSignerId) || signers[0];
  const canvasFileSource = file || existingFile?.url || null;
  const activeColorClasses = activeSigner.color; // e.g. "bg-blue-100 text-blue-700 border-blue-200"

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-12">
      {isTemplateModalOpen && (
        <TemplateBrowserModal
          folders={folders}
          templates={templates}
          onClose={() => setIsTemplateModalOpen(false)}
          onSelect={setSelectedTemplateId}
        />
      )}

      {isFolderModalOpen && (
        <FolderBrowserModal
          folders={folders}
          onClose={() => setIsFolderModalOpen(false)}
          onSelect={setSelectedFolderId}
        />
      )}

      <main className={`mx-auto mt-8 px-4 sm:px-6 transition-all duration-500 ${currentStep === 2 ? 'w-full max-w-[1400px]' : 'max-w-4xl'}`}>

        {/* STEP 1 UI: UPLOAD */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Upload your document</h2>
            <p className="text-slate-500 text-sm mb-6">
              {uploadMode === 'new'
                ? 'Securely upload the PDF you need signed. It will be encrypted and stored in Cloudflare R2.'
                : 'Start from a saved template, its field layout and signer roles carry over automatically.'}
            </p>

            {/* Mode toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 p-1 mb-8 bg-slate-50">
              <button
                type="button"
                onClick={() => setUploadMode('new')}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${uploadMode === 'new' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <UploadCloud className="h-3.5 w-3.5" /> Upload New PDF
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('template')}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${uploadMode === 'template' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutTemplate className="h-3.5 w-3.5" /> Use Template
              </button>
            </div>

            {uploadMode === 'new' ? (
              <>
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-12 hover:border-slate-500 hover:bg-slate-50 transition-all group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center pointer-events-none">
                    <UploadCloud className={`h-12 w-12 mb-4 transition-colors ${file || existingFile ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className="text-sm font-medium text-slate-900">
                      {file ? file.name : existingFile ? existingFile.fileName : 'Click to browse or drag PDF here'}
                    </span>
                    <span className="text-xs text-slate-500 mt-2">
                      {existingFile && !file ? 'Drop a new PDF here to replace it' : 'Maximum file size: 10MB'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 text-left bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2.5 flex items-center hover:bg-slate-100/50 transition-colors">
                    <input
                      type="checkbox"
                      id="saveAsTemplate"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="saveAsTemplate" className="ml-3 block text-sm font-medium text-slate-900 cursor-pointer flex-grow">
                      Save this as a reusable template
                    </label>
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-8 space-y-6">
                  {/* Destination Folder Panel */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left transition-all hover:border-slate-300">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0 shadow-sm">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Destination Folder</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Where should this document be saved?</p>
                      </div>
                    </div>
                    <div className="w-full sm:w-72 flex justify-end">
                      <button
                        onClick={() => setIsFolderModalOpen(true)}
                        className="flex items-center justify-between w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg hover:border-blue-400 hover:ring-1 hover:ring-blue-400 transition-all text-left shadow-sm group"
                      >
                        <span className="truncate mr-3 font-medium text-slate-700 group-hover:text-blue-700">
                          {selectedFolderId ? getFolderPath(folders.find(f => f.id === selectedFolderId)) : 'Root (No folder)'}
                        </span>
                        <Folder className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-blue-500" />
                      </button>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleUploadSubmit}
                      disabled={isUploading || (!file && !existingFile)}
                      className="flex items-center h-[46px] px-8 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-all shadow-sm hover:shadow disabled:opacity-50 w-full sm:w-auto justify-center group"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading securely...
                        </>
                      ) : (
                        <>
                          Continue to Hierarchy <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-left">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Selected template</label>
                  
                  {selectedTemplateId ? (
                    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <LayoutTemplate className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {templates.find(t => t.id === selectedTemplateId)?.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            Ready to use
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors flex-shrink-0 ml-4"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-slate-50 transition-all group"
                    >
                      <LayoutTemplate className="h-10 w-10 text-slate-400 group-hover:text-blue-500 mb-3 transition-colors" />
                      <span className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">Browse Templates</span>
                      <span className="text-xs text-slate-500 mt-1">Navigate folders to select a template</span>
                    </button>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleUseTemplateSubmit}
                    disabled={isLoading || !selectedTemplateId}
                    className="flex items-center h-[46px] px-8 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-all shadow-sm hover:shadow disabled:opacity-50 group"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading template...
                      </>
                    ) : (
                      <>
                        Continue to Hierarchy <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
            
          </div>
        )}



        {/* STEP 2 UI: THE CANVAS WORKSPACE & ROUTING */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row h-[calc(100vh-8rem)] min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">

            {/* Left Sidebar: Routing & Tools */}
            <div className="w-64 lg:w-72 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col z-20 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.1)] overflow-y-auto custom-scrollbar">

              {/* Signers & Routing */}
              <div className="p-2.5 border-b border-slate-200 bg-white">
                <h3 className="font-semibold text-slate-900 text-sm">Signers & Routing</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Configure who needs to sign</p>
              </div>

              <div className="p-3 space-y-3 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 flex items-center bg-white border border-slate-200 rounded-md hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                    <input
                      type="checkbox"
                      id="meFirst"
                      checked={isInitiatorFirst}
                      onChange={toggleInitiatorFirst}
                      className="h-3.5 w-3.5 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="meFirst" className="ml-2 block text-[11px] font-medium text-slate-700 cursor-pointer flex-grow truncate">
                      I'm first signer
                    </label>
                  </div>

                  <div className="p-2 flex items-center bg-white border border-slate-200 rounded-md hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                    <input
                      type="checkbox"
                      id="initiatorFinalCopy"
                      checked={initiatorReceivesFinalCopy}
                      onChange={(e) => setInitiatorReceivesFinalCopy(e.target.checked)}
                      className="h-3.5 w-3.5 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="initiatorFinalCopy" className="ml-2 block text-[11px] font-medium text-slate-700 cursor-pointer flex-grow truncate">
                      Receive final copy
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  {signers.map((signer, index) => {
                    const isEditing = editingSignerId === signer.id || signer.isDraft;
                    return (
                    <div key={signer.id} className={`p-2 border rounded shadow-sm relative transition-colors ${activeSignerId === signer.id ? 'bg-white border-blue-400 ring-1 ring-blue-400' : 'bg-white border-slate-200'}`} onClick={() => setActiveSignerId(signer.id)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${signer.color}`}>
                          {signer.role}
                        </span>
                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingSignerId(signer.id); }} className="text-slate-400 hover:text-blue-600 transition-colors p-1">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {index > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); removeSigner(index); }} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-1 relative">
                          <div>
                            <input
                              type="text"
                              placeholder="Name or email search..."
                              value={signer.name}
                              disabled={signer.locked}
                              onChange={(e) => {
                                handleSignerChange(index, 'name', e.target.value);
                                if (e.target.value.length >= 2) {
                                  setActiveSearchIndex(index);
                                  api.get(`/api/auth/users/search?q=${e.target.value}`)
                                     .then(res => setUserSuggestions(res.data.users))
                                     .catch(err => console.error(err));
                                } else {
                                  setUserSuggestions([]);
                                }
                              }}
                              onBlur={() => setTimeout(() => setUserSuggestions([]), 200)}
                              className="block w-full text-xs border-slate-200 rounded focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 py-1.5 px-2 border"
                            />
                            {activeSearchIndex === index && userSuggestions.length > 0 && (
                              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {userSuggestions.map(u => (
                                  <li 
                                    key={u.id}
                                    onMouseDown={() => {
                                       handleSignerChange(index, 'name', u.name);
                                       handleSignerChange(index, 'email', u.email);
                                       setUserSuggestions([]);
                                    }}
                                    className="px-2 py-1.5 text-[11px] cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-slate-900 truncate">{u.name}</div>
                                    <div className="text-slate-500 truncate">{u.email}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <input
                              type="email"
                              placeholder="Email Address"
                              value={signer.email}
                              disabled={signer.locked}
                              onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                              className={`block w-full text-xs rounded focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 py-1.5 px-2 border ${getSignerError(signer) && (signer.name || signer.email) ? 'border-red-300' : 'border-slate-200'}`}
                            />
                            {(() => {
                              const err = getSignerError(signer);
                              if (err && (signer.name || signer.email)) {
                                return <div className="text-[10px] text-red-500 mt-1 font-medium flex items-center"><X className="h-3 w-3 mr-0.5"/>{err}</div>;
                              }
                              return null;
                            })()}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            {!(isInitiatorFirst && index === 0) ? (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`final-copy-${index}`}
                                  checked={signer.receivesFinalCopy !== false}
                                  onChange={(e) => handleSignerChange(index, 'receivesFinalCopy', e.target.checked)}
                                  className="h-3 w-3 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
                                />
                                <label htmlFor={`final-copy-${index}`} className="ml-1.5 text-[10px] font-medium text-slate-500 cursor-pointer">
                                  Receive final copy
                                </label>
                              </div>
                            ) : <div></div>}
                            
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const err = getSignerError(signer);
                                if (err) {
                                  toast.error(err);
                                } else {
                                  setEditingSignerId(null); 
                                  if (signer.isDraft) {
                                    const updated = [...signers];
                                    updated[index].isDraft = false;
                                    setSigners(updated);
                                  }
                                }
                              }} 
                              className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded hover:bg-blue-100 transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <div className="text-xs font-semibold text-slate-800">{signer.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{signer.email}</div>
                          {!(isInitiatorFirst && index === 0) && signer.receivesFinalCopy && (
                            <div className="text-[10px] text-slate-400 mt-1.5 flex items-center"><Check className="h-3 w-3 mr-1"/> Receives final copy</div>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>

                <div className="pt-2">
                  <button onClick={addSigner} className="flex items-center justify-center w-full py-2 border border-dashed border-blue-300 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Next Signer
                  </button>
                </div>
              </div>

              {/* Recipient Dropdown Redesign */}
              <div className="p-3 border-b border-slate-200 bg-white relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recipient</label>
                <div
                  className="w-full text-xs border border-slate-200 rounded p-2 flex items-center justify-between cursor-pointer hover:border-slate-400 bg-white shadow-sm transition-colors"
                  onClick={() => setIsSignerDropdownOpen(!isSignerDropdownOpen)}
                >
                  <div className="flex items-center truncate">
                    <span className={`w-2 h-2 rounded-full mr-2 ${activeColorClasses.split(' ')[0].replace('-100', '-500')}`}></span>
                    <span className="truncate font-medium text-slate-700">{activeSigner.name || activeSigner.role}</span>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-slate-400 transition-transform ${isSignerDropdownOpen ? 'rotate-90' : ''}`} />
                </div>

                {isSignerDropdownOpen && (
                  <div className="absolute top-[100%] left-3 right-3 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
                    {signers.map(s => (
                      <div
                        key={s.id}
                        className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center"
                        onClick={() => { setActiveSignerId(s.id); setIsSignerDropdownOpen(false); }}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${s.color.split(' ')[0].replace('-100', '-500')}`}></span>
                        <span className="truncate text-slate-700 font-medium">{s.name || s.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Draggable Fields List */}
              <div className="p-3 border-b border-slate-200">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Standard Fields</label>
                <div className="grid grid-cols-2 gap-2">
                  <DraggableField icon={PenTool} label="Signature" type="Signature" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                  <DraggableField icon={Type} label="Initial" type="Initial" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                  <DraggableField icon={Stamp} label="Stamp" type="Stamp" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                  <DraggableField icon={Calendar} label="Date Signed" type="Date" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                
                  <DraggableField icon={UserSquare} label="Name" type="Name" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                  <DraggableField icon={Type} label="Text Box" type="Text Box" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                </div>
              </div>

              {/* Document Settings */}
              <div className="p-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Due Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)} // prevent past dates and times
                      className="block w-full text-xs border-slate-200 rounded focus:ring-slate-900 focus:border-slate-900 py-2 px-3 border"
                    />
                  </div>
                </div>
              </div>



            </div>

            {/* Right Side: PDF Viewer & Toolbar */}
            <div className="flex-1 flex flex-col bg-slate-200/50 relative overflow-hidden">

              {/* PDF Toolbar */}
              <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10">
                <div className="flex items-center space-x-2">
                  <button onClick={() => setCurrentStep(1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 mr-2 hover:bg-slate-50 hover:border-slate-400 transition-colors">
                    Back
                  </button>
                  <button onClick={() => scrollToPage(Math.max(currentPage - 1, 1))} disabled={currentPage <= 1} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="text-sm font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => scrollToPage(Math.min(currentPage + 1, totalPages))} disabled={currentPage >= totalPages} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
                </div>

                <div className="flex items-center space-x-1 border-l border-r border-slate-200 px-4">
                  <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><Search className="h-4 w-4" /></button>
                  <span className="text-xs font-medium text-slate-500 w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleSaveAsDraft} disabled={isSavingDraftState} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50">
                    {isSavingDraftState && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                    {isSavingDraftState ? 'Saving...' : 'Save as draft'}
                  </button>
                  <button
                    onClick={handleDispatchDocument}
                    disabled={isDispatching}
                    className="flex items-center justify-center py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isDispatching && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                    {isDispatching ? 'Processing...' : 'Send Document'} {!isDispatching && <Send className="ml-2 h-4 w-4" />}
                  </button>
                </div>
              </div>
                          {/* The Actual Canvas Area */}
              <div
                ref={pdfContainerRef}
                className="flex-1 overflow-auto p-4 md:p-8 bg-slate-200/50 relative"
                onClick={() => setSelectedFieldIds([])}
                onScroll={handleScroll}
              >
                  {/* Bulk Toolbar - moved here for sticky positioning to work properly! */}
                  {selectedFieldIds.length > 1 && (
                    <div 
                      className="sticky top-4 mx-auto w-max mb-4 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl flex items-center h-12 px-2 gap-2 z-[100] pointer-events-auto"
                      onClick={(e) => e.stopPropagation()} 
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs font-semibold text-white ml-2 mr-2">
                        {selectedFieldIds.length} items selected
                      </span>
                      
                      <div className="h-6 w-px bg-slate-700 mx-1"></div>
                      
                      <select
                        onChange={(e) => {
                          const newSignerId = Number(e.target.value);
                          setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, signerId: newSignerId } : f));
                        }}
                        className="text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 py-1.5 px-3 rounded outline-none cursor-pointer border border-slate-700"
                        value=""
                      >
                        <option value="" disabled>Assign to...</option>
                        {signers.map(s => (
                          <option key={s.id} value={s.id}>{s.name || s.role}</option>
                        ))}
                      </select>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFields = [];
                          const newSelectedIds = [];
                          
                          const offsetBase = 20;
                          
                          fields.filter(f => selectedFieldIds.includes(f.id)).forEach((f, idx) => {
                            const newId = `field_${Date.now()}_${idx}`;
                            newFields.push({ ...f, id: newId, x: f.x + offsetBase, y: f.y + offsetBase, xPct: f.xPct + 2, yPct: f.yPct + 2 });
                            newSelectedIds.push(newId);
                          });
                          
                          setFields(prev => [...prev, ...newFields]);
                          setSelectedFieldIds(newSelectedIds);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 rounded transition-colors ml-1"
                      >
                        <Copy className="h-4 w-4" /> Duplicate All
                      </button>
                      
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setFields(prev => prev.filter(f => !selectedFieldIds.includes(f.id))); 
                          setSelectedFieldIds([]); 
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded transition-colors border-l border-slate-700 ml-1"
                      >
                        <Trash2 className="h-4 w-4" /> Delete All
                      </button>
                    </div>
                  )}

                {/* 
                  Wrapper div strictly matches the scaled width. 
                  This ensures mx-auto centers it flawlessly without flex layout bugs or clipping!
                */}
                <div style={{ width: 750 * pdfScale }} className="mx-auto">
                  <div 
                    style={{ 
                      transform: `scale(${pdfScale})`, 
                      transformOrigin: 'top left'
                    }} 
                    className="w-[750px] flex flex-col"
                  >

                  {canvasFileSource ? (
                    <Document
                      file={canvasFileSource}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<div className="p-20 text-slate-400 flex justify-center w-[750px]">Loading document...</div>}
                      error={<div className="p-20 text-red-500 flex justify-center w-[750px]">Failed to load PDF.</div>}
                    >
                      {Array.from(new Array(totalPages), (el, index) => {
                        const pageIndex = index + 1;
                        return (
                          <div
                            key={`page_${pageIndex}`}
                            id={`pdf-dropzone-${pageIndex}`}
                            className="relative shadow-lg border border-slate-200 bg-white w-[750px] mx-auto mb-8"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, pageIndex)}
                          >
                            <Page
                              pageNumber={pageIndex}
                              width={750}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              className="shadow-sm"
                            />

                            {/* Render Placed Fields for Current Page */}
                            {fields.filter(f => f.page === pageIndex).map((field) => {
                              const signer = signers.find(s => s.id === field.signerId);
                              const isSelected = selectedFieldIds.includes(field.id);
                              const baseColor = signer ? signer.color : 'bg-slate-100 text-slate-700 border-slate-200';
                              const bgColor = isSelected ? baseColor.split(' ')[0].replace('-100', '-200') : baseColor.split(' ')[0];
                              const borderColor = isSelected ? baseColor.split(' ')[2].replace('-200', '-500') : baseColor.split(' ')[2];
                              const textColor = baseColor.split(' ')[1];

                              return (
                                <Rnd
                                  scale={pdfScale}
                                  key={field.id}
                                  bounds="parent"
                                  size={{ width: field.width, height: field.height }}
                                  position={{ x: field.x, y: field.y }}
                                  lockAspectRatio={field.type === 'Stamp'}
                                  dragGrid={[1, 1]}
                                  resizeGrid={[1, 1]}
                                  onDragStart={(e, data) => {
                                    e.stopPropagation();
                                    hasDraggedRef.current = false;
                                    
                                    let currentSelectedIds = selectedFieldIds;
                                    if (!e.shiftKey && !selectedFieldIds.includes(field.id)) {
                                      currentSelectedIds = [field.id];
                                      setSelectedFieldIds([field.id]);
                                    }
                                    
                                    const originalPositions = {};
                                    fields.forEach(f => {
                                      if (currentSelectedIds.includes(f.id)) {
                                        originalPositions[f.id] = { x: f.x, y: f.y };
                                      }
                                    });
                                    dragStartPositionsRef.current = originalPositions;
                                    dragStartMouseRef.current = { x: data.x, y: data.y };
                                  }}
                                  onDrag={(e, data) => {
                                    hasDraggedRef.current = true;
                                    handleDrag(field.id, data);
                                    
                                    if (selectedFieldIds.length > 1 && selectedFieldIds.includes(field.id)) {
                                      const deltaX = data.x - dragStartMouseRef.current.x;
                                      const deltaY = data.y - dragStartMouseRef.current.y;
                                      
                                      setFields(prev => prev.map(f => {
                                        if (selectedFieldIds.includes(f.id) && f.id !== field.id) {
                                          const orig = dragStartPositionsRef.current[f.id];
                                          if (orig) {
                                            return { ...f, x: orig.x + deltaX, y: orig.y + deltaY };
                                          }
                                        }
                                        return f;
                                      }));
                                    }
                                  }}
                                  onDragStop={(e, data) => {
                                    setDragGuides({ horizontal: null, vertical: null });
                                    
                                    if (selectedFieldIds.length > 1 && selectedFieldIds.includes(field.id)) {
                                      const deltaX = data.x - dragStartMouseRef.current.x;
                                      const deltaY = data.y - dragStartMouseRef.current.y;
                                      
                                      selectedFieldIds.forEach(id => {
                                        const orig = dragStartPositionsRef.current[id];
                                        if (orig) {
                                          updateFieldPosition(id, orig.x + deltaX, orig.y + deltaY);
                                        }
                                      });
                                    } else {
                                      updateFieldPosition(field.id, data.x, data.y);
                                    }
                                  }}
                                  onResizeStop={(e, direction, ref, delta, position) => {
                                    updateFieldSize(field.id, parseInt(ref.style.width), parseInt(ref.style.height));
                                    updateFieldPosition(field.id, position.x, position.y);
                                  }}
                                  disableDragging={false}
                                  enableResizing={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
                                  resizeHandleStyles={{
                                    topRight: { position: 'absolute', top: 0, right: 0, transform: 'translate(50%, -50%)', width: '9px', height: '9px', zIndex: 60 },
                                    bottomRight: { position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%, 50%)', width: '9px', height: '9px', zIndex: 60 },
                                    bottomLeft: { position: 'absolute', bottom: 0, left: 0, transform: 'translate(-50%, 50%)', width: '9px', height: '9px', zIndex: 60 },
                                    topLeft: { position: 'absolute', top: 0, left: 0, transform: 'translate(-50%, -50%)', width: '9px', height: '9px', zIndex: 60 }
                                  }}
                                  resizeHandleComponent={{
                                    topRight: <div className={`w-full h-full bg-white border border-slate-400 rounded-full shadow-sm ${isSelected ? 'block' : 'hidden group-hover:block'}`} />,
                                    bottomRight: <div className={`w-full h-full bg-white border border-slate-400 rounded-full shadow-sm ${isSelected ? 'block' : 'hidden group-hover:block'}`} />,
                                    bottomLeft: <div className={`w-full h-full bg-white border border-slate-400 rounded-full shadow-sm ${isSelected ? 'block' : 'hidden group-hover:block'}`} />,
                                    topLeft: <div className={`w-full h-full bg-white border border-slate-400 rounded-full shadow-sm ${isSelected ? 'block' : 'hidden group-hover:block'}`} />,
                                  }}
                                  className={`absolute border-[1.5px] flex items-center justify-center group cursor-move z-40 hover:shadow-md transition-shadow ${bgColor} ${borderColor} ${isSelected ? 'shadow-md z-50' : 'shadow-sm'}`}
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    if (hasDraggedRef.current) return;
                                    if (field.type !== 'Initial' && e.shiftKey) {
                                      setSelectedFieldIds(prev => prev.includes(field.id) ? prev.filter(id => id !== field.id) : [...prev, field.id]);
                                    } else {
                                      setSelectedFieldIds([field.id]);
                                    }
                                  }}
                                >
                                  {/* Floating Tooltip/Toolbar for Selected Field */}
                                  {isSelected && selectedFieldIds.length === 1 && (
                                    <div 
                                      className="absolute -top-12 left-0 bg-white border border-slate-200 rounded shadow-md flex items-center h-10 px-1 gap-1 z-50 pointer-events-auto"
                                      onClick={(e) => e.stopPropagation()} 
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      {/* Assigned To Dropdown */}
                                      <select
                                        value={field.signerId}
                                        onChange={(e) => updateFieldProperty(field.id, 'signerId', Number(e.target.value))}
                                        className="text-xs font-medium text-slate-700 bg-transparent py-1.5 px-2 outline-none cursor-pointer border-r border-slate-100"
                                      >
                                        {signers.map(s => (
                                          <option key={s.id} value={s.id}>{s.name || s.role}</option>
                                        ))}
                                      </select>
                                      
                                      {/* Font Size Dropdown */}
                                      {(field.type === 'Text Box' || field.type === 'Name' || field.type === 'Date') && (
                                        <select
                                          value={field.fontSize || 14}
                                          onChange={(e) => updateFieldProperty(field.id, 'fontSize', Number(e.target.value))}
                                          className="text-xs font-medium text-slate-700 bg-transparent py-1.5 px-2 outline-none cursor-pointer border-r border-slate-100"
                                          title="Font Size"
                                        >
                                          <option value={10}>10</option>
                                          <option value={12}>12</option>
                                          <option value={14}>14</option>
                                          <option value={16}>16</option>
                                          <option value={20}>20</option>
                                          <option value={24}>24</option>
                                        </select>
                                      )}
                                      
                                      {/* Duplicate Button */}
                                      {field.type !== 'Initial' && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const duplicatedField = { ...field, id: `field_${Date.now()}`, x: field.x + 20, y: field.y + 20, xPct: field.xPct + 2, yPct: field.yPct + 2 };
                                            setFields([...fields, duplicatedField]);
                                            setSelectedFieldIds([duplicatedField.id]);
                                          }}
                                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                          title="Duplicate"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                      )}
                                      
                                      {/* Delete Button */}
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); deleteField(field.id); setSelectedFieldIds([]); }}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors border-l border-slate-100"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}

                                  <div className={`text-[10px] font-bold uppercase tracking-wider flex flex-col items-center justify-center text-center ${textColor}`}>
                                    <span>{field.type} {field.required ? '*' : ''}</span>
                                    {(field.type === 'Text Box' || field.type === 'Name') && (() => {
                                      const fontSize = field.fontSize || 14;
                                      const paddingTop = field.height > (fontSize * 2) ? 0 : Math.max(0, (field.height - fontSize * 1.5) / 2);
                                      const availableHeight = field.height - paddingTop;
                                      const linesCount = Math.max(1, Math.floor(availableHeight / (fontSize * 1.2)));
                                      
                                      return (
                                        <span className="text-[8px] opacity-75 normal-case mt-0.5 font-medium tracking-normal">
                                          ({linesCount} {linesCount === 1 ? 'line' : 'lines'})
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </Rnd>
                              );
                            })}
                            
                            {/* Render Alignment Guides */}
                            {dragGuides.horizontal !== null && (
                              <div 
                                className="absolute left-0 right-0 border-t border-dashed border-blue-400 z-30 pointer-events-none"
                                style={{ top: `${dragGuides.horizontal * pdfScale}px` }}
                              />
                            )}
                            {dragGuides.vertical !== null && (
                              <div 
                                className="absolute top-0 bottom-0 border-l border-dashed border-blue-400 z-30 pointer-events-none"
                                style={{ left: `${dragGuides.vertical * pdfScale}px` }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </Document>
                  ) : (
                    <div className="w-[750px] aspect-[8.5/11] flex flex-col items-center justify-center bg-white shadow-lg border border-slate-200">
                      <FileSignature className="h-16 w-16 text-slate-300 mb-4" />
                      <p className="text-slate-400 font-medium">No document loaded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

      </main>
    </div>
  );
}
