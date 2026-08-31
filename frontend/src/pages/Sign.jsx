import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { PenTool, CheckCircle, ChevronLeft, ChevronRight, X, Upload } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Rnd } from 'react-rnd';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function Sign() {
  const { token } = useParams(); // Grab the secure token from the URL
  const navigate = useNavigate();

  //Gran the OTP from URL
  const [searchParams] = useSearchParams();
  const urlOtp = searchParams.get('otp');

  // Document & Signer State
  const [isLoading, setIsLoading] = useState(true);
  const [documentFile, setDocumentFile] = useState(null);
  const [signerInfo, setSignerInfo] = useState(null);
  const [fields, setFields] = useState([]);

  // PDF Viewer State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const containerRef = useRef(null);

  // Signature Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [signatureText, setSignatureText] = useState('');
  const sigPadRef = useRef(null);
  const padContainerRef = useRef(null);
  const [signMode, setSignMode] = useState('draw'); // 'draw' or 'type'
  const [padSize, setPadSize] = useState({ width: 450, height: 160 });

  // Image Upload & Cropping State
  const [uploadedImage, setUploadedImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false); // Used for upload loading state
  const [savedSignatures, setSavedSignatures] = useState([]);
  const [selectedSavedSignature, setSelectedSavedSignature] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Track which fields have been completed
  const [completedFields, setCompletedFields] = useState({});

  // OTP Authentication State
  const [requiresOtp, setRequiresOtp] = useState(false);

  // Decline State
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Fix Signature Canvas Scaling
  useEffect(() => {
    if (isModalOpen && signMode === 'draw') {
      // Small timeout to allow DOM to render the modal size
      setTimeout(() => {
        if (padContainerRef.current) {
          setPadSize({
            width: padContainerRef.current.offsetWidth,
            height: padContainerRef.current.offsetHeight
          });
        }
      }, 50);
    }
  }, [isModalOpen, signMode]);

  // 1. Fetch Document Data on Load
  useEffect(() => {
    const fetchSigningData = async () => {
      try {
        const requestUrl = urlOtp ? `/api/documents/sign/${token}?otp=${urlOtp}` : `/api/documents/sign/${token}`;
        const res = await api.get(requestUrl);

        if (res.data.requiresOtp) {
          setRequiresOtp(true);
          setSignerInfo(res.data.signer);
          return;
        }

        setDocumentFile(res.data.pdfUrl); // The R2 URL or Blob
        setSignerInfo(res.data.signer);
        setFields(res.data.fields || []);
        setSavedSignatures(res.data.savedSignatures || []);

      } catch (error) {
        console.error('Failed to load document:', error);
        toast.error(error.response?.data?.error || 'Invalid or expired signing link.');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchSigningData();
  }, [token, navigate]);


  const onDocumentLoadSuccess = ({ numPages }) => {
    setTotalPages(numPages);
  };

  // 2. Handle Opening the Signature Modal
  const handleFieldClick = (field) => {
    setActiveFieldId(field.id);
    if (field.type === 'Signature' || field.type === 'Initial') {
      setSignMode('draw');
      setIsModalOpen(true);
      if (!signatureText) setSignatureText(signerInfo?.name || '');
    } else if (field.type === 'Text Box' || field.type === 'Name') {
      setSignMode('type');
      setIsModalOpen(true);
      if (!signatureText) setSignatureText(field.type === 'Name' ? (signerInfo?.name || '') : '');
    } else if (field.type === 'Date') {
      // Auto-fill dates instantly without opening a modal
      setCompletedFields(prev => ({
        ...prev,
        [field.id]: new Date().toLocaleDateString()
      }));
    }
  };

  // 3. Adopt Signature and Apply to Field
  const handleAdoptSignature = async () => {
    try {
      if (signMode === 'draw') {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) return toast.error('Please draw your signature.');
        const drawnDataURL = sigPadRef.current.getCanvas().toDataURL('image/png');
        setCompletedFields(prev => ({ ...prev, [activeFieldId]: drawnDataURL }));
        setIsModalOpen(false);

      } else if (signMode === 'type') {
        if (!signatureText.trim()) return toast.error('Please enter your text/name.');
        setCompletedFields(prev => ({ ...prev, [activeFieldId]: `TYPED::${signatureText}` }));
        setIsModalOpen(false);

      } else if (signMode === 'upload') {
        if (!completedCrop || !imgRef.current) return toast.error('Please crop your uploaded signature.');
        setIsAdopting(true);

        // 1. Client-Side Cropping & Transparency Filter
        const image = imgRef.current;
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;
        const ctx = canvas.getContext('2d');

        // Draw cropped area
        ctx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0, 0, completedCrop.width, completedCrop.height
        );

        // Process transparency (convert white background to transparent)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          if (r > 200 && g > 200 && b > 200) { 
            data[i+3] = 0; // Set alpha to 0 (transparent) for white pixels
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // 2. Convert to Blob & Upload to Phase 2 Endpoint
        const processedBase64 = canvas.toDataURL('image/png');
        const processedBlob = await (await fetch(processedBase64)).blob();
        
        const formData = new FormData();
        formData.append('signatureImage', processedBlob, 'signature.png');
        formData.append('signerName', signerInfo?.name || 'Guest Signer');
        formData.append('signerEmail', signerInfo?.email || 'guest@example.com');
        formData.append('saveForFuture', saveForFuture); 

        const uploadRes = await api.post('/api/signatures/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        // 3. Save Base64 for instant UI preview, and inject R2 URL into the payload for the backend
        setFields(fields.map(f => f.id === activeFieldId ? { ...f, imageUrl: uploadRes.data.signature.signature_url } : f));
        setCompletedFields(prev => ({ ...prev, [activeFieldId]: processedBase64 }));
        
        setIsModalOpen(false);
        setUploadedImage(null); // Reset for next time

      } else if (signMode === 'saved') {
        if (!selectedSavedSignature) return toast.error('Please select a saved signature.');
        
        setIsAdopting(true);
        try {
            // Fetch the image from the secure URL and convert it to Base64 for the PDF stamper
            const response = await fetch(selectedSavedSignature.displayUrl, { 
                mode: 'cors',
                cache: 'no-cache' 
            });
            const blob = await response.blob();
            const reader = new FileReader();
            
            reader.onloadend = () => {
                // Inject the actual Base64 image data so the PDF stamper can see it
                setFields(fields.map(f => f.id === activeFieldId ? { ...f, imageUrl: selectedSavedSignature.originalKey } : f));
                setCompletedFields(prev => ({ ...prev, [activeFieldId]: reader.result }));
                
                setIsModalOpen(false);
                setIsAdopting(false);
            };
            
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error("Failed to load saved image for stamping:", error);
            toast.error("Failed to load the saved signature.");
            setIsAdopting(false);
        }
      }
    } catch (err) {
      console.error("Error adopting signature:", err);
      toast.error(`Failed to capture signature: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAdopting(false);
    }
  };

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setUploadedImage(reader.result));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDeleteSignature = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDeletingId(id); 
    try {
      await api.delete(`/api/signatures/${id}`);
      
      const remainingSignatures = savedSignatures.filter(sig => sig.id !== id);
      setSavedSignatures(remainingSignatures);
      
      if (selectedSavedSignature?.id === id) setSelectedSavedSignature(null);
      setConfirmDeleteId(null); 
      
      if (remainingSignatures.length === 0) {
        setSignMode('upload');
      }

      toast.success('Signature removed.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove signature.');
    } finally {
      setDeletingId(null); 
    }
  };

  // 4. Final Submission
  const handleCompleteDocument = async () => {
    // Check if all required fields are filled
    if (Object.keys(completedFields).length < fields.length) {
      return toast.error('Please complete all assigned fields before finishing.');
    }

    setIsLoading(true);
    try {
      await api.post(`/api/documents/sign/${token}/complete`, {
        completedFields,
        updatedFields: fields
      });

      toast.success('Document successfully signed and sealed!');

      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      if (isAuthenticated) {
        navigate('/'); // Send the Initiator back to their Dashboard
      } else {
        navigate('/login'); // Send third-party signers away from the canvas
      }

    } catch (error) {
      console.error('Failed to submit:', error);
      toast.error('Failed to save signature. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDeclineClick = () => {
    setIsDeclineModalOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!declineReason.trim()) {
      toast.error('Please explain why you are declining.');
      return;
    }

    setIsDeclineModalOpen(false);
    setIsLoading(true);
    try {
      await api.post(`/api/documents/sign/${token}/decline`, {
        reason: declineReason
      });
      toast.success('Document declined. The initiator has been notified.');
      navigate('/login');
    } catch (error) {
      console.error('Failed to decline:', error);
      toast.error(error.response?.data?.error || 'Failed to decline document. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">Loading secure document...</div>;
  }

  if (requiresOtp) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 border border-slate-200 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
              <X className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Secure Link Expired</h2>
          <p className="text-slate-500 mt-2 mb-6">
            For your security, this document link is invalid or has expired. Please contact the initiator to request a new link.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!documentFile && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-xl text-slate-500">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] font-sans overflow-hidden">

      {/* PUBLIC HEADER - Clean and locked down */}
      <header className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center mr-3">
            <PenTool className="text-white h-4 w-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">DSign</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right mr-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Signing As</p>
            <p className="text-sm font-semibold text-slate-900">{signerInfo?.name || 'Guest Signer'}</p>
          </div>
          <button
            onClick={handleCompleteDocument}
            className="flex items-center py-2 px-6 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            <CheckCircle className="mr-2 h-4 w-4" /> Finish
          </button>

          <button
            onClick={handleDeclineClick}
            className="flex items-center py-2 px-6 bg-white border border-red-300 text-red-600 text-sm font-medium rounded hover:bg-red-50 transition-colors"
          >
            <X className="mr-2 h-4 w-4" /> Decline
          </button>
        </div>
      </header>

      {/* PDF VIEWER AND CANVAS */}
      <main className="flex-1 overflow-auto bg-slate-200/50 flex flex-col relative py-8">

        {/* Pagination Controls */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center space-x-4 z-20">
          <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage <= 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-sm font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages} className="text-slate-400 hover:text-slate-900 disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {/* The PDF Container */}
        <div className="mx-auto relative shadow-xl border border-slate-200 bg-white" ref={containerRef}>
          <Document
            file={documentFile} // URL from backend
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="p-20 text-slate-400 w-[750px] text-center">Decrypting document...</div>}
          >
            <Page
              pageNumber={currentPage}
              width={750}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Render Assigned Fields overlaying the PDF */}
          {fields.filter(f => f.page === currentPage).map((field) => {
            const isCompleted = !!completedFields[field.id];

            return (
              <Rnd
                key={field.id}
                bounds="parent"
                size={{ width: field.width || 120, height: field.height || 40 }}
                position={{ x: field.x || 0, y: field.y || 0 }}
                disableDragging={true}
                enableResizing={{ bottom: true, right: true, bottomRight: true }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const newWidth = parseInt(ref.style.width);
                  const newHeight = parseInt(ref.style.height);
                  setFields(fields.map(f => f.id === field.id ? { ...f, width: newWidth, height: newHeight } : f));
                }}
                className={`absolute cursor-pointer border-2 rounded shadow-sm transition-colors flex items-center justify-center z-30 hover:shadow-md
                  ${isCompleted
                    ? 'bg-blue-50 border-blue-400 text-blue-900'
                    : 'bg-amber-100/90 border-amber-400 text-amber-800 animate-pulse hover:animate-none hover:bg-amber-200/90'
                  }`}
                onClick={() => handleFieldClick(field)}
              >
                {isCompleted ? (
                  <span className={`text-lg font-medium overflow-hidden max-h-full w-full flex items-center justify-center ${field.type === 'Signature' || field.type === 'Initial' ? 'font-[cursive]' : ''}`}>
                    {completedFields[field.id].startsWith('data:image/') ? (
                      <img src={completedFields[field.id]} alt="Signature" className="max-h-full max-w-full object-contain pointer-events-none" />
                    ) : (
                      completedFields[field.id].replace('TYPED::', '')
                    )}
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center pointer-events-none">
                    {field.type === 'Signature' || field.type === 'Initial' ? (
                      <><PenTool className="h-3 w-3 mr-1" /> Sign Here</>
                    ) : (
                      field.type
                    )}
                  </span>
                )}
              </Rnd>
            );
          })}
        </div>
      </main>

      {/* SIGNATURE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">Adopt Your Signature</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6">
              {/* Toggle Draw / Type / Upload */}
              <div className="flex space-x-4 mb-4 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setSignMode('draw')}
                  className={`pb-2 text-sm font-medium transition-colors ${signMode === 'draw' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Draw
                </button>
                <button
                  onClick={() => setSignMode('type')}
                  className={`pb-2 text-sm font-medium transition-colors ${signMode === 'type' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Type
                </button>
                <button
                  onClick={() => setSignMode('upload')}
                  className={`pb-2 text-sm font-medium transition-colors ${signMode === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Upload
                </button>

                {savedSignatures.length > 0 && (
                  <button
                    onClick={() => setSignMode('saved')}
                    className={`pb-2 text-sm font-medium transition-colors ${signMode === 'saved' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Saved
                  </button>
                )}
              </div>

              {/* The Input Areas */}
              {signMode === 'draw' && (
                <div ref={padContainerRef} className="w-full h-40 border border-slate-300 rounded-lg bg-slate-50 relative">
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="black"
                    canvasProps={{
                      width: padSize.width,
                      height: padSize.height,
                      className: 'rounded-lg cursor-crosshair'
                    }}
                  />
                  <button
                    onClick={() => sigPadRef.current.clear()}
                    className="absolute top-2 right-2 text-xs font-medium text-slate-400 hover:text-slate-600 bg-white px-2 py-1 rounded shadow-sm border border-slate-200"
                  >
                    Clear
                  </button>
                </div>
              )}

              {signMode === 'type' && (
                <div>
                  <input
                    type="text"
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    className="w-full text-lg px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                    placeholder="John Doe"
                  />
                  <div className="bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center min-h-[100px]">
                    <span className="text-4xl text-slate-800" style={{ fontFamily: "'Cedarville Cursive', cursive, serif" }}>
                      {signatureText || 'Preview'}
                    </span>
                  </div>
                </div>
              )}

              {signMode === 'upload' && (
                <div className="w-full border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center min-h-[160px] p-4 relative">
                  {!uploadedImage ? (
                    <>
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600 font-medium">Upload a photo of your signature</p>
                      <p className="text-xs text-slate-400 mb-4">Accepts .jpg and .png</p>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg" 
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <button className="px-4 py-2 bg-white border border-slate-200 rounded shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors">
                        Browse Files
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <p className="text-xs text-slate-500 mb-2 w-full text-left font-medium">Drag the corners to crop your signature tightly:</p>
                      <ReactCrop 
                        crop={crop} 
                        onChange={c => setCrop(c)} 
                        onComplete={c => setCompletedCrop(c)}
                        className="max-h-[250px] rounded border border-slate-200"
                      >
                        <img ref={imgRef} src={uploadedImage} alt="Crop preview" className="max-h-[250px] object-contain" />
                      </ReactCrop>
                      <button 
                        onClick={() => setUploadedImage(null)} 
                        className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove Image
                      </button>
                    </div>
                  )}

                  {uploadedImage && (
                    <div className="w-full flex items-center mt-4 bg-blue-50 border border-blue-100 p-3 rounded-lg">
                      <input
                        id="saveSignature"
                        type="checkbox"
                        checked={saveForFuture}
                        onChange={(e) => setSaveForFuture(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="saveSignature" className="ml-2 block text-sm text-blue-900 font-medium cursor-pointer">
                        Save this signature for future use.
                      </label>
                    </div>
                  )}
                </div>
              )}

              {signMode === 'saved' && (
                <div className="w-full border border-slate-300 rounded-lg bg-slate-50 p-4 min-h-[160px]">
                  <p className="text-sm font-medium text-slate-700 mb-3">Select a saved signature:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {savedSignatures.map((sig, index) => (
                      <div 
                        key={index}
                        onClick={() => {
                          // Prevent selecting the signature if they are in the middle of deleting it
                          if (confirmDeleteId !== sig.id) setSelectedSavedSignature(sig);
                        }}
                        className={`cursor-pointer border-2 rounded-lg flex flex-col overflow-hidden bg-white transition-all ${
                          selectedSavedSignature?.id === sig.id ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {confirmDeleteId === sig.id ? (
                          /* INLINE CONFIRMATION STATE */
                          <div className="flex flex-col h-full bg-red-50 justify-center items-center p-3 text-center animate-in fade-in duration-200">
                            <p className="text-sm font-bold text-red-800 mb-1">Delete signature?</p>
                            <p className="text-[10px] text-red-600 mb-3 leading-tight">This will permanently remove it from your account.</p>
                            <div className="flex space-x-2 w-full mt-auto">
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm"
                              >
                                Cancel
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => handleDeleteSignature(e, sig.id)}
                                disabled={deletingId === sig.id}
                                className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                              >
                                {deletingId === sig.id ? 'Removing...' : 'Confirm'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* NORMAL CARD STATE */
                          <>
                            <div className="h-24 p-2 flex items-center justify-center bg-slate-50 border-b border-slate-100">
                              <img 
                                crossOrigin="anonymous"
                                src={sig.displayUrl} 
                                alt="Saved Signature" 
                                className="max-h-full max-w-full object-contain pointer-events-none" 
                              />
                            </div>
                            
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(sig.id); }}
                              className="w-full py-2 flex items-center justify-center text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                            >
                              Remove <X className="h-3.5 w-3.5 ml-1" strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


              <p className="text-xs text-slate-500 text-center mt-4 mb-4">By adopting this signature, you agree that it is a legally binding electronic representation of your signature.</p>

              <button
                onClick={handleAdoptSignature}
                disabled={isAdopting}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                {isAdopting ? 'Processing...' : 'Adopt and Sign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE MODAL */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDeclineModalOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">Decline to Sign</h3>
              <button onClick={() => setIsDeclineModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                This will halt the entire signing workflow and notify the initiator. Please explain why you're declining.
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="e.g. Incorrect terms in section 3, wrong signer assigned..."
              />
              <p className="text-xs text-slate-400 text-right mt-1">{declineReason.length}/500</p>

              <button
                onClick={handleConfirmDecline}
                disabled={!declineReason.trim()}
                className="w-full mt-4 py-3 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}