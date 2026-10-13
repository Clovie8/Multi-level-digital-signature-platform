import React, { useState, useEffect, useRef } from "react";
import { useAsyncLock } from "../../hooks/useAsyncLock";
import api from "../../lib/api";
import toast from "react-hot-toast";
import {
  PenTool,
  Upload,
  Lock,
  ShieldCheck,
  Trash2,
  X,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  RotateCcw,
  Sparkles,
  FileSignature,
  Eye,
  Eraser,
} from "lucide-react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import SignatureCanvas from "react-signature-canvas";

const PinInputBox = ({ pin, setPin }) => {
  const inputs = useRef([]);
  const [pinArray, setPinArray] = useState(Array(4).fill(""));

  useEffect(() => {
    if (!pin) setPinArray(Array(4).fill(""));
  }, [pin]);

  const updatePin = (newArray) => {
    setPinArray(newArray);
    setPin(newArray.join(""));
  };

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (!val) {
      const newPin = [...pinArray];
      newPin[index] = "";
      updatePin(newPin);
      return;
    }

    const char = val.replace(/\D/g, "").slice(-1);
    if (!char) return;

    const newPin = [...pinArray];
    newPin[index] = char;
    updatePin(newPin);

    if (index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !pinArray[index] && index > 0) {
      e.preventDefault();
      const newPin = [...pinArray];
      newPin[index - 1] = "";
      inputs.current[index - 1]?.focus();
      updatePin(newPin);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (pasted) {
      setPin(pasted);
      const nextIndex = pasted.length < 4 ? pasted.length : 3;
      inputs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="flex space-x-2.5 justify-center">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="password"
          maxLength="1"
          value={pin[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-11 h-13 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white shadow-sm transition-all text-slate-900"
        />
      ))}
    </div>
  );
};

export default function Signatures() {
  const [activeTab, setActiveTab] = useState("saved"); // 'saved' | 'upload'
  const [currentUser, setCurrentUser] = useState(null);
  const [savedSignatures, setSavedSignatures] = useState([]);
  const [hasPin, setHasPin] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Vault Unlock State
  const [vaultPin, setVaultPin] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // PIN Reset State
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [resetOtp, setResetOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // Delete State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Draw State
  const [padSize, setPadSize] = useState({ width: 600, height: 220 });
  const padContainerRef = useRef(null);
  const sigPadRef = useRef(null);
  const [drawPin, setDrawPin] = useState("");
  const [penColor, setPenColor] = useState("#0f172a");

  // Upload & Cropping State
  const [uploadedImage, setUploadedImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [uploadPin, setUploadPin] = useState("");

  // 1. Load User Profile and Signatures
  const fetchSignatures = async () => {
    setIsLoading(true);
    try {
      const [userRes, sigsRes] = await Promise.all([
        api.get("/api/auth/me"),
        api.get("/api/signatures").catch(() => ({ data: { hasPin: false, savedSignatures: [] } })),
      ]);

      setCurrentUser(userRes.data);
      setHasPin(sigsRes.data.hasPin || false);
      setSavedSignatures(sigsRes.data.savedSignatures || []);

      // If user has no PIN configured yet, the vault does not need unlocking
      if (!sigsRes.data.hasPin) {
        setIsVaultUnlocked(true);
      }
    } catch (err) {
      console.error("Failed to load signatures:", err);
      toast.error(err.response?.data?.error || "Failed to load signatures");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatures();
  }, []);

  // Responsive sizing for drawing canvas
  useEffect(() => {
    if (activeTab === "draw") {
      const updateSize = () => {
        if (padContainerRef.current) {
          const width = padContainerRef.current.offsetWidth;
          if (width > 0) {
            setPadSize({
              width,
              height: 220,
            });
          }
        }
      };
      const timer = setTimeout(updateSize, 60);
      window.addEventListener("resize", updateSize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateSize);
      };
    }
  }, [activeTab]);

  // 2. Unlock Vault with PIN
  const handleUnlockVault = async () => {
    if (vaultPin.length !== 4) {
      return toast.error("PIN must be exactly 4 digits.");
    }
    setIsUnlocking(true);
    try {
      await api.post("/api/signatures/verify-vault", {
        email: currentUser?.email,
        pin: vaultPin,
      });
      setIsVaultUnlocked(true);
      toast.success("Vault unlocked successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Incorrect PIN. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  };

  // 3. Request PIN Reset Code
  const handleForgotPin = async () => {
    setIsRequestingReset(true);
    try {
      await api.post("/api/signatures/reset-pin-request", {
        email: currentUser?.email,
      });
      setIsResettingPin(true);
      toast.success("A 6-digit reset code has been sent to your email.");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to request PIN reset.");
    } finally {
      setIsRequestingReset(false);
    }
  };

  // 4. Confirm PIN Reset
  const handleConfirmPinReset = async () => {
    if (resetOtp.length !== 6) {
      return toast.error("Please enter the 6-digit code from your email.");
    }
    if (newPin.length !== 4) {
      return toast.error("New PIN must be exactly 4 digits.");
    }
    setIsConfirmingReset(true);
    try {
      await api.post("/api/signatures/reset-pin-confirm", {
        email: currentUser?.email,
        otp: resetOtp,
        newPin: newPin,
      });
      setIsResettingPin(false);
      setResetOtp("");
      setNewPin("");
      setVaultPin(newPin);
      setHasPin(true);
      setIsVaultUnlocked(true);
      toast.success("PIN reset successfully. Your vault is now unlocked.");
    } catch (error) {
      toast.error(error.response?.data?.error || "Invalid or expired reset code.");
    } finally {
      setIsConfirmingReset(false);
    }
  };

  // 5. Delete Signature
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/signatures/${itemToDelete.id}`);
      setSavedSignatures((prev) => prev.filter((s) => s.id !== itemToDelete.id));
      toast.success("Signature removed from vault.");
      setItemToDelete(null);
    } catch (error) {
      console.error("Failed to delete signature:", error);
      toast.error(error.response?.data?.error || "Failed to remove signature.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 6. Handle Image Upload & Transparent Conversion
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return toast.error("Please select a valid image (.png or .jpg).");
    }

    if (file.size > 10 * 1024 * 1024) {
      return toast.error("File size exceeds 10MB limit.");
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setUploadedImage(reader.result);
      setCompletedCrop(null);
      setCrop(undefined);
    });
    reader.readAsDataURL(file);
  };

  // 7. Save Uploaded Signature
  const [handleSaveSignature, isSaving] = useAsyncLock(async () => {
    if (!completedCrop || !imgRef.current) {
      return toast.error("Please crop your signature before saving.");
    }

    if (!uploadPin || uploadPin.length !== 4) {
      return toast.error("Please enter your 4-digit Vault PIN to save.");
    }

    try {
      // Step A: Client-side crop and background transparency conversion
      const image = imgRef.current;
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );

      // Convert white/light background to transparent
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (r > 200 && g > 200 && b > 200) {
          data[i + 3] = 0; // Alpha 0
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Step B: Convert to Blob
      const processedBase64 = canvas.toDataURL("image/png");
      const processedBlob = await (await fetch(processedBase64)).blob();

      // Step C: Send FormData
      const formData = new FormData();
      formData.append("signatureImage", processedBlob, "signature.png");
      formData.append("signerName", currentUser?.name || "User");
      formData.append("signerEmail", currentUser?.email || "");
      formData.append("saveForFuture", "true");
      formData.append("pin", uploadPin);

      await api.post("/api/signatures/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Signature saved securely to your vault.");
      setUploadedImage(null);
      setCompletedCrop(null);
      setUploadPin("");
      setIsVaultUnlocked(true);
      setHasPin(true);

      // Refresh list & switch to saved tab
      await fetchSignatures();
      setActiveTab("saved");
    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to save signature. Please try again.";
      toast.error(errorMessage);
    }
  });

  // 8. Save Drawn Signature
  const [handleSaveDrawnSignature, isSavingDraw] = useAsyncLock(async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      return toast.error("Please draw your signature before saving.");
    }

    if (!drawPin || drawPin.length !== 4) {
      return toast.error("Please enter your 4-digit Vault PIN to save.");
    }

    try {
      const dataUrl = sigPadRef.current.getCanvas().toDataURL("image/png");
      const drawnBlob = await (await fetch(dataUrl)).blob();

      const formData = new FormData();
      formData.append("signatureImage", drawnBlob, "signature.png");
      formData.append("signerName", currentUser?.name || "User");
      formData.append("signerEmail", currentUser?.email || "");
      formData.append("saveForFuture", "true");
      formData.append("pin", drawPin);

      await api.post("/api/signatures/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Signature saved securely to your vault.");
      sigPadRef.current?.clear();
      setDrawPin("");
      setIsVaultUnlocked(true);
      setHasPin(true);

      // Refresh list & switch to saved tab
      await fetchSignatures();
      setActiveTab("saved");
    } catch (err) {
      console.error("Save drawn signature error:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to save drawn signature. Please try again.";
      toast.error(errorMessage);
    }
  });

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Digital Credentials
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
              <FileSignature className="h-7 w-7 text-slate-900" />
              Signatures & Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Manage your personal signatures and official stamps. Signatures stored in your vault can be applied instantly with your 4-digit PIN during document signing.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "saved"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Saved Signatures
              {savedSignatures.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-full font-bold">
                  {savedSignatures.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("draw")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "draw"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PenTool className="h-4 w-4" />
              Draw Signature
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "upload"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-slate-600" />
            <p className="text-sm font-medium">Loading your signature vault...</p>
          </div>
        ) : activeTab === "saved" ? (
          /* TAB 1: SAVED SIGNATURES */
          <div>
            {hasPin && !isVaultUnlocked ? (
              /* VAULT LOCKED STATE */
              <div className="max-w-md mx-auto my-8 p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-900 mb-4">
                  <Lock className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Signature Vault is Protected
                </h2>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Enter your 4-digit security PIN to access, preview, and manage your stored signatures.
                </p>

                <div className="mb-6">
                  <PinInputBox pin={vaultPin} setPin={setVaultPin} />
                </div>

                <button
                  onClick={handleUnlockVault}
                  disabled={isUnlocking || vaultPin.length !== 4}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUnlocking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying PIN...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" /> Unlock Vault
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleForgotPin}
                  disabled={isRequestingReset}
                  className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-800 underline transition-colors disabled:opacity-50"
                >
                  {isRequestingReset ? "Sending reset code..." : "Forgot your PIN?"}
                </button>
              </div>
            ) : savedSignatures.length === 0 ? (
              /* EMPTY STATE */
              <div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <PenTool className="h-8 w-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  No saved signatures yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                  Draw or upload your signature or official organization stamp to store it in your Cloudflare R2 vault for one-click signing.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveTab("draw")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <PenTool className="h-4 w-4" /> Draw Signature
                  </button>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Upload className="h-4 w-4" /> Upload Image
                  </button>
                </div>
              </div>
            ) : (
              /* SAVED SIGNATURES GRID */
              <div>
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Your Stored Credentials ({savedSignatures.length})
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedSignatures.map((sig, idx) => (
                    <div
                      key={sig.id || idx}
                      className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                    >
                      {/* Checkered pattern preview container for transparent pngs */}
                      <div
                        className="relative h-44 w-full p-6 flex items-center justify-center border-b border-slate-100 bg-slate-50"
                        style={{
                          backgroundImage:
                            "radial-gradient(#cbd5e1 0.75px, transparent 0.75px)",
                          backgroundSize: "12px 12px",
                        }}
                      >
                        <img
                          crossOrigin="anonymous"
                          src={sig.displayUrl}
                          alt={`Saved Signature ${idx + 1}`}
                          className="max-h-full max-w-full object-contain pointer-events-none filter drop-shadow-sm transition-transform group-hover:scale-105 duration-200"
                        />
                      </div>

                      {/* Card Footer Info & Actions */}
                      <div className="p-4 flex items-center justify-between bg-white mt-auto">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            Signature #{idx + 1}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {sig.createdAt ? new Date(sig.createdAt).toLocaleDateString() : "Active credential"}
                          </p>
                        </div>

                        <button
                          onClick={() => setItemToDelete(sig)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete signature"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "draw" ? (
          /* TAB 2: DRAW STUDIO */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-slate-900" />
                  Draw Your Signature
                </h2>
                {/* Pen Color Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPenColor("#0f172a")}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                      penColor === "#0f172a"
                        ? "bg-white shadow-sm ring-2 ring-slate-900"
                        : "hover:bg-slate-200"
                    }`}
                    title="Black Ink"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-900"></span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPenColor("#1d4ed8")}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                      penColor === "#1d4ed8"
                        ? "bg-white shadow-sm ring-2 ring-blue-600"
                        : "hover:bg-slate-200"
                    }`}
                    title="Blue Ink"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600"></span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Use your mouse, trackpad, or touchscreen to sign below. Your signature will be saved as a high-resolution transparent credential in your vault.
              </p>

              {/* Drawing Canvas Container */}
              <div className="space-y-6">
                <div className="relative">
                  <div
                    ref={padContainerRef}
                    className="w-full h-56 border-2 border-slate-300 rounded-xl bg-slate-50 relative overflow-hidden transition-colors hover:border-slate-400 focus-within:border-slate-900"
                  >
                    <SignatureCanvas
                      ref={sigPadRef}
                      penColor={penColor}
                      canvasProps={{
                        width: padSize.width,
                        height: padSize.height,
                        className: "cursor-crosshair w-full h-full",
                      }}
                    />

                    {/* Subtle Signing Baseline */}
                    <div className="absolute bottom-10 left-8 right-8 border-b border-dashed border-slate-300 pointer-events-none flex items-end">
                      <span className="text-[11px] font-semibold text-slate-300 select-none pb-0.5">✕</span>
                    </div>

                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => sigPadRef.current?.clear()}
                      className="absolute top-3 right-3 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center gap-1.5 transition-colors"
                      title="Clear canvas"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    Draw directly on the pad. The signature background will be automatically transparent.
                  </p>
                </div>

                {/* Vault PIN Security (Mandatory for saving to vault) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      {hasPin ? "Enter your 4-digit Vault PIN to save" : "Create a 4-digit Vault PIN"}
                    </label>
                    <p className="text-[11px] text-slate-500 mb-3">
                      {hasPin
                        ? "Enter your existing 4-digit PIN to authorize saving this credential to your secure vault."
                        : "Create a 4-digit PIN to secure your signatures for future one-click signing."}
                    </p>
                    <div className="flex items-center gap-4">
                      <PinInputBox pin={drawPin} setPin={setDrawPin} />
                      {hasPin && (
                        <button
                          type="button"
                          onClick={handleForgotPin}
                          disabled={isRequestingReset}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                        >
                          Forgot PIN?
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      sigPadRef.current?.clear();
                      setDrawPin("");
                      setActiveTab("saved");
                    }}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDrawnSignature}
                    disabled={isSavingDraw || drawPin.length !== 4}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSavingDraw ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Save to Vault
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 3: UPLOAD & CROP STUDIO */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Upload className="h-5 w-5 text-slate-900" />
                Upload New Signature or Stamp
              </h2>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Take a photo of your signature or official stamp on white paper. Our engine will crop it and automatically remove the white background so it looks authentic on digital documents.
              </p>

              {!uploadedImage ? (
                /* FILE DROPZONE */
                <div className="relative border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer group">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 transition-colors mb-4">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    Click or drag & drop image here
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Supports high-resolution PNG, JPG, or JPEG (up to 10MB)
                  </p>
                  <span className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-sm group-hover:bg-slate-800 transition-colors">
                    Browse Files
                  </span>
                </div>
              ) : (
                /* CROPPING & PREVIEW STUDIO */
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Drag corners to crop tightly:
                      </p>
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                      >
                        Change Image
                      </button>
                    </div>

                    <div className="flex justify-center bg-white p-2 rounded-lg border border-slate-200 max-h-[340px] overflow-auto">
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-[300px]"
                      >
                        <img
                          ref={imgRef}
                          src={uploadedImage}
                          alt="Crop preview"
                          className="max-h-[300px] object-contain"
                        />
                      </ReactCrop>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 text-center">
                      Any white background will automatically be converted to transparent upon saving.
                    </p>
                  </div>

                  {/* Vault PIN Security (Mandatory for saving to vault) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                        {hasPin ? "Enter your 4-digit Vault PIN to save" : "Create a 4-digit Vault PIN"}
                      </label>
                      <p className="text-[11px] text-slate-500 mb-3">
                        {hasPin
                          ? "Enter your existing 4-digit PIN to authorize saving this credential to your secure vault."
                          : "Create a 4-digit PIN to secure your signatures for future one-click signing."}
                      </p>
                      <div className="flex items-center gap-4">
                        <PinInputBox pin={uploadPin} setPin={setUploadPin} />
                        {hasPin && (
                          <button
                            type="button"
                            onClick={handleForgotPin}
                            disabled={isRequestingReset}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                          >
                            Forgot PIN?
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setUploadedImage(null)}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSignature}
                      disabled={isSaving || !completedCrop || uploadPin.length !== 4}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Save to Vault
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: RESET PIN VIA OTP */}
      {isResettingPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <RotateCcw className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reset Vault PIN
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              We sent a 6-digit verification code to <span className="font-semibold text-slate-700">{currentUser?.email}</span>. Enter the code and choose a new 4-digit PIN.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  6-Digit Email Code
                </label>
                <input
                  type="text"
                  maxLength="6"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-3 py-2 text-center text-lg font-bold tracking-widest border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength="4"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="****"
                  className="w-full px-3 py-2 text-center text-lg font-bold tracking-widest border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsResettingPin(false)}
                disabled={isConfirmingReset}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPinReset}
                disabled={isConfirmingReset || resetOtp.length !== 6 || newPin.length !== 4}
                className="flex-1 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isConfirmingReset ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...
                  </>
                ) : (
                  "Confirm Reset"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE SIGNATURE CONFIRMATION */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => !isDeleting && setItemToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Delete Signature?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete this signature? This action will permanently remove it from your vault and Cloudflare R2.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Delete Forever"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
