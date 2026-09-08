"use client";
import { useEffect, useRef, useState } from "react";

export default function PoseDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [selectedPose, setSelectedPose] = useState("Warrior I");
  const [error, setError] = useState<string | null>(null);

  const POSES = ["Warrior I", "Warrior II", "Tree Pose", "Downward Dog", "Child's Pose", "Mountain Pose"];

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
        setError(null);
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setStreaming(false);
  }

  useEffect(() => {
    return () => { if (streaming) stopCamera(); };
  }, [streaming]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Pose Coach</h1>
          <p className="text-gray-400 mt-1">Camera preview is live; automated pose feedback is not built yet.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Camera feed */}
          <div className="space-y-4">
            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} width={640} height={480} className="hidden" />
              {!streaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📸</div>
                    <p className="text-gray-400">Camera preview will appear here</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {!streaming ? (
                <button onClick={startCamera}
                  className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-xl font-semibold transition-colors">
                  Start Camera
                </button>
              ) : (
                <>
                  <button disabled title="Pose analysis isn't built yet — this needs a real computer-vision model, not yet integrated."
                    className="flex-1 cursor-not-allowed bg-gray-700 py-3 rounded-xl font-semibold opacity-50">
                    Analyze Pose (not yet available)
                  </button>
                  <button onClick={stopCamera}
                    className="px-6 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold transition-colors">
                    Stop
                  </button>
                </>
              )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          {/* Pose selector + feedback */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Target Pose</label>
              <select value={selectedPose} onChange={e => setSelectedPose(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                {POSES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
              <div className="text-4xl mb-3">🚧</div>
              <p>Pose analysis isn't available yet.</p>
              <p className="text-sm mt-2">Real feedback requires a computer-vision pose-detection model, which hasn't been built or integrated. This page previously showed a fixed fake score regardless of your actual pose — that's been removed.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
