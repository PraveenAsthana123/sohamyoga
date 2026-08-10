"use client";
import { useEffect, useRef, useState } from "react";

interface PoseFeedback {
  pose: string;
  score: number;
  corrections: string[];
  tip: string;
}

export default function PoseDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [feedback, setFeedback] = useState<PoseFeedback | null>(null);
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
    setFeedback(null);
  }

  async function analyzePose() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const imageData = canvasRef.current.toDataURL("image/jpeg", 0.8);

    // TODO: send imageData to /api/ai/pose-detect (calls MediaPipe + yoga classifier)
    // Placeholder feedback while backend is being built
    setFeedback({
      pose: selectedPose,
      score: 78,
      corrections: [
        "Straighten your back knee slightly",
        "Lower your hips to hip level",
        "Arms should be parallel to the floor",
      ],
      tip: "Focus on grounding through your back foot for better stability.",
    });
  }

  useEffect(() => {
    return () => { if (streaming) stopCamera(); };
  }, [streaming]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Pose Coach</h1>
          <p className="text-gray-400 mt-1">Real-time pose detection and correction feedback</p>
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
                  <button onClick={analyzePose}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition-colors">
                    Analyze Pose
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

            {feedback ? (
              <div className="bg-gray-900 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">{feedback.pose}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl font-bold"
                         style={{ borderColor: feedback.score >= 80 ? "#22c55e" : feedback.score >= 60 ? "#eab308" : "#ef4444",
                                  color: feedback.score >= 80 ? "#22c55e" : feedback.score >= 60 ? "#eab308" : "#ef4444" }}>
                      {feedback.score}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Corrections needed:</h4>
                  <ul className="space-y-2">
                    {feedback.corrections.map(c => (
                      <li key={c} className="flex items-start gap-2 text-sm text-yellow-400">
                        <span className="mt-0.5">⚠</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                  <p className="text-sm text-green-400">💡 {feedback.tip}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
                <div className="text-4xl mb-3">🧘</div>
                <p>Start camera and click "Analyze Pose" to get AI feedback</p>
                <p className="text-sm mt-2">Powered by MediaPipe + local Ollama AI</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
