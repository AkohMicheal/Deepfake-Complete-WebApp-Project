"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, OrbitControls } from "@react-three/drei";
import {
  ShieldCheck,
  UploadCloud,
  AlertTriangle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Activity,
  CheckCircle,
  FileVideo,
  Image as ImageIcon,
  X,
  Loader2,
  ScanLine,
  Brain,
  FileCheck,
  Sparkles,
} from "lucide-react";
import * as THREE from "three";

// --- Configuration ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// --- File type helpers ---
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTENSIONS = [".mp4", ".mov"];
const ALL_ACCEPT =
  "video/mp4,video/quicktime,image/jpeg,image/png,image/webp";

function getFileExtension(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(name));
}

// --- Result type ---
interface ScanResult {
  status: string;
  confidence: number;
  isFake: boolean;
  explanation: string;
  framesAnalyzed: number;
  mediaType: "image" | "video";
}

// --- Pipeline step type ---
interface PipelineStep {
  label: string;
  icon: React.ReactNode;
  status: "pending" | "active" | "done";
}

// ==========================================
// 1. THE 3D COMPONENT (WebGL Context)
// ==========================================
function ScanningMesh({
  isScanning,
  resultType,
}: {
  isScanning: boolean;
  resultType: "idle" | "fake" | "real";
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x =
        state.clock.elapsedTime * (isScanning ? 2.5 : 0.5);
      meshRef.current.rotation.y =
        state.clock.elapsedTime * (isScanning ? 3.0 : 0.3);
    }
  });

  let meshColor = "#1e293b";
  if (isScanning) meshColor = "#3b82f6";
  else if (resultType === "fake") meshColor = "#ef4444";
  else if (resultType === "real") meshColor = "#10b981";

  return (
    <Sphere
      ref={meshRef}
      args={[1, 64, 64]}
      scale={isScanning ? 1.5 : 1.2}
    >
      <MeshDistortMaterial
        color={meshColor}
        attach="material"
        distort={
          isScanning ? 0.6 : resultType !== "idle" ? 0.4 : 0.2
        }
        speed={isScanning ? 5 : 2}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
}

// ==========================================
// 2. CONFIDENCE RING COMPONENT
// ==========================================
function ConfidenceRing({
  percentage,
  isFake,
}: {
  percentage: number;
  isFake: boolean;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = isFake ? "#ef4444" : "#10b981";
  const bgColor = isFake ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";

  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        {/* Background ring */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="8"
        />
        {/* Animated foreground ring */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="confidence-ring-animated"
          style={
            {
              "--ring-circumference": circumference,
              "--ring-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold font-mono"
          style={{ color }}
        >
          {percentage}%
        </span>
        <span className="text-xs text-slate-400 uppercase tracking-widest mt-1">
          Confidence
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 3. PIPELINE PROGRESS COMPONENT
// ==========================================
function PipelineProgress({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="w-full space-y-3 py-2">
      {steps.map((step, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-300 ${
            step.status === "active"
              ? "border-blue-500/40 bg-blue-500/5 scan-step-active"
              : step.status === "done"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-slate-800/50 bg-slate-900/30 opacity-40"
          }`}
        >
          <div
            className={`flex-shrink-0 ${
              step.status === "active"
                ? "text-blue-400"
                : step.status === "done"
                ? "text-emerald-400"
                : "text-slate-600"
            }`}
          >
            {step.status === "done" ? (
              <CheckCircle size={18} />
            ) : step.status === "active" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              step.icon
            )}
          </div>
          <span
            className={`text-sm font-medium ${
              step.status === "active"
                ? "text-blue-300"
                : step.status === "done"
                ? "text-emerald-300"
                : "text-slate-600"
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 4. THE MAIN UI COMPONENT
// ==========================================
export default function DeepfakeScannerApp() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-only mount for Three.js hydration fix
  useEffect(() => setMounted(true), []);

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Simulate pipeline step progression during scanning
  useEffect(() => {
    if (!isScanning) return;

    const timings = [300, 1500, 3000, 5000];
    const timers = timings.map((delay, i) =>
      setTimeout(() => setPipelineStep(i + 1), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isScanning]);

  // Haptic feedback
  const triggerHaptic = (type: "success" | "warning") => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      if (type === "warning") navigator.vibrate([200, 100, 200]);
      else navigator.vibrate([100]);
    }
  };

  // Share
  const handleShare = async () => {
    if (navigator.share && result) {
      try {
        await navigator.share({
          title: "Deepfake Scan Result",
          text: `I scanned a ${result.mediaType} with Dual-Stream AI. Result: ${result.status} (${result.confidence}% confidence).`,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      alert("Native sharing is not supported on this browser.");
    }
  };

  // File selection handler (shared between input and drop)
  const handleFileSelected = useCallback((selectedFile: File) => {
    // Validate extension
    const ext = getFileExtension(selectedFile.name);
    const allAllowed = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];
    if (!allAllowed.includes(ext)) {
      setResult({
        status: "Error: Unsupported format",
        confidence: 0,
        isFake: false,
        explanation: `"${ext}" is not supported. Please upload MP4, MOV, JPEG, PNG, or WebP files.`,
        framesAnalyzed: 0,
        mediaType: "image",
      });
      return;
    }

    // Validate size
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setResult({
        status: "Error: File too large",
        confidence: 0,
        isFake: false,
        explanation: `File size (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB) exceeds the maximum allowed size of 50 MB.`,
        framesAnalyzed: 0,
        mediaType: "image",
      });
      return;
    }

    // Generate preview
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setFile(selectedFile);
    setResult(null);
    setFeedbackGiven(false);
  }, []);

  // Input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelected(droppedFile);
    },
    [handleFileSelected]
  );

  // Clear selection
  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setFeedbackGiven(false);
    setPipelineStep(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Initiate scan
  const handleScan = async () => {
    if (!file) return;

    setIsScanning(true);
    setResult(null);
    setFeedbackGiven(false);
    setPipelineStep(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/scan`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || "Server error during inference"
        );
      }

      const data = await response.json();

      // Complete all pipeline steps
      setPipelineStep(5);

      // Small delay so user sees the final step complete
      await new Promise((r) => setTimeout(r, 400));

      if (data.is_fake) triggerHaptic("warning");
      else triggerHaptic("success");

      setResult({
        status: data.status,
        confidence: data.confidence,
        isFake: data.is_fake,
        explanation:
          data.explanation ||
          (data.is_fake
            ? "Anomalies detected in the high-frequency DCT spectrum."
            : "No synthetic artifacts detected."),
        framesAnalyzed: data.frames_analyzed || 1,
        mediaType: data.media_type || (isImageFile(file.name) ? "image" : "video"),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Scanning failed:", error);
      setResult({
        status: "Error: Could not process media",
        confidence: 0,
        isFake: false,
        explanation:
          error?.message || "Connection to AI server failed.",
        framesAnalyzed: 0,
        mediaType: isImageFile(file.name) ? "image" : "video",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Pipeline steps definition
  const isImage = file ? isImageFile(file.name) : false;
  const pipelineSteps: PipelineStep[] = [
    {
      label: "File uploaded securely",
      icon: <FileCheck size={18} />,
      status: pipelineStep > 0 ? "done" : isScanning ? "active" : "pending",
    },
    {
      label: isImage ? "Loading image" : "Extracting video frames",
      icon: isImage ? <ImageIcon size={18} /> : <FileVideo size={18} />,
      status:
        pipelineStep > 1
          ? "done"
          : pipelineStep === 1
          ? "active"
          : "pending",
    },
    {
      label: "Detecting faces via MTCNN",
      icon: <ScanLine size={18} />,
      status:
        pipelineStep > 2
          ? "done"
          : pipelineStep === 2
          ? "active"
          : "pending",
    },
    {
      label: "Dual-stream neural inference",
      icon: <Brain size={18} />,
      status:
        pipelineStep > 3
          ? "done"
          : pipelineStep === 3
          ? "active"
          : "pending",
    },
    {
      label: "Generating forensic report",
      icon: <Sparkles size={18} />,
      status:
        pipelineStep > 4
          ? "done"
          : pipelineStep === 4
          ? "active"
          : "pending",
    },
  ];

  // Determine result visual type
  const resultType: "idle" | "fake" | "real" = !result
    ? "idle"
    : result.isFake
    ? "fake"
    : "real";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      {/* HEADER */}
      <div className="max-w-3xl w-full text-center space-y-3 mb-8 z-10 mt-12">
        <div className="flex items-center justify-center space-x-3 text-blue-500 mb-2">
          <ShieldCheck size={36} />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Dual-Stream Scanner
          </h1>
        </div>
        <p className="text-slate-400 text-sm md:text-base px-4">
          Secure, real-time deepfake detection for images &amp; videos
          using spatial and frequency domain analysis.
        </p>
      </div>

      {/* 3D CANVAS BACKGROUND — Client-only with Suspense */}
      {mounted && (
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <Canvas>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={2} />
            <Suspense fallback={null}>
              <ScanningMesh
                isScanning={isScanning}
                resultType={resultType}
              />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
            />
          </Canvas>
        </div>
      )}

      {/* MAIN CARD */}
      <div className="max-w-lg w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 shadow-2xl z-10 mb-8">
        {/* ---- STATE: No result, no file selected → Upload Zone ---- */}
        {!result && !file && (
          <div
            className={`flex flex-col items-center justify-center space-y-6 py-8 rounded-2xl border-2 border-dashed transition-all duration-300 ${
              isDragging
                ? "drag-over-glow border-blue-500 bg-blue-500/5"
                : "border-slate-700/50 hover:border-slate-600"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className={`p-6 rounded-full transition-colors duration-300 ${
                isDragging
                  ? "bg-blue-500/20"
                  : "bg-slate-800/50"
              }`}
            >
              <UploadCloud
                size={48}
                className={
                  isDragging ? "text-blue-400" : "text-slate-400"
                }
              />
            </div>

            <div className="text-center px-4">
              <h2 className="text-xl font-semibold">
                {isDragging
                  ? "Drop to upload"
                  : "Upload Media"}
              </h2>
              <p className="text-xs text-slate-500 mt-2">
                Drag &amp; drop or click to browse
              </p>
              <p className="text-xs text-slate-600 mt-1">
                MP4, MOV, JPEG, PNG, WebP — Max 50 MB
              </p>
            </div>

            <label className="relative cursor-pointer group w-full sm:w-auto px-4">
              <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-200" />
              <div className="relative flex justify-center bg-slate-950 text-white px-8 py-4 rounded-xl border border-slate-800 hover:border-slate-700 transition font-medium w-full text-center">
                Select File
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALL_ACCEPT}
                onChange={handleInputChange}
              />
            </label>
          </div>
        )}

        {/* ---- STATE: File selected, not scanning, no result → Preview ---- */}
        {file && !result && !isScanning && (
          <div className="flex flex-col items-center space-y-5 animate-fade-in-up">
            {/* Preview */}
            <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              {isImageFile(file.name) ? (
                <img
                  src={previewUrl || ""}
                  alt="Preview"
                  className="w-full h-52 object-contain bg-black"
                />
              ) : (
                <video
                  src={previewUrl || ""}
                  controls
                  className="w-full h-52 object-contain bg-black"
                />
              )}
            </div>

            {/* File metadata */}
            <div className="w-full flex items-center gap-3 bg-slate-950/60 px-4 py-3 rounded-lg border border-slate-800">
              {isImageFile(file.name) ? (
                <ImageIcon size={20} className="text-blue-400 flex-shrink-0" />
              ) : (
                <FileVideo size={20} className="text-blue-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {isImageFile(file.name) ? "Image" : "Video"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
                aria-label="Remove file"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scan button */}
            <button
              type="button"
              onClick={handleScan}
              className="relative w-full group"
            >
              <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-40 group-hover:opacity-80 transition duration-200" />
              <div className="relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl transition font-semibold w-full">
                <ScanLine size={20} />
                Initiate Deepfake Scan
              </div>
            </button>
          </div>
        )}

        {/* ---- STATE: Scanning → Pipeline Progress ---- */}
        {isScanning && (
          <div className="flex flex-col items-center space-y-5 animate-fade-in-up">
            <div className="p-5 rounded-full bg-blue-500/20 animate-pulse">
              <ShieldCheck size={40} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-blue-300">
              Analyzing Media...
            </h2>
            <PipelineProgress steps={pipelineSteps} />
          </div>
        )}

        {/* ---- STATE: Result ---- */}
        {result && !isScanning && (
          <div className="flex flex-col items-center space-y-5 stagger-children">
            {/* Confidence Ring */}
            <div
              className={`rounded-2xl p-6 w-full ${
                result.isFake ? "glow-red" : "glow-green"
              }`}
            >
              <ConfidenceRing
                percentage={result.confidence}
                isFake={result.isFake}
              />
            </div>

            {/* Verdict */}
            <div className="text-center space-y-2 w-full">
              <div className="flex items-center justify-center gap-2">
                {result.isFake ? (
                  <AlertTriangle
                    size={22}
                    className="text-red-400"
                  />
                ) : (
                  <CheckCircle
                    size={22}
                    className="text-emerald-400"
                  />
                )}
                <h2
                  className={`text-2xl font-bold tracking-tight ${
                    result.isFake
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {result.status}
                </h2>
              </div>

              {/* Media type badge */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {result.mediaType === "image" ? (
                    <ImageIcon size={12} />
                  ) : (
                    <FileVideo size={12} />
                  )}
                  {result.mediaType === "image"
                    ? "Image Scan"
                    : `Video Scan · ${result.framesAnalyzed} frame${result.framesAnalyzed !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>

            {/* Detection Reasoning */}
            <div className="w-full bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <Activity size={16} className="text-blue-400" />
                <span className="font-semibold text-sm">
                  Detection Reasoning
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {result.explanation}
              </p>
            </div>

            {/* Feedback & Share Row */}
            <div className="flex justify-between items-center w-full pt-4 mt-1 border-t border-slate-800/50">
              <div className="flex space-x-3 items-center">
                <span className="text-xs text-slate-500 font-medium">
                  Feedback:
                </span>
                <button
                  type="button"
                  aria-label="Mark result as helpful"
                  onClick={() => setFeedbackGiven(true)}
                  className={`p-2 rounded-md transition ${
                    feedbackGiven
                      ? "text-blue-400 bg-blue-400/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Mark result as incorrect"
                  onClick={() => setFeedbackGiven(true)}
                  className={`p-2 rounded-md transition ${
                    feedbackGiven
                      ? "text-slate-600"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <ThumbsDown size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center space-x-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md transition"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>

            {/* Scan New */}
            <button
              onClick={handleClear}
              className="w-full py-3 text-sm text-slate-400 bg-slate-950 hover:text-white rounded-xl border border-slate-800 transition"
            >
              Scan New Media
            </button>
          </div>
        )}
      </div>
    </main>
  );
}