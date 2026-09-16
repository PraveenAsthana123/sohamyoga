'use client';

import { useEffect, useState, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description: string;
}

interface Generation {
  id: string;
  voice_id: string;
  voice_name: string | null;
  input_text: string;
  language: string;
  model_id: string;
  character_count: number | null;
  duration_seconds: string | null;
  use_case: string;
  status: string;
  created_at: string;
}

const TABS = ['Generate', 'History', 'Marketing Use Cases', 'API Usage', 'Setup'] as const;
type Tab = typeof TABS[number];

const USE_CASES = [
  { value: 'ad_voiceover', label: 'Ad Voiceover' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'video_narration', label: 'Video Narration' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'phone_ivr', label: 'Phone IVR' },
];

const MODELS = [
  { value: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2 (Best quality, multilingual)' },
  { value: 'eleven_turbo_v2', label: 'eleven_turbo_v2 (Fastest, English)' },
  { value: 'eleven_monolingual_v1', label: 'eleven_monolingual_v1 (Classic English)' },
];

const MARKETING_TEMPLATES = [
  {
    name: '30-Second Radio Ad',
    duration: '30s',
    script: '[BUSINESS NAME] is your trusted partner for [SERVICE]. Call us today at [PHONE] or visit [URL]. [TAGLINE]. [BUSINESS NAME] — [CITY]\'s choice for [SERVICE].',
  },
  {
    name: 'Instagram Reel Voiceover',
    duration: '15s',
    script: 'Ready to transform your life? [BUSINESS NAME] makes it easy. Try [SERVICE] today — your first session is FREE. Link in bio!',
  },
  {
    name: 'YouTube Intro',
    duration: '10s',
    script: 'Welcome back! I\'m [HOST NAME] and today we\'re diving into [TOPIC]. Stay until the end for something special.',
  },
  {
    name: 'Email Voiceover',
    duration: '60s',
    script: 'Hi [FIRST NAME], this is [NAME] from [BUSINESS NAME]. I wanted to personally reach out about your recent inquiry. We\'d love to help you with [SERVICE]. Call us or reply to this email and we\'ll get you started right away.',
  },
  {
    name: 'Phone IVR Greeting',
    duration: '20s',
    script: 'Thank you for calling [BUSINESS NAME]. Our office hours are [HOURS]. For appointments, press 1. For billing inquiries, press 2. To speak with a team member, press 0 or stay on the line.',
  },
];

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ElevenLabsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Generate');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Generate tab state
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [inputText, setInputText] = useState('');
  const [useCase, setUseCase] = useState('ad_voiceover');
  const [modelId, setModelId] = useState('eleven_multilingual_v2');
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ audio_base64?: string | null; warning?: string; error?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Subscription state
  const [subscription, setSubscription] = useState<{ character_count?: number; character_limit?: number; next_character_count_reset_unix?: number } | null>(null);
  const [costChars, setCostChars] = useState('1000');

  useEffect(() => {
    async function load() {
      try {
        const [genRes, voiceRes] = await Promise.all([
          fetch('/api/admin/elevenlabs'),
          fetch('/api/admin/elevenlabs/voices'),
        ]);
        const genData = await genRes.json();
        const voiceData = await voiceRes.json();
        setGenerations(genData.generations || []);
        setHasApiKey(genData.hasApiKey || false);
        setVoices(voiceData.voices || []);
        setDemoMode(voiceData.demo || false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (hasApiKey && activeTab === 'API Usage') {
      fetch('/api/admin/elevenlabs/subscription').then(r => r.ok ? r.json() : null).then(d => {
        if (d) setSubscription(d);
      }).catch(() => null);
    }
  }, [hasApiKey, activeTab]);

  async function handleGenerate() {
    if (!selectedVoice || !inputText.trim()) return;
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/admin/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: selectedVoice.voice_id,
          voice_name: selectedVoice.name,
          text: inputText,
          use_case: useCase,
          model_id: modelId,
        }),
      });
      const data = await res.json();
      setGenerateResult(data);
      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
        audioRef.current = audio;
        audio.play().catch(console.error);
        // Refresh history
        const genRes = await fetch('/api/admin/elevenlabs');
        const genData = await genRes.json();
        setGenerations(genData.generations || []);
      }
    } catch (err) {
      setGenerateResult({ error: String(err) });
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!generateResult?.audio_base64) return;
    const link = document.createElement('a');
    link.href = `data:audio/mpeg;base64,${generateResult.audio_base64}`;
    link.download = `elevenlabs-${selectedVoice?.name || 'voice'}-${Date.now()}.mp3`;
    link.click();
  }

  function replayGeneration(gen: Generation) {
    // History replay — audio_base64 not returned in list; prompt user to regenerate
    alert(`Replay: "${gen.input_text.slice(0, 60)}..." — select voice "${gen.voice_name}" and regenerate to replay audio.`);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  function useTemplate(script: string) {
    setInputText(script);
    setActiveTab('Generate');
  }

  const estimatedCost = ((parseInt(costChars, 10) || 0) / 1000 * 0.30).toFixed(4);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading ElevenLabs...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎙️</span>
            <h1 className="text-2xl font-bold text-gray-900">ElevenLabs Text-to-Speech</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${hasApiKey ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {hasApiKey ? 'API Connected' : 'Demo Mode'}
            </span>
          </div>
          <p className="text-sm text-gray-500">Generate professional AI voiceovers for ads, social posts, video narration, and more.</p>
        </div>

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

        {/* Tab: Generate */}
        {activeTab === 'Generate' && (
          <div className="space-y-6">
            {!hasApiKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">ElevenLabs API not configured — Demo Mode</p>
                <p className="text-sm text-amber-700">
                  Add <code className="bg-amber-100 px-1 rounded">ELEVENLABS_API_KEY</code> to your <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable real audio generation.{' '}
                  <a href="https://elevenlabs.io/api" target="_blank" rel="noreferrer" className="underline">Get API key at elevenlabs.io/api →</a>
                </p>
              </div>
            )}

            {/* Voice Selector */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Select Voice</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {voices.map(v => (
                  <button
                    key={v.voice_id}
                    onClick={() => setSelectedVoice(v)}
                    className={`rounded-xl border p-3 text-left transition-all ${selectedVoice?.voice_id === v.voice_id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                  >
                    <p className="font-semibold text-sm text-gray-900">{v.name}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{v.description || v.category}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{v.category}</span>
                      {!hasApiKey && (
                        <span
                          className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs cursor-help"
                          title="Connect API for audio preview"
                        >Preview</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-700">Input Text</label>
                <span className={`text-xs ${inputText.length > 4800 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                  {inputText.length} / 5000
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="Enter the text you want to convert to speech..."
                className="w-full border rounded-xl p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Use Case</label>
                <select
                  value={useCase}
                  onChange={e => setUseCase(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {USE_CASES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Model</label>
                <select
                  value={modelId}
                  onChange={e => setModelId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedVoice || !inputText.trim()}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating...' : '🎙️ Generate Voice'}
              </button>
              {generateResult?.audio_base64 && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  ⬇ Download MP3
                </button>
              )}
            </div>

            {/* Result */}
            {generateResult && (
              <div className={`rounded-xl border p-4 ${generateResult.error ? 'border-red-200 bg-red-50' : generateResult.warning ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                {generateResult.error && <p className="text-red-700 text-sm font-semibold">{generateResult.error}</p>}
                {generateResult.warning && (
                  <div>
                    <p className="text-amber-800 text-sm font-semibold mb-1">{generateResult.warning}</p>
                    <p className="text-amber-700 text-xs">Your text was logged. Once an API key is configured, you can regenerate this.</p>
                  </div>
                )}
                {generateResult.audio_base64 && (
                  <p className="text-green-700 text-sm font-semibold">Audio generated successfully! Playing now...</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === 'History' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Generation History</h2>
              <p className="text-xs text-gray-500 mt-0.5">{generations.length} generations recorded</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Voice</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Use Case</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Text</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Chars</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {generations.map(gen => (
                    <tr key={gen.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{gen.voice_name || gen.voice_id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{gen.use_case}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={gen.input_text}>
                        {gen.input_text.slice(0, 80)}{gen.input_text.length > 80 ? '...' : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{gen.character_count ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{gen.duration_seconds ? `${gen.duration_seconds}s` : '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(gen.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => replayGeneration(gen)}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600"
                          >
                            ▶ Replay
                          </button>
                          <button
                            onClick={() => copyText(gen.input_text)}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600"
                          >
                            Copy
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {generations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No generations yet. Use the Generate tab to create your first voiceover.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Marketing Use Cases */}
        {activeTab === 'Marketing Use Cases' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Pre-built script templates for common marketing scenarios. Click "Use Template" to load into the Generate tab.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MARKETING_TEMPLATES.map(t => (
                <div key={t.name} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t.duration}</span>
                  </div>
                  <p className="text-sm text-gray-600 italic leading-relaxed mb-3">"{t.script}"</p>
                  <button
                    onClick={() => useTemplate(t.script)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: API Usage */}
        {activeTab === 'API Usage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi
                label="Characters Used"
                value={subscription?.character_count?.toLocaleString() ?? (hasApiKey ? '—' : 'N/A')}
                sub="This billing period"
              />
              <Kpi
                label="Monthly Limit"
                value={subscription?.character_limit?.toLocaleString() ?? (hasApiKey ? '—' : '10,000 (free)')}
                sub="Characters per month"
              />
              <Kpi
                label="Remaining"
                value={
                  subscription?.character_count != null && subscription?.character_limit != null
                    ? (subscription.character_limit - subscription.character_count).toLocaleString()
                    : (hasApiKey ? '—' : '10,000')
                }
                sub="Available now"
              />
              <Kpi
                label="Generations"
                value={generations.length}
                sub="Stored in database"
              />
            </div>

            {!hasApiKey && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Free Tier Information</p>
                <p className="text-sm text-blue-700">ElevenLabs offers <strong>10,000 characters/month free</strong>. No credit card required for the free tier. Perfect for testing and small projects.</p>
              </div>
            )}

            {/* Cost Calculator */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Cost Calculator</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm text-gray-600 block mb-1">Number of characters</label>
                  <input
                    type="number"
                    value={costChars}
                    onChange={e => setCostChars(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    min="0"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">Estimated cost</p>
                  <p className="text-2xl font-bold text-gray-900">${estimatedCost}</p>
                  <p className="text-xs text-gray-400">at $0.30 per 1,000 characters</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Note: Free tier characters (10,000/month) are not charged. Actual pricing varies by plan.</p>
            </div>
          </div>
        )}

        {/* Tab: Setup */}
        {activeTab === 'Setup' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Setup Guide</h2>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <div>
                    <p className="font-medium text-gray-900">Create an ElevenLabs account</p>
                    <p className="text-sm text-gray-500 mt-0.5">Sign up for free at <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="text-indigo-600 underline">elevenlabs.io</a>. Free tier includes 10,000 characters/month.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div>
                    <p className="font-medium text-gray-900">Get your API key</p>
                    <p className="text-sm text-gray-500 mt-0.5">Go to <a href="https://elevenlabs.io/app/speech-synthesis" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Profile Settings → API Keys</a> and generate a key.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <div>
                    <p className="font-medium text-gray-900">Add to environment</p>
                    <p className="text-sm text-gray-500 mt-0.5">Add the following to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file:</p>
                    <pre className="mt-2 bg-gray-900 text-green-400 text-xs p-3 rounded-lg font-mono">ELEVENLABS_API_KEY=your_api_key_here</pre>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  <div>
                    <p className="font-medium text-gray-900">Restart the development server</p>
                    <p className="text-sm text-gray-500 mt-0.5">Run <code className="bg-gray-100 px-1 rounded">npm run dev</code> again to pick up the new environment variable.</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={`rounded-xl border p-4 ${hasApiKey ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{hasApiKey ? '✅' : '⚠️'}</span>
                <div>
                  <p className={`font-semibold text-sm ${hasApiKey ? 'text-green-800' : 'text-amber-800'}`}>
                    {hasApiKey ? 'API Key Detected' : 'API Key Not Configured'}
                  </p>
                  <p className={`text-xs mt-0.5 ${hasApiKey ? 'text-green-700' : 'text-amber-700'}`}>
                    {hasApiKey
                      ? 'Your ELEVENLABS_API_KEY is active. Real audio generation is enabled.'
                      : 'Set ELEVENLABS_API_KEY in .env.local to enable audio generation.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
