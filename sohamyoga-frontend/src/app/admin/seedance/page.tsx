'use client';

import { useState, useEffect } from 'react';

interface SeedanceJob {
  id: number;
  job_number: string;
  prompt: string;
  negative_prompt: string | null;
  model_version: string;
  resolution: string;
  duration_seconds: number;
  motion_level: string;
  seed: number | null;
  status: string;
  output_url: string | null;
  task_id: string | null;
  inference_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

const MODELS = ['seedance-1-lite', 'seedance-1-pro', 'seedance-1-turbo'];
const RESOLUTIONS = ['480p', '720p', '1080p'];
const DURATIONS = [3, 5, 8, 10];
const MOTION_LEVELS = ['Low', 'Medium', 'High'];

export default function SeedancePage() {
  const [jobs, setJobs] = useState<SeedanceJob[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'settings'>('generate');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('seedance-1-pro');
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState(5);
  const [motionLevel, setMotionLevel] = useState('Medium');
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetch('/api/admin/seedance')
      .then(r => r.json())
      .then(d => { setJobs(d.items || []); setApiKeySet(d.api_key_set || false); })
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/seedance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negative_prompt: negativePrompt || null, model_version: model, resolution, duration_seconds: duration, motion_level: motionLevel, seed: seed ? Number(seed) : null }),
      });
      const d = await res.json();
      setResult(d.message || d.error || 'Job submitted');
      setJobs(prev => [d.job, ...prev].filter(Boolean));
      setPrompt('');
    } catch { setResult('Request failed'); } finally { setGenerating(false); }
  };

  const saveKey = async () => {
    setSavingKey(true);
    try {
      await fetch('/api/admin/seedance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_api_key', api_key: apiKey }) });
      setApiKeySet(true);
      setApiKey('');
    } finally { setSavingKey(false); }
  };

  const statusColor = (s: string) => ({ queued: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seedance Integration</h1>
          <p className="text-gray-600 mt-1">ByteDance Seedance — state-of-the-art AI video generation from text prompts</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">ByteDance</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${apiKeySet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{apiKeySet ? 'API Key Set' : 'No API Key'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Videos', value: jobs.length, color: 'bg-indigo-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length, color: 'bg-blue-500' },
          { label: 'Failed', value: jobs.filter(j => j.status === 'failed').length, color: 'bg-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['generate', 'history', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'generate' ? 'Generate Video' : t === 'history' ? 'Job History' : 'API Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          {!apiKeySet && <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">Add your Seedance API key in Settings to generate videos.</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A serene yoga flow at sunrise, camera slowly panning across a mountaintop studio, warm golden light, cinematic 4K..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Negative Prompt</label>
            <input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="blurry, watermark, text overlay, low quality, flickering" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MODELS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
              <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motion Level</label>
              <select value={motionLevel} onChange={e => setMotionLevel(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MOTION_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seed <span className="text-gray-400 font-normal">(optional — for reproducibility)</span></label>
            <input type="number" value={seed} onChange={e => setSeed(e.target.value)} placeholder="Leave blank for random" className="w-48 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={generate} disabled={generating || !prompt.trim()} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {generating ? 'Submitting...' : 'Generate Video'}
            </button>
            {result && <p className="text-sm text-green-600">{result}</p>}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Generation History</h2></div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No videos generated yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['#', 'Prompt', 'Model', 'Res', 'Dur', 'Motion', 'Status', 'Output', 'Created'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs text-gray-400">{j.job_number}</td>
                    <td className="px-3 py-3 text-gray-700 max-w-xs truncate text-xs">{j.prompt}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.model_version}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.resolution}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.duration_seconds}s</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.motion_level}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                    <td className="px-3 py-3 text-xs">{j.output_url ? <a href={j.output_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">View</a> : '—'}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Seedance API Settings</h2>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
            Seedance is available via ByteDance Volcano Engine. Get API access at <span className="font-mono">volcengine.com</span> under the Visual Intelligence service.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              { model: 'seedance-1-lite', speed: 'Fast (~30s)', quality: 'Good', cost: 'Low', useCase: 'Drafts & previews' },
              { model: 'seedance-1-pro', speed: 'Medium (~90s)', quality: 'Excellent', cost: 'Medium', useCase: 'Production content' },
              { model: 'seedance-1-turbo', speed: 'Fastest (~15s)', quality: 'Good', cost: 'Lowest', useCase: 'Rapid iteration' },
            ].map(m => (
              <div key={m.model} className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium text-gray-900 font-mono text-xs">{m.model}</p>
                <p className="text-gray-500 text-xs mt-1">Speed: {m.speed}</p>
                <p className="text-gray-500 text-xs">Quality: {m.quality}</p>
                <p className="text-gray-500 text-xs">Best for: {m.useCase}</p>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key {apiKeySet && <span className="text-green-600 font-normal">(currently set)</span>}</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Your Seedance / Volcano Engine API key" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={saveKey} disabled={savingKey || !apiKey.trim()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{savingKey ? 'Saving...' : 'Save API Key'}</button>
        </div>
      )}
    </div>
  );
}
