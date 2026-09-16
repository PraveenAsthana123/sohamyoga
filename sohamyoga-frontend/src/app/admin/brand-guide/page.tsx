"use client";
import { useState } from "react";

const TABS = ["Brand Colors", "Typography", "Logo Usage", "Voice & Tone", "Brand Assets", "Export"] as const;
type Tab = typeof TABS[number];

interface BrandColor { id: string; name: string; hex: string; usage: string; }
interface FontEntry { family: string; sizes: string; weights: string; }

const DEFAULT_COLORS: BrandColor[] = [
  { id: "1", name: "Primary", hex: "#6366F1", usage: "Buttons, links, primary actions" },
  { id: "2", name: "Secondary", hex: "#EC4899", usage: "Accents, highlights, CTAs" },
  { id: "3", name: "Neutral Dark", hex: "#1E293B", usage: "Body text, headings" },
  { id: "4", name: "Neutral Light", hex: "#F8FAFC", usage: "Backgrounds, cards" },
  { id: "5", name: "Success", hex: "#22C55E", usage: "Confirmations, positive states" },
  { id: "6", name: "Warning", hex: "#F59E0B", usage: "Alerts, cautionary states" },
];
const DEFAULT_FONTS: FontEntry[] = [
  { family: "Inter", sizes: "12, 14, 16, 18, 24, 32, 48px", weights: "400, 500, 600, 700" },
  { family: "Playfair Display", sizes: "24, 32, 48, 64px", weights: "400, 700" },
  { family: "JetBrains Mono", sizes: "12, 14, 16px", weights: "400, 500" },
];
const VOICE_ADJECTIVES = ["Empowering", "Clear", "Warm", "Professional", "Mindful", "Authentic"];
const VOICE_EXAMPLES = [
  { do: "Join thousands who have transformed their practice.", dont: "Buy now before it's too late!" },
  { do: "Here's how to get started in three simple steps.", dont: "It's complicated but here's everything you need to know." },
];

export default function BrandGuidePage() {
  const [tab, setTab] = useState<Tab>("Brand Colors");
  const [colors, setColors] = useState<BrandColor[]>(DEFAULT_COLORS);
  const [fonts, setFonts] = useState<FontEntry[]>(DEFAULT_FONTS);
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColor, setNewColor] = useState({ name: "", hex: "#000000", usage: "" });
  const [logoUrl, setLogoUrl] = useState("https://example.com/logo.svg");
  const [logoDos] = useState(["Use on white/light backgrounds", "Maintain clear space equal to logo height", "Use full-color version in digital contexts"]);
  const [logoDonts] = useState(["Never stretch or distort the logo", "Never apply drop shadows", "Never use on busy backgrounds"]);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const addColor = () => {
    if (!newColor.name || !newColor.hex) return;
    setColors(p => [...p, { ...newColor, id: Date.now().toString() }]);
    setNewColor({ name: "", hex: "#000000", usage: "" });
    setShowAddColor(false);
  };

  const removeColor = (id: string) => setColors(p => p.filter(c => c.id !== id));

  const generateExport = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Generate a brand guide summary for a wellness/yoga brand with these colors: ${colors.map(c => `${c.name} (${c.hex})`).join(", ")}. Fonts: ${fonts.map(f => f.family).join(", ")}. Voice: ${VOICE_ADJECTIVES.join(", ")}. Write in a professional PDF-ready format.` }),
      });
      const d = await res.json();
      setAiResult(d.result || d.text || JSON.stringify(d));
    } catch {
      setAiResult("Brand Guide Summary\n\nColors: " + colors.map(c => `${c.name}: ${c.hex} — ${c.usage}`).join("\n") + "\n\nFonts: " + fonts.map(f => `${f.family} (${f.sizes})`).join(", ") + "\n\nVoice: " + VOICE_ADJECTIVES.join(", "));
    }
    setAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Brand Guide</h1>
        <p className="text-gray-500 mb-6">Manage your brand identity system</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Brand Colors" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Color Palette</h2>
              <button onClick={() => setShowAddColor(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                + Add Color
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {colors.map(c => (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="h-24" style={{ backgroundColor: c.hex }} />
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-sm font-mono text-gray-500">{c.hex}</p>
                        <p className="text-xs text-gray-400 mt-1">{c.usage}</p>
                      </div>
                      <button onClick={() => removeColor(c.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {showAddColor && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Add Brand Color</h3>
                  <label className="block text-sm text-gray-600 mb-1">Color Name</label>
                  <input value={newColor.name} onChange={e => setNewColor(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3 text-sm" placeholder="e.g. Accent Purple" />
                  <label className="block text-sm text-gray-600 mb-1">Hex Value</label>
                  <div className="flex gap-2 mb-3">
                    <input type="color" value={newColor.hex} onChange={e => setNewColor(p => ({ ...p, hex: e.target.value }))}
                      className="h-10 w-16 rounded cursor-pointer border border-gray-200" />
                    <input value={newColor.hex} onChange={e => setNewColor(p => ({ ...p, hex: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
                  </div>
                  <label className="block text-sm text-gray-600 mb-1">Usage Description</label>
                  <input value={newColor.usage} onChange={e => setNewColor(p => ({ ...p, usage: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm" placeholder="e.g. Hover states, secondary actions" />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowAddColor(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={addColor} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add Color</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Typography" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Font System</h2>
            <div className="space-y-4">
              {fonts.map((f, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-xl font-bold text-gray-900" style={{ fontFamily: f.family }}>{f.family}</p>
                      <p className="text-sm text-gray-500 mt-1">Sizes: {f.sizes}</p>
                      <p className="text-sm text-gray-500">Weights: {f.weights}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p style={{ fontFamily: f.family, fontWeight: 400 }} className="text-gray-700">Regular — The quick brown fox</p>
                      <p style={{ fontFamily: f.family, fontWeight: 600 }} className="text-gray-700">SemiBold — The quick brown fox</p>
                      <p style={{ fontFamily: f.family, fontWeight: 700 }} className="text-gray-800">Bold — The quick brown fox</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3">Type Scale</h3>
              {[["H1", "48px / 700", "text-5xl"], ["H2", "32px / 700", "text-4xl"], ["H3", "24px / 600", "text-2xl"], ["Body", "16px / 400", "text-base"], ["Caption", "12px / 400", "text-xs"]].map(([label, spec, cls]) => (
                <div key={label} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                  <span className="w-16 text-xs text-gray-400 font-mono">{label}</span>
                  <span className="w-32 text-xs text-gray-400">{spec}</span>
                  <span className={`${cls} text-gray-800`}>{label} Sample Text</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Logo Usage" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Logo Usage Guidelines</h2>
            <div className="bg-white rounded-xl p-5 border border-gray-100 mb-4">
              <label className="block text-sm text-gray-600 mb-2">Logo URL</label>
              <div className="flex gap-2">
                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Preview</button>
              </div>
              {logoUrl && (
                <div className="mt-4 p-6 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-200">
                  <img src={logoUrl} alt="Brand Logo" className="max-h-24 max-w-48 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 border border-green-100">
                <h3 className="font-semibold text-green-700 mb-3">✓ Do</h3>
                <ul className="space-y-2">
                  {logoDos.map((d, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500">✓</span>{d}</li>)}
                </ul>
              </div>
              <div className="bg-white rounded-xl p-5 border border-red-100">
                <h3 className="font-semibold text-red-700 mb-3">✗ Don't</h3>
                <ul className="space-y-2">
                  {logoDonts.map((d, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-red-400">✗</span>{d}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "Voice & Tone" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Brand Voice & Tone</h2>
            <div className="bg-white rounded-xl p-5 border border-gray-100 mb-4">
              <h3 className="font-medium text-gray-700 mb-3">Brand Adjectives</h3>
              <div className="flex flex-wrap gap-2">
                {VOICE_ADJECTIVES.map(a => (
                  <span key={a} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">{a}</span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="font-medium text-gray-700 mb-4">Writing Examples</h3>
              <div className="space-y-4">
                {VOICE_EXAMPLES.map((ex, i) => (
                  <div key={i} className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-600 font-semibold mb-1">DO</p>
                      <p className="text-sm text-gray-700">{ex.do}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-xs text-red-500 font-semibold mb-1">DON'T</p>
                      <p className="text-sm text-gray-700">{ex.dont}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "Brand Assets" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Brand Asset Library</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Primary Logo (SVG)", desc: "Full color, dark background", url: "/assets/logo-primary.svg" },
                { label: "Logo White (SVG)", desc: "For dark backgrounds", url: "/assets/logo-white.svg" },
                { label: "Icon Only (PNG)", desc: "Square format for social media", url: "/assets/icon.png" },
                { label: "Color Palette (ASE)", desc: "Adobe Swatch Exchange", url: "/assets/palette.ase" },
                { label: "Brand Fonts (ZIP)", desc: "Licensed font files", url: "/assets/fonts.zip" },
                { label: "Style Guide (PDF)", desc: "Full printable brand guide", url: "/assets/brand-guide.pdf" },
              ].map(a => (
                <div key={a.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <p className="font-medium text-gray-800 text-sm">{a.label}</p>
                  <p className="text-xs text-gray-400 mt-1 mb-3">{a.desc}</p>
                  <a href={a.url} className="text-xs text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    Download →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Export" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Export Brand Guide</h2>
            <div className="bg-white rounded-xl p-5 border border-gray-100 mb-4">
              <p className="text-sm text-gray-600 mb-4">Generate a PDF-ready brand guide summary using AI, based on your current brand settings.</p>
              <button onClick={generateExport} disabled={aiLoading}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {aiLoading ? "Generating…" : "Generate Brand Guide Summary"}
              </button>
            </div>
            {aiResult && (
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-800">Generated Summary</h3>
                  <button onClick={() => navigator.clipboard.writeText(aiResult)}
                    className="text-xs text-indigo-600 hover:underline">Copy</button>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
