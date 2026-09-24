import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import {
  UploadCloud, Users, FileSignature, CheckCircle, Plus, Trash2,
  ArrowRight, PenTool, Calendar, Type, UserSquare, ChevronLeft, ChevronRight, Search, Send, X, LayoutTemplate, Pencil, Check
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import Select from 'react-select';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- TOP-LEVEL COMPONENTS (moved out of Upload to avoid remounting on every render) ---

const StepIcon = ({ stepNumber, current, icon: Icon, title }) => {
  const isActive = current === stepNumber;
  const isPast = current > stepNumber;
  return (
    <div className={`flex flex-col items-center ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-colors ${isActive ? 'bg-slate-900 text-white shadow-md' : isPast ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
        }`}>
        {isPast ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <span className={`text-xs font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{title}</span>
    </div>
  );
};

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
const templateSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '46px',
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#0f172a' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 1px #0f172a' : 'none',
    '&:hover': { borderColor: '#94a3b8' }
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0f172a' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? '#ffffff' : '#0f172a',
    cursor: 'pointer',
    padding: '10px 12px'
  }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
  singleValue: (base) => ({ ...base, fontSize: '0.875rem' }),
  menu: (base) => ({ ...base, borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' })
};

export default function Upload() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDocumentId = searchParams.get('edit');

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/api/auth/me');
        setCurrentUser(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, []);

  // Workflow State
  const [file, setFile] = useState(null);
  const [existingFile, setExistingFile] = useState(null); // { url, fileName } — draft being edited
  const [documentId, setDocumentId] = useState(null);

  // Upload Step Mode: 'new' PDF upload vs starting from a saved 'template'
  const [uploadMode, setUploadMode] = useState('new');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Flag set at upload time; the actual template is saved right before dispatch,
  // once fields + signer roles are finalized (a raw upload alone has neither).
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
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

  // Auto-save to cache whenever state changes
  useEffect(() => {
    if (!documentId) return; 
    
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
  const [selectedFieldId, setSelectedFieldId] = useState(null);
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
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      toast.error('Please upload a valid PDF file.');
    }
  };

  const handleUploadSubmit = async () => {
    // Editing a draft and keeping its existing file — nothing to upload, just move on.
    if (!file && existingFile) {
      setCurrentStep(2);
      return;
    }

    if (!file) return toast.error('Please select a file first.');

    setIsLoading(true);
    const formData = new FormData();
    formData.append('pdf_file', file);

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
    } finally {
      setIsLoading(false);
    }
  };


   const handleUseTemplateSubmit = async () => {
    if (!selectedTemplateId) return toast.error('Please select a template first.');

    setIsLoading(true);
    try {
      const res = await api.post(`/api/templates/${selectedTemplateId}/use`);
      const { document: newDoc, signers: templateSigners, fields: templateFields } = res.data;

      setDocumentId(newDoc.id);
      setExistingFile({ url: newDoc.fileUrl, fileName: newDoc.fileName });
      setFile(null);

      if (templateSigners?.length) setSigners(templateSigners);
      if (templateFields?.length) setFields(templateFields);

      toast.success(`Started from "${newDoc.templateName || 'template'}".`);
      setCurrentStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not start a document from this template.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };


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
    'bg-rose-100 text-rose-700 border-rose-200'
  ];

  const addSigner = () => {
    if (signers.length >= 5) return toast.error('Maximum 5 signers allowed for standard routing.');
    const newIndex = signers.length;
    const newId = newIndex + 1;
    setSigners([...signers, {
      id: newId,
      name: '',
      email: '',
      role: `Level ${newId} Signer`,
      color: signerColors[newIndex],
      receivesFinalCopy: true
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

  const validateSigners = () => {
    const isValid = signers.every(s => s.name.trim() !== '' && s.email.trim() !== '');
    if (!isValid) {
      toast.error('Please fill out all signer details.');
      return false;
    }

    // Check for duplicate emails (case-insensitive)
    const emails = signers.map(s => s.email.trim().toLowerCase());
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      toast.error('Duplicate emails found. Each signer must have a unique email address.');
      return false;
    }

    // Email validation
    const invalidEmail = emails.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidEmail) {
      toast.error(`Invalid email address: ${invalidEmail}`);
      return false;
    }

    // Check for duplicate names (case-insensitive)
    const names = signers.map(s => s.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      toast.error('Duplicate names found. Each signer must have a unique name.');
      return false;
    }

    return true;
  };

  const handleSaveAsDraft = async () => {
    if (!validateSigners()) return;

    setIsLoading(true);
    try {
      const finalSigners = signers.map((s, idx) => {
        if (isInitiatorFirst && idx === 0) {
          return { ...s, receivesFinalCopy: initiatorReceivesFinalCopy };
        }
        return s;
      });

      await api.patch(`/api/documents/${documentId}/draft-config`, { signers: finalSigners, fields, isInitiatorFirst, initiatorReceivesFinalCopy, currentStep, dueDate });
      toast.success('Saved as draft.');
      localStorage.removeItem('upload_draft_state');
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save this draft.');
    } finally {
      setIsLoading(false);
    }
  };

  // DISPATCH HANDLER
  const handleDispatchDocument = async () => {
    // Validation: Check if every signer has at least one field assigned
    const signersWithoutFields = signers.filter(s => !fields.some(f => f.signerId === s.id));
    if (signersWithoutFields.length > 0) {
      return toast.error(`Please assign at least one field to: ${signersWithoutFields.map(s => s.name || s.role).join(', ')}`);
    }

    if (saveAsTemplate && !templateName.trim()) {
      return toast.error('Please give your template a name.');
    }

    if (!validateSigners()) return;

    setIsLoading(true);

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
          await api.post(`/api/documents/${documentId}/save-as-template`, { name: templateName.trim() });
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
      localStorage.removeItem('upload_draft_state');

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
        setTemplateName('');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to dispatch document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
      if (currentField) setSelectedFieldId(currentField.id);
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
        width: fieldType === 'Text Box' ? 150 : 100,
        height: fieldType === 'Text Box' ? 30 : 35,
        required: true
      };

      setFields([...fields, newField]);
      setSelectedFieldId(newField.id); 
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
    
    const xPct = (newX / unscaledWidth) * 100;
    const yPct = (newY / unscaledHeight) * 100;

    if (targetField.type === 'Initial') {
      setFields(prev => prev.map(f => (f.type === 'Initial' && f.signerId === targetField.signerId) ? { ...f, x: newX, y: newY, xPct: xPct, yPct: yPct } : f));
    } else {
      setFields(prev => prev.map(f => f.id === id ? { ...f, x: newX, y: newY, xPct: xPct, yPct: yPct } : f));
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
                  {saveAsTemplate && (
                    <div className="p-2.5 pt-0">
                      <input
                        type="text"
                        placeholder="Template name (e.g. NDA — Standard)"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="block w-full text-sm border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 py-2 px-3 border"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Saved once you finish setting up hierarchy and fields, right before sending.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleUploadSubmit}
                    disabled={isLoading || (!file && !existingFile)}
                    className="flex items-center py-2.5 px-6 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Uploading securely...' : 'Continue to Hierarchy'} <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-left">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Your templates</label>

                  <Select
                    options={templates.map(t => ({
                      value: t.id,
                      label: t.name,
                      signerCount: t.signerCount,
                      usageCount: t.usageCount
                    }))}
                    value={
                      selectedTemplateId
                        ? templates
                            .map(t => ({ value: t.id, label: t.name, signerCount: t.signerCount, usageCount: t.usageCount }))
                            .find(o => o.value === selectedTemplateId) || null
                        : null
                    }
                    onChange={(option) => setSelectedTemplateId(option ? option.value : null)}
                    isLoading={templatesLoading}
                    isClearable
                    isSearchable
                    placeholder="Search your templates..."
                    noOptionsMessage={() => templatesLoading ? 'Loading templates...' : 'No templates yet — save a completed document as one to reuse it here.'}
                    maxMenuHeight={112}
                    styles={templateSelectStyles}
                    formatOptionLabel={(option) => (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md flex items-center justify-center bg-slate-100 text-slate-500 flex-shrink-0">
                          <LayoutTemplate className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{option.label}</div>
                          <div className="text-xs text-slate-500">
                            {option.signerCount} signer{option.signerCount !== 1 ? 's' : ''}
                            {typeof option.usageCount === 'number' ? ` · used ${option.usageCount}×` : ''}
                          </div>
                        </div>
                      </div>
                    )}
                  />
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleUseTemplateSubmit}
                    disabled={isLoading || !selectedTemplateId}
                    className="flex items-center py-2.5 px-6 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Loading template...' : 'Continue to Hierarchy'} <ArrowRight className="ml-2 h-4 w-4" />
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
                    const isEditing = editingSignerId === signer.id || (!signer.name && !signer.email);
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
                              className="block w-full text-xs border-slate-200 rounded focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 py-1.5 px-2 border"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            {!(isInitiatorFirst && index === 0) ? (
                              <div className="flex items-center pt-1">
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
                            
                            <button onClick={(e) => { e.stopPropagation(); setEditingSignerId(null); }} className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded hover:bg-blue-100 transition-colors">
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
                  <DraggableField icon={Calendar} label="Date Signed" type="Date" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                
                  <DraggableField icon={UserSquare} label="Name" type="Name" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                  <DraggableField icon={Type} label="Text Box" type="Text Box" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                </div>
              </div>

              {/* Document Settings */}
              <div className="p-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Document Settings</label>
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

              {/* Properties Panel (Moved to Left Sidebar) */}
              {selectedFieldId && (
                <div className="border-t border-slate-200 bg-white shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.1)] flex flex-col z-30 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Field Properties</span>
                    <button onClick={() => setSelectedFieldId(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {(() => {
                    const sField = fields.find(f => f.id === selectedFieldId);
                    if (!sField) return null;
                    const fSigner = signers.find(s => s.id === sField.signerId);

                    return (
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="flex items-center text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {fSigner && (
                              <span className={`w-2 h-2 rounded-full mr-1.5 ${fSigner.color.split(' ')[0].replace('-100', '-500')}`}></span>
                            )}
                            Assigned To
                          </label>
                          <select
                            value={sField.signerId}
                            onChange={(e) => updateFieldProperty(sField.id, 'signerId', Number(e.target.value))}
                            className="block w-full text-xs font-medium text-slate-900 bg-white p-2 rounded border border-slate-200 focus:ring-slate-900 focus:border-slate-900 shadow-sm cursor-pointer"
                          >
                            {signers.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name || s.role}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center py-1">
                          <input
                            type="checkbox"
                            id="requiredField"
                            checked={sField.required}
                            onChange={(e) => updateFieldProperty(sField.id, 'required', e.target.checked)}
                            className="h-3.5 w-3.5 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
                          />
                          <label htmlFor="requiredField" className="ml-2 text-xs text-slate-700 font-medium cursor-pointer">Required Field</label>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <button
                            onClick={() => { deleteField(sField.id); setSelectedFieldId(null); }}
                            className="w-full flex items-center justify-center py-2 px-3 border border-red-200 text-red-600 rounded-md text-xs font-medium hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Field
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

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
                  <button onClick={handleSaveAsDraft} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50">
                    {isLoading ? 'Saving...' : 'Save as draft'}
                  </button>
                  <button
                    onClick={handleDispatchDocument}
                    disabled={isLoading}
                    className="flex items-center py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isLoading ? 'Processing...' : 'Send Document'} <Send className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
                          {/* The Actual Canvas Area */}
              <div
                ref={pdfContainerRef}
                className="flex-1 overflow-auto p-4 md:p-8 bg-slate-200/50"
                onClick={() => setSelectedFieldId(null)}
                onScroll={handleScroll}
              >
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
                              const isSelected = selectedFieldId === field.id;
                              const baseColor = signer ? signer.color : 'bg-slate-100 text-slate-700 border-slate-200';
                              const bgColor = isSelected ? baseColor.split(' ')[0].replace('-100', '-200') : baseColor.split(' ')[0];
                              const borderColor = isSelected ? baseColor.split(' ')[2].replace('-200', '-500') : baseColor.split(' ')[2];
                              const textColor = baseColor.split(' ')[1];
                              const ResizeHandle = () => (
                                <div className={`w-3 h-3 bg-white border border-slate-300 rounded-full shadow-sm absolute -right-1.5 -bottom-1.5 ${isSelected ? 'block' : 'hidden group-hover:block'}`} />
                              );

                              return (
                                <Rnd
                                  scale={pdfScale}
                                  key={field.id}
                                  bounds="parent"
                                  size={{ width: field.width, height: field.height }}
                                  position={{ x: field.x, y: field.y }}
                                  dragGrid={[10, 10]}
                                  resizeGrid={[10, 10]}
                                  onDragStart={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                                  onDragStop={(e, data) => updateFieldPosition(field.id, data.x, data.y)}
                                  onResizeStop={(e, direction, ref, delta, position) => {
                                    updateFieldSize(field.id, parseInt(ref.style.width), parseInt(ref.style.height));
                                    updateFieldPosition(field.id, position.x, position.y);
                                  }}
                                  disableDragging={false}
                                  enableResizing={{ bottom: true, right: true, bottomRight: true }}
                                  resizeHandleComponent={{
                                    bottomRight: <ResizeHandle />
                                  }}
                                  className={`absolute border-2 rounded flex items-center justify-center group cursor-move z-40 hover:shadow-md transition-shadow ${bgColor} ${borderColor} ${isSelected ? 'shadow-md z-50' : 'shadow-sm'}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                                >
                                  <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center ${textColor}`}>
                                    {field.type} {field.required ? '*' : ''}
                                  </span>
                                </Rnd>
                              );
                            })}
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
