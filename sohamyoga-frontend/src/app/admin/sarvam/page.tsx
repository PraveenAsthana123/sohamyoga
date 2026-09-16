'use client';

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SarvamJob {
  id: string;
  operation: string;
  input_text: string | null;
  source_language: string | null;
  target_language: string | null;
  output_text: string | null;
  model: string | null;
  status: string;
  created_at: string;
}

const TABS = ['Translate', 'Text to Speech', 'Transliterate', 'Language Detection', 'Marketing Use Cases'] as const;
type Tab = typeof TABS[number];

const LANGUAGES = [
  { code: 'en-IN', label: 'English (en-IN)' },
  { code: 'hi-IN', label: 'Hindi (hi-IN)' },
  { code: 'ta-IN', label: 'Tamil (ta-IN)' },
  { code: 'te-IN', label: 'Telugu (te-IN)' },
  { code: 'bn-IN', label: 'Bengali (bn-IN)' },
  { code: 'mr-IN', label: 'Marathi (mr-IN)' },
  { code: 'gu-IN', label: 'Gujarati (gu-IN)' },
  { code: 'kn-IN', label: 'Kannada (kn-IN)' },
  { code: 'ml-IN', label: 'Malayalam (ml-IN)' },
  { code: 'pa-IN', label: 'Punjabi (pa-IN)' },
  { code: 'or-IN', label: 'Odia (or-IN)' },
  { code: 'ur-IN', label: 'Urdu (ur-IN)' },
];

const TRANSLATION_MODES = [
  { value: 'formal', label: 'Formal' },
  { value: 'colloquial', label: 'Colloquial' },
  { value: 'modern_colloquial', label: 'Modern Colloquial' },
  { value: 'classic_colloquial', label: 'Classic Colloquial' },
  { value: 'code_mixed', label: 'Code Mixed' },
];

const TTS_SPEAKERS = [
  { lang: 'hi-IN', speakers: [{ id: 'meera', label: 'Meera - Female' }, { id: 'arjun', label: 'Arjun - Male' }] },
  { lang: 'ta-IN', speakers: [{ id: 'kavya', label: 'Kavya - Female' }, { id: 'kiran', label: 'Kiran - Male' }] },
  { lang: 'te-IN', speakers: [{ id: 'ananya', label: 'Ananya - Female' }, { id: 'rohit', label: 'Rohit - Male' }] },
  { lang: 'bn-IN', speakers: [{ id: 'priya', label: 'Priya - Female' }, { id: 'suresh', label: 'Suresh - Male' }] },
  { lang: 'mr-IN', speakers: [{ id: 'sneha', label: 'Sneha - Female' }, { id: 'amit', label: 'Amit - Male' }] },
  { lang: 'gu-IN', label: 'Gujarati', speakers: [{ id: 'pooja', label: 'Pooja - Female' }, { id: 'ravi', label: 'Ravi - Male' }] },
  { lang: 'kn-IN', speakers: [{ id: 'lakshmi', label: 'Lakshmi - Female' }, { id: 'deepak', label: 'Deepak - Male' }] },
  { lang: 'ml-IN', speakers: [{ id: 'nisha', label: 'Nisha - Female' }, { id: 'vinod', label: 'Vinod - Male' }] },
  { lang: 'en-IN', speakers: [{ id: 'rachel', label: 'Rachel - Female' }, { id: 'james', label: 'James - Male' }] },
];

function getLangLabel(code: string | null): string {
  if (!code) return '—';
  return LANGUAGES.find(l => l.code === code)?.label || code;
}

function getSpeakers(langCode: string) {
  return TTS_SPEAKERS.find(s => s.lang === langCode)?.speakers || [
    { id: 'meera', label: 'Meera - Female' },
    { id: 'arjun', label: 'Arjun - Male' },
  ];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SarvamPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Translate');
  const [jobs, setJobs] = useState<SarvamJob[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);

  // Translate tab
  const [srcLang, setSrcLang] = useState('en-IN');
  const [tgtLang, setTgtLang] = useState('hi-IN');
  const [translateInput, setTranslateInput] = useState('');
  const [translateMode, setTranslateMode] = useState('formal');
  const [translateOutput, setTranslateOutput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateWarning, setTranslateWarning] = useState('');

  // TTS tab
  const [ttsLang, setTtsLang] = useState('hi-IN');
  const [ttsSpeaker, setTtsSpeaker] = useState('meera');
  const [ttsText, setTtsText] = useState('');
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsPace, setTtsPace] = useState(1.0);
  const [ttsLoudness, setTtsLoudness] = useState(1.0);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsWarning, setTtsWarning] = useState('');

  // Transliterate tab
  const [translitInput, setTranslitInput] = useState('');
  const [translitTarget, setTranslitTarget] = useState('hi-IN');
  const [translitOutput, setTranslitOutput] = useState('');
  const [translitLoading, setTranslitLoading] = useState(false);
  const [translitWarning, setTranslitWarning] = useState('');

  // Language detection tab
  const [detectInput, setDetectInput] = useState('');
  const [detectResult, setDetectResult] = useState<{ language_code?: string; confidence?: number; demo?: boolean } | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Marketing use cases
  const [marketInput, setMarketInput] = useState('');
  const [selectedMarketLangs, setSelectedMarketLangs] = useState<string[]>(['hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'mr-IN']);
  const [marketTranslations, setMarketTranslations] = useState<Record<string, string>>({});
  const [marketLoading, setMarketLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/sarvam');
        const data = await res.json();
        setJobs(data.jobs || []);
        setHasApiKey(data.hasApiKey || false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function callSarvam(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch('/api/admin/sarvam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function refreshJobs() {
    const res = await fetch('/api/admin/sarvam');
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  // Translate
  async function handleTranslate() {
    if (!translateInput.trim()) return;
    setTranslating(true);
    setTranslateOutput('');
    setTranslateWarning('');
    try {
      const data = await callSarvam({
        operation: 'translate',
        input_text: translateInput,
        source_language: srcLang,
        target_language: tgtLang,
        mode: translateMode,
      });
      if (data.warning) setTranslateWarning(String(data.warning));
      setTranslateOutput(String(data.translated_text || ''));
      await refreshJobs();
    } catch (err) {
      setTranslateWarning(String(err));
    } finally {
      setTranslating(false);
    }
  }

  // TTS
  async function handleTts() {
    if (!ttsText.trim()) return;
    setTtsLoading(true);
    setTtsWarning('');
    try {
      const data = await callSarvam({
        operation: 'tts',
        input_text: ttsText,
        target_language: ttsLang,
        speaker: ttsSpeaker,
        pitch: ttsPitch,
        pace: ttsPace,
        loudness: ttsLoudness,
      });
      if (data.warning) {
        setTtsWarning(String(data.warning));
      } else if (data.audios || data.audio_base64) {
        const audioB64 = (Array.isArray(data.audios) ? data.audios[0] : data.audio_base64) as string;
        if (audioB64) {
          const audio = new Audio(`data:audio/mpeg;base64,${audioB64}`);
          audio.play().catch(console.error);
        }
      }
      await refreshJobs();
    } catch (err) {
      setTtsWarning(String(err));
    } finally {
      setTtsLoading(false);
    }
  }

  // Transliterate
  async function handleTransliterate() {
    if (!translitInput.trim()) return;
    setTranslitLoading(true);
    setTranslitOutput('');
    setTranslitWarning('');
    try {
      const data = await callSarvam({
        operation: 'transliterate',
        input_text: translitInput,
        source_language: 'en-IN',
        target_language: translitTarget,
      });
      if (data.warning) setTranslitWarning(String(data.warning));
      setTranslitOutput(String(data.transliterated_text || ''));
      await refreshJobs();
    } catch (err) {
      setTranslitWarning(String(err));
    } finally {
      setTranslitLoading(false);
    }
  }

  // Language detection
  async function handleDetect() {
    if (!detectInput.trim()) return;
    setDetecting(true);
    setDetectResult(null);
    try {
      const data = await callSarvam({ operation: 'detect-language', input_text: detectInput });
      setDetectResult(data as { language_code?: string; confidence?: number; demo?: boolean });
      await refreshJobs();
    } catch (err) {
      console.error(err);
    } finally {
      setDetecting(false);
    }
  }

  // Marketing: translate all
  async function handleTranslateAll() {
    if (!marketInput.trim() || selectedMarketLangs.length === 0) return;
    setMarketLoading(true);
    setMarketTranslations({});
    const results: Record<string, string> = {};
    for (const lang of selectedMarketLangs) {
      try {
        const data = await callSarvam({
          operation: 'translate',
          input_text: marketInput,
          source_language: 'en-IN',
          target_language: lang,
          mode: 'modern_colloquial',
        });
        results[lang] = String(data.translated_text || data.warning || '');
      } catch {
        results[lang] = 'Error translating.';
      }
    }
    setMarketTranslations(results);
    setMarketLoading(false);
    await refreshJobs();
  }

  function toggleMarketLang(lang: string) {
    setSelectedMarketLangs(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  function useinCampaign(text: string) {
    // Stub: copy to clipboard and navigate
    copyText(text);
    alert('Copied to clipboard! Paste into your campaign copy.');
  }

  const detectedLangLabel = detectResult?.language_code
    ? LANGUAGES.find(l => l.code === detectResult.language_code)?.label || detectResult.language_code
    : null;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading Sarvam AI...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🇮🇳</span>
            <h1 className="text-2xl font-bold text-gray-900">Sarvam AI — Multilingual Indian AI</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${hasApiKey ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {hasApiKey ? 'API Connected' : 'Demo Mode'}
            </span>
          </div>
          <p className="text-sm text-gray-500">Translate, transliterate, and generate audio across 12 Indian languages for your marketing campaigns.</p>
        </div>

        {!hasApiKey && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Sarvam AI not configured — Demo Mode</p>
            <p className="text-sm text-amber-700">
              Add <code className="bg-amber-100 px-1 rounded">SARVAM_API_KEY</code> to your <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable real translations and audio.{' '}
              <a href="https://www.sarvam.ai" target="_blank" rel="noreferrer" className="underline">Get API key at sarvam.ai →</a>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab: Translate */}
        {activeTab === 'Translate' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Source Language</label>
                <select
                  value={srcLang}
                  onChange={e => setSrcLang(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Target Language</label>
                <select
                  value={tgtLang}
                  onChange={e => setTgtLang(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Translation Mode</label>
                <select
                  value={translateMode}
                  onChange={e => setTranslateMode(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {TRANSLATION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Input Text</label>
                <textarea
                  value={translateInput}
                  onChange={e => setTranslateInput(e.target.value)}
                  rows={6}
                  placeholder="Enter text to translate..."
                  className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Translation Output</label>
                <div className="w-full border rounded-xl p-3 bg-gray-50 min-h-[9rem] text-sm text-gray-900 leading-relaxed">
                  {translateOutput || <span className="text-gray-400">Translation will appear here...</span>}
                </div>
                {translateOutput && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => copyText(translateOutput)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-gray-600">Copy</button>
                    <button onClick={() => useinCampaign(translateOutput)} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100">Use in Campaign</button>
                  </div>
                )}
              </div>
            </div>

            {translateWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{translateWarning}</div>
            )}

            <button
              onClick={handleTranslate}
              disabled={translating || !translateInput.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {translating ? 'Translating...' : 'Translate'}
            </button>
          </div>
        )}

        {/* Tab: Text to Speech */}
        {activeTab === 'Text to Speech' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Language</label>
                <select
                  value={ttsLang}
                  onChange={e => { setTtsLang(e.target.value); setTtsSpeaker(getSpeakers(e.target.value)[0].id); }}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Speaker</label>
                <select
                  value={ttsSpeaker}
                  onChange={e => setTtsSpeaker(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {getSpeakers(ttsLang).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Input Text</label>
              <textarea
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                rows={5}
                placeholder="Enter text to synthesize..."
                className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Pitch', value: ttsPitch, setter: setTtsPitch },
                { label: 'Pace', value: ttsPace, setter: setTtsPace },
                { label: 'Loudness', value: ttsLoudness, setter: setTtsLoudness },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">{label}</label>
                    <span className="text-sm font-mono text-gray-600">{value.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={value}
                    onChange={e => setter(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>0.5</span><span>2.0</span>
                  </div>
                </div>
              ))}
            </div>

            {ttsWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{ttsWarning}</div>
            )}

            <button
              onClick={handleTts}
              disabled={ttsLoading || !ttsText.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {ttsLoading ? 'Generating...' : '🔊 Generate Voice'}
            </button>
          </div>
        )}

        {/* Tab: Transliterate */}
        {activeTab === 'Transliterate' && (
          <div className="space-y-4">
            <div className="mb-2">
              <p className="text-sm text-gray-600">Convert Roman (English) script text into Indian language scripts. Example: "Namaste" → "नमस्ते"</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Target Script</label>
              <select
                value={translitTarget}
                onChange={e => setTranslitTarget(e.target.value)}
                className="w-full md:w-64 border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {LANGUAGES.filter(l => l.code !== 'en-IN').map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Roman Script Input (English)</label>
                <textarea
                  value={translitInput}
                  onChange={e => setTranslitInput(e.target.value)}
                  rows={6}
                  placeholder="e.g. Namaste, mera naam Priya hai..."
                  className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Native Script Output</label>
                <div className="w-full border rounded-xl p-3 bg-gray-50 min-h-[9rem] text-sm text-gray-900 leading-relaxed text-xl">
                  {translitOutput || <span className="text-gray-400 text-sm">Transliterated text will appear here...</span>}
                </div>
                {translitOutput && (
                  <button onClick={() => copyText(translitOutput)} className="mt-2 text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-gray-600">Copy</button>
                )}
              </div>
            </div>

            {translitWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{translitWarning}</div>
            )}

            <button
              onClick={handleTransliterate}
              disabled={translitLoading || !translitInput.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {translitLoading ? 'Transliterating...' : 'Transliterate'}
            </button>
          </div>
        )}

        {/* Tab: Language Detection */}
        {activeTab === 'Language Detection' && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-gray-600">Paste any Indian language text to automatically detect its language. Useful for classifying customer support messages.</p>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Input Text</label>
              <textarea
                value={detectInput}
                onChange={e => setDetectInput(e.target.value)}
                rows={5}
                placeholder="Paste text in any Indian language..."
                className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            <button
              onClick={handleDetect}
              disabled={detecting || !detectInput.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {detecting ? 'Detecting...' : '🔍 Detect Language'}
            </button>

            {detectResult && (
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🌐</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{detectedLangLabel || detectResult.language_code}</p>
                    <p className="text-sm text-gray-500">
                      Code: <code className="bg-gray-100 px-1 rounded">{detectResult.language_code}</code>
                      {detectResult.demo && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Demo</span>}
                    </p>
                  </div>
                </div>
                {detectResult.confidence != null && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Confidence</span>
                      <span className="font-semibold text-gray-900">{(detectResult.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-indigo-600 h-3 rounded-full transition-all"
                        style={{ width: `${(detectResult.confidence * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Marketing Use Cases */}
        {activeTab === 'Marketing Use Cases' && (
          <div className="space-y-6">
            {/* Localize Ad Copy */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Localize Ad Copy</h2>
              <p className="text-sm text-gray-500 mb-4">Paste your English ad copy and translate it to multiple Indian languages at once.</p>

              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 block mb-1">English Ad Copy</label>
                <textarea
                  value={marketInput}
                  onChange={e => setMarketInput(e.target.value)}
                  rows={4}
                  placeholder="e.g. Join SohamYoga today! Expert instructors, flexible schedules, and a welcoming community await you."
                  className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Target Languages</p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.filter(l => l.code !== 'en-IN').map(l => (
                    <button
                      key={l.code}
                      onClick={() => toggleMarketLang(l.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedMarketLangs.includes(l.code) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-300'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleTranslateAll}
                disabled={marketLoading || !marketInput.trim() || selectedMarketLangs.length === 0}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {marketLoading ? 'Translating...' : '🌏 Translate All'}
              </button>

              {Object.keys(marketTranslations).length > 0 && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(marketTranslations).map(([lang, text]) => (
                    <div key={lang} className="border rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-600">{getLangLabel(lang)}</p>
                        <button onClick={() => copyText(text)} className="text-xs text-indigo-600 hover:underline">Copy</button>
                      </div>
                      <p className="text-sm text-gray-900 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multilingual Social Post */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Multilingual Social Post</h2>
              <p className="text-sm text-gray-500 mb-3">Translate a social media post to 3 key languages for multilingual audiences.</p>
              <button
                onClick={() => {
                  setMarketInput('✨ Transform your health journey with SohamYoga! Join thousands of happy students. First class FREE. Book now!');
                  setSelectedMarketLangs(['hi-IN', 'ta-IN', 'te-IN']);
                  setMarketTranslations({});
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Load Example Post
              </button>
            </div>

            {/* Indian Voice Ad */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Indian Voice Ad</h2>
              <p className="text-sm text-gray-500 mb-3">Combine translate + TTS to create a voice ad in Hindi or Tamil.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveTab('Translate');
                    setTranslateInput('Join SohamYoga today! Expert instructors and a welcoming community await you. Book your first class free!');
                    setSrcLang('en-IN');
                    setTgtLang('hi-IN');
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                >
                  1. Translate to Hindi
                </button>
                <button
                  onClick={() => setActiveTab('Text to Speech')}
                  className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm hover:bg-green-100 transition-colors"
                >
                  2. Generate Hindi Voice
                </button>
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
                <p className="text-xs text-gray-500 mt-0.5">{jobs.length} jobs recorded</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Operation</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Languages</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Input</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Output</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{job.operation}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {[job.source_language, job.target_language].filter(Boolean).join(' → ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs" title={job.input_text || ''}>
                          {job.input_text ? job.input_text.slice(0, 60) + (job.input_text.length > 60 ? '...' : '') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs" title={job.output_text || ''}>
                          {job.output_text ? job.output_text.slice(0, 60) + (job.output_text.length > 60 ? '...' : '') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${job.status === 'done' ? 'bg-green-50 text-green-700' : job.status === 'demo' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(job.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No jobs yet. Run a translation or TTS to see history here.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
