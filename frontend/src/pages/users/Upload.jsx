import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import {
  UploadCloud, Users, FileSignature, CheckCircle, Plus, Trash2,
  ArrowRight, PenTool, Calendar, Type, UserSquare, ChevronLeft, ChevronRight, Search, Send, X
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
    className={`flex items-center p-2 mb-2 bg-white border-l-4 ${activeColorClasses.split(' ')[2].replace('-200', '-500')} rounded shadow-sm cursor-grab hover:shadow transition-all`}
  >
    <Icon className={`h-3.5 w-3.5 mr-2 ${activeColorClasses.split(' ')[1].replace('-700', '-600')}`} />
    <span className="text-xs font-medium text-slate-700">{label}</span>
  </div>
);

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

  // Signer Hierarchy State
  const [isInitiatorFirst, setIsInitiatorFirst] = useState(false);
  const [signers, setSigners] = useState([
    { id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200' }
  ]);

  // Canvas State (Preparation Phase)
  const [activeSignerId, setActiveSignerId] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fields, setFields] = useState([]);

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
          if (draftConfig.isInitiatorFirst) setIsInitiatorFirst(draftConfig.isInitiatorFirst);
          if (draftConfig.currentStep) setCurrentStep(draftConfig.currentStep);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not load this draft.');
        navigate('/documents');
      }
    };
    loadDraft();
  }, [editDocumentId, navigate]);

  // UX State
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [isSignerDropdownOpen, setIsSignerDropdownOpen] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setTotalPages(numPages);
    setCurrentPage(1);
  };

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
    setSigners([...signers, {
      id: newIndex + 1,
      name: '',
      email: '',
      role: `Level ${newIndex + 1} Signer`,
      color: signerColors[newIndex]
    }]);
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

  const handleHierarchySubmit = () => {
    const isValid = signers.every(s => s.name.trim() !== '' && s.email.trim() !== '');
    if (!isValid) return toast.error('Please fill out all signer details.');

    // Set the first signer active for the tagging canvas
    setActiveSignerId(signers[0].id);
    setCurrentStep(3);
  };

  const handleSaveAsDraft = async () => {
    setIsLoading(true);
    try {
      await api.patch(`/api/documents/${documentId}/draft-config`, { signers, fields, isInitiatorFirst, currentStep });
      toast.success('Saved as draft.');
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save this draft.');
    } finally {
      setIsLoading(false);
    }
  };

  // DISPATCH HANDLER
  const handleDispatchDocument = async () => {
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');

      // We now include the dragged 'fields' in the payload
      const res = await api.post(`/api/documents/${documentId}/dispatch`, {
        signers: signers,
        fields: fields
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success(res.data.message);

      if (res.data.isInitiatorFirst && res.data.redirectToken) {
        // Path A: Redirect instantly to signing canvas
        navigate(`/sign/${res.data.redirectToken}`);
      } else {
        // Path B: Third party is first, reset dashboard
        setCurrentStep(1);
        setFile(null);
        setDocumentId(null);
        setFields([]);
        setSigners([{ id: 1, name: '', email: '', role: 'Level 1 Signer', color: 'bg-blue-100 text-blue-700 border-blue-200' }]);
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

  const handleDrop = (e) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData('fieldType');
    if (!fieldType) return;

    const fieldAlreadyExists = fields.some(
      (f) => f.type === fieldType && f.signerId === activeSignerId
    );

    if (fieldAlreadyExists) {
      toast.error(`You have already placed a ${fieldType} for this signer.`);
      return;
    }

    // Calculate drop coordinates relative to the PDF container
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    const xPct = (x / bounds.width) * 100;
    const yPct = (y / bounds.height) * 100;

    const newField = {
      id: `field_${Date.now()}`,
      type: fieldType,
      signerId: activeSignerId,
      page: currentPage,
      x: x,
      y: y,
      xPct: xPct,
      yPct: yPct,
      width: fieldType === 'Text Box' ? 150 : 100,
      height: fieldType === 'Text Box' ? 30 : 35,
      required: true
    };

    setFields([...fields, newField]);
    setSelectedFieldId(newField.id); // Auto-select new field
  };

  const updateFieldPosition = (id, newX, newY) => {
    const dropzone = document.getElementById('pdf-dropzone');
    if (!dropzone) return;
    const bounds = dropzone.getBoundingClientRect();
    const xPct = (newX / bounds.width) * 100;
    const yPct = (newY / bounds.height) * 100;

    setFields(prev => prev.map(f => f.id === id ? { ...f, x: newX, y: newY, xPct: xPct, yPct: yPct } : f));
  };

  const updateFieldSize = (id, width, height) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, width, height } : f));
  };

  const updateFieldProperty = (id, property, value) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [property]: value } : f));
  };

  const deleteField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const activeSigner = signers.find(s => s.id === activeSignerId) || signers[0];
  const canvasFileSource = file || existingFile?.url || null;
  const activeColorClasses = activeSigner.color; // e.g. "bg-blue-100 text-blue-700 border-blue-200"

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pb-12">
      <main className={`mx-auto mt-8 px-4 sm:px-6 transition-all duration-500 ${currentStep === 3 ? 'max-w-6xl' : 'max-w-4xl'}`}>

        {/* Stepper Navigation */}
        <div className="flex justify-center items-center space-x-8 sm:space-x-16 mb-10">
          <StepIcon stepNumber={1} current={currentStep} icon={UploadCloud} title="Upload PDF" />
          <div className="h-px w-12 sm:w-24 bg-slate-200 mb-6"></div>
          <StepIcon stepNumber={2} current={currentStep} icon={Users} title="Set Hierarchy" />
          <div className="h-px w-12 sm:w-24 bg-slate-200 mb-6"></div>
          <StepIcon stepNumber={3} current={currentStep} icon={FileSignature} title="Tag Document" />
        </div>

        {/* STEP 1 UI: UPLOAD */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Upload your document</h2>
            <p className="text-slate-500 text-sm mb-8">Securely upload the PDF you need signed. It will be encrypted and stored in Cloudflare R2.</p>

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

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleUploadSubmit}
                disabled={isLoading || (!file && !existingFile)}
                className="flex items-center py-2.5 px-6 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Uploading securely...' : 'Continue to Hierarchy'} <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 UI: HIERARCHY */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Define Routing Hierarchy</h2>
            <p className="text-slate-500 text-sm mb-6">Who needs to sign this document? The system will route it sequentially from Level 1 downwards.</p>

            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center">
              <input
                type="checkbox"
                id="meFirst"
                checked={isInitiatorFirst}
                onChange={toggleInitiatorFirst}
                className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="meFirst" className="ml-3 block text-sm font-medium text-slate-900 cursor-pointer">
                I am the first signer
              </label>
            </div>

            <div className="space-y-4">
              {signers.map((signer, index) => (
                <div key={signer.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-100 bg-white rounded-lg shadow-sm relative">
                  <div className="w-full sm:w-1/4 flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${signer.color}`}>
                      {signer.role}
                    </span>
                  </div>
                  <div className="w-full sm:w-1/3">
                    <input
                      type="text"
                      placeholder="Signer Name"
                      value={signer.name}
                      disabled={signer.locked}
                      onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                      className="block w-full text-sm border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 py-2 px-3 border"
                    />
                  </div>
                  <div className="w-full sm:w-1/3">
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={signer.email}
                      disabled={signer.locked}
                      onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                      className="block w-full text-sm border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 py-2 px-3 border"
                    />
                  </div>
                  {index > 0 && (
                    <button onClick={() => removeSigner(index)} className="absolute -right-2 -top-2 sm:static sm:mt-2 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button onClick={addSigner} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                <Plus className="h-4 w-4 mr-1" /> Add Next Signer
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setCurrentStep(1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 mr-2 hover:bg-slate-50 hover:border-slate-400 transition-colors">
                Back
              </button>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveAsDraft} disabled={isLoading} className="px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save as draft'}
                </button>
                <button onClick={handleHierarchySubmit} className="flex items-center py-2.5 px-6 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors">
                  Continue to Canvas <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 UI: THE CANVAS WORKSPACE */}
        {currentStep === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[750px] animate-in fade-in slide-in-from-right-4 duration-500">

            {/* Left Sidebar: Tool Panel */}
            <div className="w-full md:w-56 bg-slate-50 border-r border-slate-200 flex flex-col z-20 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.1)]">

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
              <div className="p-3 flex-1 overflow-y-auto">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Standard Fields</label>
                <DraggableField icon={PenTool} label="Signature" type="Signature" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                <DraggableField icon={Type} label="Initial" type="Initial" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                <DraggableField icon={Calendar} label="Date Signed" type="Date" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />

                <div className="mt-4 mb-2 h-px bg-slate-200"></div>

                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Data Fields</label>
                <DraggableField icon={UserSquare} label="Name" type="Name" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
                <DraggableField icon={Type} label="Text Box" type="Text Box" activeColorClasses={activeColorClasses} onDragStart={handleDragStart} />
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
                  <button onClick={() => setCurrentStep(2)} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 mr-2 hover:bg-slate-50 hover:border-slate-400 transition-colors">
                    Back
                  </button>
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage <= 1} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="text-sm font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
                </div>

                <div className="flex items-center space-x-1 border-l border-r border-slate-200 px-4">
                  <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><Search className="h-4 w-4" /></button>
                  <span className="text-xs font-medium text-slate-500 w-12 text-center">100%</span>
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
                className="flex-1 overflow-auto p-8 flex justify-center relative bg-slate-200/50"
                onClick={() => setSelectedFieldId(null)}
              >
                <div
                  id="pdf-dropzone"
                  className={`relative shadow-lg border border-slate-200 bg-white w-[750px] mx-auto ${canvasFileSource ? 'h-fit' : 'min-h-[500px]'}`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {canvasFileSource ? (
                    <Document
                      file={canvasFileSource}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<div className="p-20 text-slate-400 flex justify-center w-[750px]">Loading document...</div>}
                      error={<div className="p-20 text-red-500 flex justify-center w-[750px]">Failed to load PDF.</div>}
                    >
                      <Page
                        pageNumber={currentPage}
                        width={750}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-sm"
                      />
                    </Document>
                  ) : (
                    <div className="w-[750px] aspect-[8.5/11] flex flex-col items-center justify-center">
                      <FileSignature className="h-16 w-16 text-slate-300 mb-4" />
                      <p className="text-slate-400 font-medium">No document loaded</p>
                    </div>
                  )}

                  {/* Render Placed Fields for Current Page */}
                  {fields.filter(f => f.page === currentPage).map((field) => {
                    const signer = signers.find(s => s.id === field.signerId);
                    const isSelected = selectedFieldId === field.id;
                    const baseColor = signer ? signer.color : 'bg-slate-100 text-slate-700 border-slate-200';
                    const bgColor = isSelected ? baseColor.split(' ')[0].replace('-100', '-200') : baseColor.split(' ')[0];
                    const borderColor = isSelected ? baseColor.split(' ')[2].replace('-200', '-500') : baseColor.split(' ')[2];
                    const textColor = baseColor.split(' ')[1];
                    // Visual handle for resizing
                    const ResizeHandle = () => (
                      <div className={`w-3 h-3 bg-white border border-slate-300 rounded-full shadow-sm absolute -right-1.5 -bottom-1.5 ${isSelected ? 'block' : 'hidden group-hover:block'}`} />
                    );

                    return (
                      <Rnd
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
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}