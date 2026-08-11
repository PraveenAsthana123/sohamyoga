"use client";
import { useState } from "react";

const GOALS = ["Morning energise", "Evening wind-down", "Stress relief", "Strength building", "Flexibility", "Meditation flow"];
const DURATIONS = [15, 30, 45, 60];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

interface Flow {
  title: string;
  duration: number;
  poses: { name: string; duration: string; cue: string }[];
  tip: string;
}

export default function AiCoachPage() {
  const [goal, setGoal] = useState(GOALS[0]);
  const [duration, setDuration] = useState(30);
  const [level, setLevel] = useState("Beginner");
  const [generating, setGenerating] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);

  async function generateFlow() {
    setGenerating(true);
    setFlow(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Create a ${duration}-minute ${level} yoga flow for: ${goal}.
Return JSON: { "title": "...", "duration": ${duration}, "poses": [{"name":"...","duration":"...","cue":"..."}], "tip":"..." }
Give 5-8 poses appropriate for the duration.`
          }],
          model: "qwen2.5-coder:3b",
        }),
      });
      let text = "";
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try { text += JSON.parse(line.slice(6)).content ?? ""; } catch { /* skip */ }
          }
        }
      }
      const jsonMatch = text.match(/\{[\s\S]+\}/);
      if (jsonMatch) setFlow(JSON.parse(jsonMatch[0]));
    } catch {
      // fallback placeholder
      setFlow({
        title: `${goal} — ${duration} min ${level} Flow`,
        duration,
        poses: [
          { name: "Child's Pose", duration: "2 min", cue: "Sink hips to heels, arms extended, breathe deeply." },
          { name: "Cat-Cow", duration: "2 min", cue: "Inhale arch, exhale round. Sync with breath." },
          { name: "Downward Dog", duration: "3 min", cue: "Pedal heels, lengthen spine, breathe." },
          { name: "Warrior I", duration: "2 min each side", cue: "Ground back foot, lift arms, open chest." },
          { name: "Savasana", duration: "5 min", cue: "Full body relaxation, let go of effort." },
        ],
        tip: "Move at your own pace and honour how your body feels today.",
      });
    }
    setGenerating(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">AI Flow Generator</h1>
          <p className="text-gray-400 mt-1">Personalised yoga sequences powered by local AI</p>
        </div>

        {/* Config */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-sm text-gray-400 block mb-3">Goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setGoal(g)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    goal === g ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      duration === d ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}>{d}m</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Level</label>
              <div className="flex gap-2">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      level === l ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}>{l.slice(0,3)}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={generateFlow} disabled={generating}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-purple-600 rounded-xl font-semibold transition-opacity disabled:opacity-50">
            {generating ? "Generating your flow…" : "Generate Flow"}
          </button>
        </div>

        {/* Result */}
        {flow && (
          <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-green-400">{flow.title}</h2>
              <span className="text-sm text-gray-400">{flow.duration} min</span>
            </div>
            <div className="space-y-3">
              {flow.poses.map((pose, i) => (
                <div key={i} className="flex gap-4 items-start border-l-2 border-green-700 pl-4">
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{pose.name}</span>
                      <span className="text-xs text-gray-400">{pose.duration}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{pose.cue}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
              <p className="text-sm text-green-400">💡 {flow.tip}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
