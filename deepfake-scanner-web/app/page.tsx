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
  Search,
  Trash2,
  History,
  User,
  LogOut,
  Lock,
  Mail,
  Filter,
  ArrowLeft,
  ChevronRight,
  Sun,
  Moon,
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
  gradcamBase64?: string;
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
  theme = "dark",
}: {
  isScanning: boolean;
  resultType: "idle" | "fake" | "real";
  theme?: "dark" | "light";
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

  let meshColor = theme === "light" ? "#94a3b8" : "#1e293b";
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
        roughness={theme === "light" ? 0.4 : 0.2}
        metalness={theme === "light" ? 0.5 : 0.8}
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
  theme = "dark",
}: {
  percentage: number;
  isFake: boolean;
  theme?: "dark" | "light";
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = isFake ? "#ef4444" : "#10b981";
  const bgColor = isFake
    ? (theme === "light" ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)")
    : (theme === "light" ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)");

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
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-semibold">
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
              ? "border-blue-500/50 bg-blue-50/80 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/5 dark:text-blue-300 scan-step-active"
              : step.status === "done"
              ? "border-emerald-500/40 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-300"
              : "border-slate-200 bg-slate-50/60 text-slate-400 dark:border-slate-800/50 dark:bg-slate-900/30 dark:text-slate-600 opacity-60 dark:opacity-40"
          }`}
        >
          <div
            className={`flex-shrink-0 ${
              step.status === "active"
                ? "text-blue-600 dark:text-blue-400"
                : step.status === "done"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400 dark:text-slate-600"
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
          <span className="text-sm font-medium">
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

  // --- Theme State ---
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // --- New Feature States ---
  const [activeTab, setActiveTab] = useState<"scanner" | "history">("scanner");
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // History States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "image" | "video" | "real" | "fake">("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  interface HistoryItem {
    id: string;
    filename: string;
    mediaType: "image" | "video";
    sizeBytes: number;
    status: string;
    confidence: number;
    isFake: boolean;
    explanation: string;
    date: string;
    userEmail?: string;
  }

  // Client-only mount for Three.js hydration fix and loading data
  useEffect(() => {
    setMounted(true);

    // Load theme
    try {
      const savedTheme = localStorage.getItem("deepfake_theme") as "dark" | "light" | null;
      if (savedTheme === "light") {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      } else {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    } catch (e) {}

    // Load active session
    const session = localStorage.getItem("deepfake_session");
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch (e) {
        console.error("Failed to parse session", e);
      }
    }

    // Load history
    const savedHistory = localStorage.getItem("deepfake_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("deepfake_theme", next);
    } catch (e) {}
    if (next === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

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

  // Share History Item
  const handleShareHistoryItem = async (item: HistoryItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Deepfake Scan Result",
          text: `I scanned a ${item.mediaType} with Dual-Stream AI. Result: ${item.status} (${item.confidence}% confidence).`,
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
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText || `Server error during inference (${response.status})`
        );
      }

      const data = await response.json();

      // Complete all pipeline steps
      setPipelineStep(5);

      // Small delay so user sees the final step complete
      await new Promise((r) => setTimeout(r, 400));

      if (data.is_fake) triggerHaptic("warning");
      else triggerHaptic("success");

      const scanResultData: ScanResult = {
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
        gradcamBase64: data.gradcam_base64,
      };

      setResult(scanResultData);

      // Add to local history list
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        filename: file.name,
        mediaType: scanResultData.mediaType,
        sizeBytes: file.size,
        status: scanResultData.status,
        confidence: scanResultData.confidence,
        isFake: scanResultData.isFake,
        explanation: scanResultData.explanation,
        date: new Date().toLocaleString(),
        userEmail: currentUser?.email || undefined,
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem("deepfake_history", JSON.stringify(updatedHistory));

    } catch (error: any) {
      console.error("Scanning failed:", error);
      
      const msg = error?.message || "Connection to AI server failed.";
      const isMemoryIssue =
        msg.includes("503") ||
        msg.includes("504") ||
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("network error") ||
        msg.toLowerCase().includes("memory");

      setResult({
        status: "Error: Could not process media",
        confidence: 0,
        isFake: false,
        explanation: isMemoryIssue
          ? "The AI scanner engine is currently overloaded or offline (suspected RAM limits exceeded on the hosting server). Please try again with a compressed/smaller file, or contact support if the issue persists."
          : msg,
        framesAnalyzed: 0,
        mediaType: isImageFile(file.name) ? "image" : "video",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // --- Auth Handlers ---
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!authEmail || !authPassword || (isRegistering && !authName)) {
      setAuthError("Please fill in all fields.");
      return;
    }

    const accountsStr = localStorage.getItem("deepfake_accounts") || "[]";
    let accounts = [];
    try {
      accounts = JSON.parse(accountsStr);
    } catch (e) {
      accounts = [];
    }

    if (isRegistering) {
      if (accounts.some((acc: any) => acc.email.toLowerCase() === authEmail.toLowerCase())) {
        setAuthError("An account with this email already exists.");
        return;
      }
      const newUser = { name: authName, email: authEmail, password: authPassword };
      accounts.push(newUser);
      localStorage.setItem("deepfake_accounts", JSON.stringify(accounts));

      const sessionUser = { name: authName, email: authEmail };
      localStorage.setItem("deepfake_session", JSON.stringify(sessionUser));
      setCurrentUser(sessionUser);
      setShowAuthModal(false);
      resetAuthFields();
    } else {
      const user = accounts.find(
        (acc: any) => acc.email.toLowerCase() === authEmail.toLowerCase() && acc.password === authPassword
      );
      if (!user) {
        setAuthError("Invalid email or password.");
        return;
      }
      const sessionUser = { name: user.name, email: user.email };
      localStorage.setItem("deepfake_session", JSON.stringify(sessionUser));
      setCurrentUser(sessionUser);
      setShowAuthModal(false);
      resetAuthFields();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("deepfake_session");
    setCurrentUser(null);
  };

  const resetAuthFields = () => {
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
  };

  // --- History Filtering ---
  const filteredHistory = history.filter((item) => {
    // Segregate history: logged-in users see their scans, guests see guest scans
    const matchesUser = currentUser ? item.userEmail === currentUser.email : !item.userEmail;
    const matchesQuery = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = true;
    if (filterType === "image") matchesFilter = item.mediaType === "image";
    else if (filterType === "video") matchesFilter = item.mediaType === "video";
    else if (filterType === "real") matchesFilter = !item.isFake;
    else if (filterType === "fake") matchesFilter = item.isFake;

    return matchesUser && matchesQuery && matchesFilter;
  });

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your persistent scan history? This cannot be undone.")) {
      // Clear current user's history or guest history
      const updatedHistory = currentUser
        ? history.filter((item) => item.userEmail !== currentUser.email)
        : history.filter((item) => item.userEmail !== undefined);

      setHistory(updatedHistory);
      localStorage.setItem("deepfake_history", JSON.stringify(updatedHistory));
      setSelectedHistoryItem(null);
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
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col items-center p-0 font-sans overflow-x-hidden relative transition-colors duration-200">
      
      {/* 3D CANVAS BACKGROUND — Client-only with Suspense */}
      {mounted && (
        <div className="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none transition-opacity duration-300">
          <Canvas>
            <ambientLight intensity={theme === "light" ? 0.9 : 0.5} />
            <directionalLight position={[10, 10, 10]} intensity={theme === "light" ? 1.5 : 2} />
            <Suspense fallback={null}>
              <ScanningMesh
                isScanning={isScanning}
                resultType={resultType}
                theme={theme}
              />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
            />
          </Canvas>
        </div>
      )}

      {/* HEADER / NAVIGATION BAR */}
      <header className="w-full bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-500 cursor-pointer" onClick={() => setActiveTab("scanner")}>
            <img src="/logo.png" alt="Dual-Stream AI Logo" className="w-7 h-7 rounded-full object-cover" />
            <span className="font-bold tracking-tight text-slate-900 dark:text-white text-lg md:text-xl">
              Dual-Stream AI
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => { setActiveTab("scanner"); setSelectedHistoryItem(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "scanner"
                  ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
              }`}
            >
              Scanner
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
              }`}
            >
              <History size={15} />
              Scan History
            </button>
            <a
              href="/legal#privacy"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40 transition-colors"
            >
              Compliance Hub
            </a>
          </nav>

          {/* Session / Authentication Controls & Theme Toggle */}
          <div className="flex items-center space-x-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun size={15} className="text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-blue-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:inline-block max-w-[120px] truncate">
                  {currentUser.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded-md text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsRegistering(false); setShowAuthModal(true); }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
              >
                <User size={13} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE TAB NAVIGATION (STAYS ON BOTTOM / HIDDEN ON DESKTOP) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 z-30 px-6 py-3 flex justify-around transition-colors">
        <button
          onClick={() => { setActiveTab("scanner"); setSelectedHistoryItem(null); }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer ${
            activeTab === "scanner" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <ScanLine size={18} />
          Scanner
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer ${
            activeTab === "history" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <History size={18} />
          History
        </button>
        <a
          href="/legal#privacy"
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
        >
          <ShieldCheck size={18} />
          Compliance
        </a>
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-4xl w-full flex-1 flex flex-col items-center justify-center px-4 py-12 pb-24 md:pb-12 z-10">
        
        {/* ======================================================== */}
        {/* VIEW: SCANNER TAB                                        */}
        {/* ======================================================== */}
        {activeTab === "scanner" && (
          <div className="w-full flex flex-col items-center">
            {/* Title description */}
            <div className="max-w-3xl w-full text-center space-y-3 mb-8">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Deepfake Media Scanner
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm max-w-xl mx-auto">
                Secure, client-private deepfake verification for photos and videos using dual-stream neural networks. All analysis is local in RAM.
              </p>
            </div>

            {/* MAIN CARD */}
            <div className="max-w-lg w-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-2xl relative overflow-hidden transition-colors duration-200">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />
              
              {/* ---- STATE: No result, no file selected → Upload Zone ---- */}
              {!result && !file && (
                <div
                  className={`flex flex-col items-center justify-center space-y-6 py-10 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/5 glow-blue"
                      : "border-slate-300 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className={`p-5 rounded-full transition-colors duration-300 ${
                      isDragging ? "bg-blue-500/20 text-blue-500 dark:text-blue-400" : "bg-blue-50 dark:bg-slate-800/40 text-blue-600 dark:text-slate-500 border border-blue-100 dark:border-transparent"
                    }`}
                  >
                    <UploadCloud size={40} />
                  </div>

                  <div className="text-center px-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {isDragging ? "Drop your file here" : "Analyze Media"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">
                      Drag &amp; drop or click to choose from system
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1 font-mono uppercase tracking-wider">
                      MP4, MOV, JPG, PNG, WebP — Max 50 MB
                    </p>
                  </div>

                  <button
                    type="button"
                    className="flex justify-center bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs hover:border-slate-400 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-700 text-xs font-semibold px-6 py-3 rounded-xl border transition w-[160px] text-center cursor-pointer"
                  >
                    Select File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ALL_ACCEPT}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              {/* ---- STATE: File selected, not scanning, no result → Preview ---- */}
              {file && !result && !isScanning && (
                <div className="flex flex-col items-center space-y-5 animate-fade-in-up">
                  {/* Preview */}
                  <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-black relative">
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
                  <div className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800/60 transition-colors">
                    {isImageFile(file.name) ? (
                      <ImageIcon size={18} className="text-blue-400 flex-shrink-0" />
                    ) : (
                      <FileVideo size={18} className="text-blue-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                        {isImageFile(file.name) ? "Image" : "Video"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                      aria-label="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Scan button */}
                  <button
                    type="button"
                    onClick={handleScan}
                    className="relative w-full group overflow-hidden cursor-pointer rounded-xl"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 blur opacity-40 group-hover:opacity-80 transition duration-200" />
                    <div className="relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 transition font-semibold w-full text-sm">
                      <ScanLine size={18} />
                      Start Neural Deepfake Scan
                    </div>
                  </button>
                </div>
              )}

              {/* ---- STATE: Scanning → Pipeline Progress ---- */}
              {isScanning && (
                <div className="flex flex-col items-center space-y-5 animate-fade-in-up">
                  <div className="p-5 rounded-full bg-blue-500/10 animate-pulse">
                    <ShieldCheck size={36} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-blue-600 dark:text-blue-300">
                    Scanning File...
                  </h3>
                  <PipelineProgress steps={pipelineSteps} />
                </div>
              )}

              {/* ---- STATE: Result ---- */}
              {result && !isScanning && (
                <div className="flex flex-col items-center space-y-5 stagger-children">
                  {/* Confidence Ring */}
                  <div
                    className={`rounded-2xl p-4 w-full flex justify-center border transition-all ${
                      result.isFake
                        ? "bg-red-50/80 border-red-200 dark:bg-red-500/5 dark:border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                        : result.status.toLowerCase().includes("error")
                        ? "bg-slate-100 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800"
                        : "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                    }`}
                  >
                    {!result.status.toLowerCase().includes("error") ? (
                      <ConfidenceRing
                        percentage={result.confidence}
                        isFake={result.isFake}
                        theme={theme}
                      />
                    ) : (
                      <div className="py-2 text-center">
                        <AlertTriangle size={36} className="text-yellow-500 mx-auto mb-2 animate-bounce" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Analysis Failed</span>
                      </div>
                    )}
                  </div>

                  {/* Verdict */}
                  <div className="text-center space-y-1.5 w-full">
                    <div className="flex items-center justify-center gap-1.5">
                      {result.isFake ? (
                        <AlertTriangle size={20} className="text-red-400" />
                      ) : result.status.toLowerCase().includes("error") ? (
                        <AlertTriangle size={20} className="text-yellow-500" />
                      ) : (
                        <CheckCircle size={20} className="text-emerald-400" />
                      )}
                      <h3
                        className={`text-xl font-bold tracking-tight ${
                          result.isFake
                            ? "text-red-400"
                            : result.status.toLowerCase().includes("error")
                            ? "text-yellow-500"
                            : "text-emerald-400"
                        }`}
                      >
                        {result.status}
                      </h3>
                    </div>

                    {/* Media type badge */}
                    {!result.status.toLowerCase().includes("error") && (
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/80 uppercase font-mono shadow-xs">
                          {result.mediaType === "image" ? (
                            <ImageIcon size={10} />
                          ) : (
                            <FileVideo size={10} />
                          )}
                          {result.mediaType === "image"
                            ? "Image Verification"
                            : `Video Analysis · ${result.framesAnalyzed} frame${result.framesAnalyzed !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detection Reasoning */}
                  <div className="w-full bg-slate-50/80 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 text-left space-y-4 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 mb-2">
                        <Activity size={14} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-xs">
                          {result.status.toLowerCase().includes("error") ? "Error Details" : "Detection Diagnostics"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {result.explanation}
                      </p>
                    </div>

                    {result.gradcamBase64 && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/60">
                        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 mb-3">
                          <Brain size={14} className="text-purple-600 dark:text-purple-400" />
                          <span className="font-bold text-xs">
                            Explainable AI (Grad-CAM Activation Map)
                          </span>
                        </div>
                        <div className="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 max-w-xs mx-auto md:max-w-none md:w-full flex justify-center p-2 shadow-xs">
                          <img
                            src={result.gradcamBase64}
                            alt="Explainable AI Heatmap"
                            className="rounded-lg object-contain w-full h-48 md:h-56 transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute bottom-3 left-3 right-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 flex items-center justify-between shadow-xs">
                            <span>Red = High Manipulation Probability</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">EfficientNet-B0</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom Error Contact Action */}
                    {result.status.toLowerCase().includes("error") && (
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 font-medium">
                          Need assistance resolving this issue?
                        </span>
                        <a
                          href="mailto:akohmicheal@gmail.com?subject=Deepfake Scanner Error Report"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Mail size={12} />
                          Contact: akohtech@gmail.com
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Feedback & Share Row */}
                  {!result.status.toLowerCase().includes("error") && (
                    <div className="flex justify-between items-center w-full pt-4 border-t border-slate-200 dark:border-slate-800/50">
                      <div className="flex space-x-3 items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Feedback:
                        </span>
                        <button
                          type="button"
                          aria-label="Helpful"
                          onClick={() => setFeedbackGiven(true)}
                          className={`p-1.5 rounded-md transition cursor-pointer ${
                            feedbackGiven
                              ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-400/10"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Incorrect"
                          onClick={() => setFeedbackGiven(true)}
                          className={`p-1.5 rounded-md transition cursor-pointer ${
                            feedbackGiven
                              ? "text-slate-400 dark:text-slate-700"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          <ThumbsDown size={16} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleShare}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      >
                        <Share2 size={13} />
                        <span>Share</span>
                      </button>
                    </div>
                  )}

                  {/* Scan New */}
                  <button
                    onClick={handleClear}
                    className="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer shadow-xs"
                  >
                    Clear Result &amp; Scan Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW: HISTORY TAB                                        */}
        {/* ======================================================== */}
        {activeTab === "history" && (
          <div className="w-full max-w-4xl animate-fade-in-up flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="text-blue-500" />
                  Your Scan History
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                  {currentUser 
                    ? `Logged in as ${currentUser.name}. Reviewing account scans.` 
                    : "Browsing as guest. History is stored locally on this machine."}
                </p>
              </div>

              {filteredHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 px-4 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto shadow-xs"
                >
                  <Trash2 size={14} />
                  Clear All Scan History
                </button>
              )}
            </div>

            {/* Filter Bar & Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm dark:shadow-lg transition-colors">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search scans by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500 focus:bg-white focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                />
              </div>

              {/* Filters */}
              <div className="relative">
                <Filter size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                <select
                  value={filterType}
                  onChange={(e: any) => setFilterType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500 focus:bg-white focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-pointer appearance-none transition-colors"
                >
                  <option value="all">Filter: Show All Scans</option>
                  <option value="image">Show Images Only</option>
                  <option value="video">Show Videos Only</option>
                  <option value="real">Verdict: Real Only</option>
                  <option value="fake">Verdict: Fake Only</option>
                </select>
                <div className="absolute right-3.5 top-4 pointer-events-none text-slate-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              
              {/* Scan List (Takes 3 cols or full if no selection) */}
              <div className={`space-y-3 ${selectedHistoryItem ? "lg:col-span-3" : "lg:col-span-5"}`}>
                {filteredHistory.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-12 rounded-2xl text-center shadow-xs">
                    <Activity size={40} className="text-slate-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No records found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Scans you perform will appear here. Filters or search queries may also limit results.
                    </p>
                    <button
                      onClick={() => setActiveTab("scanner")}
                      className="mt-4 inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                    >
                      <ScanLine size={13} />
                      Scan Media Now
                    </button>
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedHistoryItem?.id === item.id
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/5 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-850 dark:bg-slate-900/40 dark:hover:border-slate-800 dark:hover:bg-slate-900/60 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`p-2.5 rounded-lg ${
                          item.isFake ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        }`}>
                          {item.mediaType === "image" ? <ImageIcon size={18} /> : <FileVideo size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-white">
                            {item.filename}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.date} · {(item.sizeBytes / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          item.isFake
                            ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20"
                        }`}>
                          {item.isFake ? "Fake" : "Real"} ({item.confidence}%)
                        </span>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Scan Detail Panel (Takes 2 cols) */}
              {selectedHistoryItem && (
                <div className="lg:col-span-2 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl shadow-slate-200/50 dark:shadow-2xl space-y-5 animate-fade-in-up self-start transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Scan Diagnostic Report</span>
                    <button
                      onClick={() => setSelectedHistoryItem(null)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Confidence Chart */}
                  <div className="py-2">
                    <ConfidenceRing
                      percentage={selectedHistoryItem.confidence}
                      isFake={selectedHistoryItem.isFake}
                      theme={theme}
                    />
                  </div>

                  {/* Overview details */}
                  <div className="space-y-3">
                    <div className="text-center">
                      <h4 className={`text-lg font-bold ${selectedHistoryItem.isFake ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        Verdict: {selectedHistoryItem.status}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-1">
                        File: {selectedHistoryItem.filename}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 text-left">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Inference Analysis</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {selectedHistoryItem.explanation}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShareHistoryItem(selectedHistoryItem)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 dark:text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl dark:border-slate-700/50 transition cursor-pointer shadow-xs"
                      >
                        <Share2 size={13} />
                        Share Report
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* COMPONENT: MOCK AUTHENTICATION MODAL                     */}
      {/* ======================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />
            
            <button
              onClick={() => { setShowAuthModal(false); resetAuthFields(); }}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-1.5 mb-6">
              <ShieldCheck size={32} className="text-blue-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isRegistering ? "Create Sandbox Account" : "Access Sandbox Platform"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Authentication keeps your scan history synced locally.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl flex items-center gap-1.5">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {isRegistering && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Full Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Micheal Akoh"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-blue-500 focus:bg-white focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="akohtech@gmail.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-blue-500 focus:bg-white focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-blue-500 focus:bg-white focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-3 rounded-xl transition cursor-pointer mt-2 shadow-xs"
              >
                {isRegistering ? "Register Account" : "Access Sandbox"}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-center">
              <button
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
              >
                {isRegistering
                  ? "Already have a credentials profile? Sign In"
                  : "Need a sandbox credentials profile? Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
    </main>
  );
}