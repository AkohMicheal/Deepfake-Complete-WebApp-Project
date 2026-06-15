"use client";

import { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, OrbitControls } from "@react-three/drei";
import { ShieldCheck, UploadCloud, AlertTriangle, Info, Share2, ThumbsUp, ThumbsDown, Activity, CheckCircle } from "lucide-react";
import * as THREE from "three";

// ==========================================
// 1. THE 3D COMPONENT (WebGL Context)
// ==========================================
function ScanningMesh({ isScanning, resultType }: { isScanning: boolean, resultType: 'idle' | 'fake' | 'real' }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * (isScanning ? 2.5 : 0.5);
      meshRef.current.rotation.y = state.clock.elapsedTime * (isScanning ? 3.0 : 0.3);
    }
  });

  // Dynamic color based on the AI's final decision
  let meshColor = "#1e293b"; // Slate for idle
  if (isScanning) meshColor = "#3b82f6"; // Blue for scanning
  else if (resultType === 'fake') meshColor = "#ef4444"; // Red for Fake
  else if (resultType === 'real') meshColor = "#10b981"; // Green for Real

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} scale={isScanning ? 1.5 : 1.2}>
      <MeshDistortMaterial
        color={meshColor}
        attach="material"
        distort={isScanning ? 0.6 : (resultType !== 'idle' ? 0.4 : 0.2)}
        speed={isScanning ? 5 : 2}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
}

// ==========================================
// 2. THE MAIN UI COMPONENT (DOM Context)
// ==========================================
export default function DeepfakeScannerApp() {
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{ status: string; confidence: number; isFake: boolean; explanation: string } | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Trigger mobile vibration safely
  const triggerHaptic = (type: 'success' | 'warning') => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      if (type === 'warning') navigator.vibrate([200, 100, 200]); // Double buzz for fake
      else navigator.vibrate([100]); // Single tap for real
    }
  };

  // Trigger Native Mobile Share Sheet
  const handleShare = async () => {
    if (navigator.share && result) {
      try {
        await navigator.share({
          title: 'Deepfake Scan Result',
          text: `I just scanned a video. Result: ${result.status} (${result.confidence}% confidence). Scanned via Dual-Stream AI.`,
        });
      } catch (err) {
        console.log("Sharing cancelled or failed.");
      }
    } else {
      alert("Native sharing is not supported on this browser.");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setIsScanning(true);
      setResult(null);
      setFeedbackGiven(false);

      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        const response = await fetch("http://localhost:8000/api/scan", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Server error during inference");

        const data = await response.json();

        // Haptic Feedback based on result
        if (data.is_fake) triggerHaptic('warning');
        else triggerHaptic('success');

        setResult({
          status: data.status,
          confidence: data.confidence,
          isFake: data.is_fake,
          // We look for an explanation from the backend, or provide a default fallback
          explanation: data.explanation || (data.is_fake
            ? "Anomalies detected in the high-frequency DCT spectrum, indicating spatial manipulation around the facial boundary."
            : "No synthetic artifacts detected in either the spatial pixels or the frequency domain.")
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Scanning failed:", error);
        setResult({ status: "Error: Could not process video", confidence: 0, isFake: false, explanation: "Connection to AI server failed." });
      } finally {
        setIsScanning(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans overflow-hidden">

      {/* HEADER */}
      <div className="max-w-3xl w-full text-center space-y-3 mb-8 z-10 mt-12">
        <div className="flex items-center justify-center space-x-3 text-blue-500 mb-2">
          <ShieldCheck size={36} />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Dual-Stream Scanner</h1>
        </div>
        <p className="text-slate-400 text-sm md:text-base px-4">
          Secure, real-time deepfake detection utilizing spatial and frequency domain analysis.
        </p>
      </div>

      {/* 3D CANVAS BACKGROUND */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <Canvas>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={2} />
          <ScanningMesh
            isScanning={isScanning}
            resultType={!result ? 'idle' : (result.isFake ? 'fake' : 'real')}
          />
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>

      {/* INTERACTIVE UPLOAD CARD */}
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 shadow-2xl z-10 mb-8">

        {!result ? (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className={`p-6 rounded-full ${isScanning ? 'bg-blue-500/20 animate-pulse' : 'bg-slate-800/50'}`}>
              <UploadCloud size={48} className={isScanning ? 'text-blue-400' : 'text-slate-400'} />
            </div>

            <div className="text-center px-4">
              <h2 className="text-xl font-semibold">{isScanning ? 'Analyzing Tensors...' : 'Upload Video'}</h2>
              <p className="text-xs text-slate-500 mt-2">MP4 or MOV formats (Max 50MB)</p>
            </div>

            <label className="relative cursor-pointer group w-full sm:w-auto">
              <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
              <div className="relative flex justify-center bg-slate-950 text-white px-8 py-4 rounded-xl border border-slate-800 hover:border-slate-700 transition font-medium w-full text-center">
                {isScanning ? 'Processing...' : 'Select File'}
              </div>
              <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleUpload} disabled={isScanning} />
            </label>
          </div>
        ) : (

          /* APP-STYLE RESULTS VIEW */
          <div className="flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-4 rounded-full ${result.isFake ? 'bg-red-500/20 border-red-500/50' : 'bg-emerald-500/20 border-emerald-500/50'} border`}>
              {result.isFake ? <AlertTriangle size={40} className="text-red-400" /> : <CheckCircle size={40} className="text-emerald-400" />}
            </div>

            <div className="text-center space-y-1 w-full">
              <h2 className={`text-2xl font-bold tracking-tight ${result.isFake ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.status}
              </h2>
              <div className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 inline-block mt-2">
                <span className="text-slate-400 text-xs mr-2 uppercase tracking-wider">Confidence</span>
                <span className="text-white font-mono font-bold text-lg">{result.confidence}%</span>
              </div>
            </div>

            {/* THE NEW REASONING UI */}
            <div className="w-full bg-slate-950/50 p-4 rounded-xl border border-slate-800 mt-4 text-left">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <Activity size={16} className="text-blue-400" />
                <span className="font-semibold text-sm">Detection Reasoning</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {result.explanation}
              </p>
            </div>

            {/* THE NEW FEEDBACK & SHARE ACTION ROW */}
            <div className="flex justify-between items-center w-full pt-4 mt-2 border-t border-slate-800/50">
              <div className="flex space-x-3 items-center">
                <span className="text-xs text-slate-500 font-medium">Feedback:</span>
                <button
                  type="button"
                  aria-label="Mark result as helpful"
                  onClick={() => setFeedbackGiven(true)}
                  className={`p-2 rounded-md transition ${feedbackGiven ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Mark result as incorrect"
                  onClick={() => setFeedbackGiven(true)}
                  className={`p-2 rounded-md transition ${feedbackGiven ? 'text-slate-600' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                >
                  <ThumbsDown size={18} />
                </button>
              </div>

              <button type="button" onClick={handleShare} className="flex items-center space-x-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md transition">
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>

            <button
              onClick={() => setResult(null)}
              className="mt-6 w-full py-3 text-sm text-slate-400 bg-slate-950 hover:text-white rounded-xl border border-slate-800 transition"
            >
              Scan New Video
            </button>
          </div>
        )}
      </div>
    </main>
  );
}