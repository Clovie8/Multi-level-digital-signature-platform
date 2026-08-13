import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { PenTool, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Rnd } from 'react-rnd';
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
  
  // Track which fields have been completed
  const [completedFields, setCompletedFields] = useState({});

  // OTP Authentication State
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

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
        // REPLACE headers WITH withCredentials
        const res = await axios.get(`http://localhost:5000/api/documents/sign/${token}`, {
          withCredentials: true
        });
        
        if (res.data.requiresOtp) {
          setRequiresOtp(true);
          setSignerInfo(res.data.signer);
          return;
        }

        setDocumentFile(res.data.pdfUrl); // The R2 URL or Blob
        setSignerInfo(res.data.signer);
        setFields(res.data.fields || []); 
        
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

  const handleRequestOtp = async () => {
    try {
      setIsLoading(true);
      await axios.post(`http://localhost:5000/api/documents/sign/${token}/request-otp`, {}, { withCredentials: true });
      setOtpSent(true);
      toast.success('Security code sent to your email');
    } catch (error) {
      toast.error('Failed to send security code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length !== 6) return setOtpError('Code must be 6 digits');
    try {
      setIsLoading(true);
      setOtpError('');
      // ADD withCredentials
      const res = await axios.post(`http://localhost:5000/api/documents/sign/${token}/verify-otp`, { otp: otpInput }, { withCredentials: true });

      // Verification Success! Unlock the document.
      setRequiresOtp(false);
      setDocumentFile(res.data.pdfUrl);
      setSignerInfo(res.data.signer);
      setFields(res.data.fields || []);
      toast.success('Authentication successful');
    } catch (error) {
      setOtpError(error.response?.data?.error || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

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
  const handleAdoptSignature = () => {
    try {
      if (signMode === 'draw') {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
          toast.error('Please draw your signature, or switch to the Type tab.');
          return;
        }
        // Capture the drawing as a Base64 PNG (using getCanvas to avoid getTrimmedCanvas bounds errors)
        const drawnDataURL = sigPadRef.current.getCanvas().toDataURL('image/png');
        setCompletedFields(prev => ({ ...prev, [activeFieldId]: drawnDataURL }));
      } else {
        if (!signatureText.trim()) {
          toast.error('Please enter your text/name.');
          return;
        }
        // Prefix typed text so the backend knows how to handle it
        setCompletedFields(prev => ({ ...prev, [activeFieldId]: `TYPED::${signatureText}` }));
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error adopting signature:", err);
      toast.error(`Failed to capture signature: ${err.message || 'Unknown error'}`);
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
      await axios.post(`http://localhost:5000/api/documents/sign/${token}/complete`, {
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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">Loading secure document...</div>;
  }

  if (requiresOtp) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 border border-slate-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Authentication Required</h2>
            <p className="text-slate-500 mt-2">
              To securely access this document, please verify your identity.
            </p>
          </div>
          
          {!otpSent ? (
            <button
              onClick={handleRequestOtp}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Security Code'}
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enter 6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="000000"
                />
                {otpError && <p className="text-red-500 text-sm mt-1 text-center">{otpError}</p>}
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || otpInput.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Unlock Document'}
              </button>
              <button
                onClick={handleRequestOtp}
                disabled={isLoading}
                className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
              >
                Resend Code
              </button>
            </div>
          )}
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
                    <PenTool className="h-3 w-3 mr-1" /> Sign Here
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
              {/* Toggle Draw / Type */}
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
              </div>

              {/* The Input Areas */}
              {signMode === 'draw' ? (
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
              ) : (
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

              <p className="text-xs text-slate-500 text-center mt-6 mb-6">By adopting this signature, you agree that it is a legally binding electronic representation of your signature.</p>

              <button 
                onClick={handleAdoptSignature}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Adopt and Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}