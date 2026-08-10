"use client";
// Content Studio — local preview only until persistence is wired to a tenant/workspace.

import { useState } from "react";
import { PLATFORM_CONFIG } from "@/domain/social/SocialAccount";

const PLATFORMS = Object.values(PLATFORM_CONFIG);
const TONES = ["inspirational", "educational", "promotional", "casual", "professional"];

function charCount(text: string, max: number) {
  const pct = Math.min(100, Math.round((text.length / max) * 100));
  const color = pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-gray-400";
  return { pct, color, remaining: max - text.length };
}

export default function ComposePage() {
  const [step, setStep] = useState(1);
  const [masterText, setMasterText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [tone, setTone] = useState("inspirational");
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [mediaUrls] = useState<string[]>([]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  async function generateVariants() {
    setGenerating(true);
    // Deterministic local formatting. This is intentionally not labelled as AI.
    const newVariants: Record<string, string> = {};
    selectedPlatforms.forEach(p => {
      const cfg = PLATFORM_CONFIG[p as keyof typeof PLATFORM_CONFIG];
      const truncated = masterText.slice(0, cfg.maxCharacters - 20);
      const hashtags = p === "instagram" ? "\n\n#yoga #sohamyoga #practice" : p === "linkedin" ? "\n\n#wellness #yoga" : "";
      newVariants[p] = `${truncated}${hashtags}`;
    });
    setVariants(newVariants);
    setGenerating(false);
    setStep(3);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Content</h1>
        <p className="text-gray-500 text-sm mt-0.5">Write master copy → format per platform → review a local preview</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {["Master Copy", "Select Platforms", "Review & Format", "Local Preview"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={step === i + 1 ? "text-indigo-700 font-medium" : "text-gray-400"}>{s}</span>
            {i < 3 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Master copy */}
      {step === 1 && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Write your master post</h2>
          <textarea
            value={masterText}
            onChange={e => setMasterText(e.target.value)}
            placeholder="Describe your yoga content, event, or message..."
            className="w-full h-40 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex items-center gap-4">
            <select value={tone} onChange={e => setTone(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
              {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button
              onClick={() => masterText.trim() && setStep(2)}
              disabled={!masterText.trim()}
              className="ml-auto bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Next: Select Platforms →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Platform selection */}
      {step === 2 && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Choose target platforms</h2>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(p => {
              const selected = selectedPlatforms.includes(p.platform);
              return (
                <button
                  key={p.platform}
                  onClick={() => togglePlatform(p.platform)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${selected ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${selected ? "bg-indigo-500" : "bg-gray-300"}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{p.displayName}</div>
                    <div className="text-xs text-gray-400">max {p.maxCharacters.toLocaleString()} chars · {p.postizSupport === "postiz" ? "Postiz" : p.postizSupport === "custom_connector" ? "Custom" : "Manual"}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="border rounded-lg px-4 py-2 text-sm">← Back</button>
            <button
              onClick={generateVariants}
              disabled={selectedPlatforms.length === 0 || generating}
              className="ml-auto bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {generating ? "Formatting..." : "Format for Each Platform →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review variants */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Review locally formatted variants</h2>
          {selectedPlatforms.map(p => {
            const cfg = PLATFORM_CONFIG[p as keyof typeof PLATFORM_CONFIG];
            const text = variants[p] ?? "";
            const cc = charCount(text, cfg.maxCharacters);
            return (
              <div key={p} className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{cfg.displayName}</span>
                  <span className={`text-xs font-mono ${cc.color}`}>{text.length} / {cfg.maxCharacters}</span>
                </div>
                <textarea
                  value={text}
                  onChange={e => setVariants(v => ({ ...v, [p]: e.target.value }))}
                  className="w-full h-28 border rounded-lg p-2 text-sm resize-none"
                />
              </div>
            );
          })}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border rounded-lg px-4 py-2 text-sm">← Back</button>
            <button
              onClick={() => setStep(4)}
              className="ml-auto bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
            >
              Review Local Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Approval request */}
      {step === 4 && (
        <div className="bg-white border border-amber-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Local Preview Ready</h2>
          <p className="text-gray-500 text-sm mb-4">
            Nothing has been saved, approved, scheduled, or published. Use Postiz after connecting a verified account.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left mb-4">
            <strong>Platforms:</strong> {selectedPlatforms.map(p => PLATFORM_CONFIG[p as keyof typeof PLATFORM_CONFIG]?.displayName).join(", ")}
            <br />
            <strong>Governance:</strong> This page is preview-only. Publishing remains inside the authenticated Postiz workflow.
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep(1); setMasterText(""); setVariants({}); }} className="border rounded-lg px-4 py-2 text-sm">
              Create Another
            </button>
            <a href="/admin/social" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Return to Social Portal
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
