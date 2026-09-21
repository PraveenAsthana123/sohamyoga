'use client';

import { useState, useEffect } from 'react';

interface VideoJob {
  id: number;
  job_number: string;
  prompt: string;
  style: string;
  duration_seconds: number;
  resolution: string;
  model_used: string;
  status: string;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
}

const STYLES = ['Cinematic', 'Animated', 'Realistic', 'Abstract', 'Documentary', 'Product Demo', 'Social Reel'];
const RESOLUTIONS = ['720p', '1080p', '4K'];
const DURATIONS = [5, 10, 15, 30, 60];

export default function TextToVideoPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'ai'>('generate');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Cinematic');
  const [duration, setDuration] = useState(10);
  const [resolution, setResolution] = useState('1080p');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch('/api/admin/text-to-video')
      .then(r => r.json())
      .then(d => setJobs(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, duration_seconds: duration, resolution }),
      });
      const d = await res.json();
      setResult(d.message || 'Job queued successfully');
      setJobs(prev => [d.job, ...prev].filter(Boolean));
      setPrompt('');
    } catch { setResult('Failed to queue job'); } finally { setGenerating(false); }
  };

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch { setAiResponse('AI unavailable'); } finally { setAiLoading(false); }
  };

  const statusColor = (s: string) => ({ queued: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Text to Video</h1>
        <p className="text-gray-600 mt-1">Generate videos from text prompts using AI models</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'bg-violet-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length, color: 'bg-blue-500' },
          { label: 'Queued', value: jobs.filter(j => j.status === 'queued').length, color: 'bg-yellow-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['generate', 'history', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Prompt Writer' : t === 'history' ? 'Job History' : 'Generate Video'}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Video Generation Job</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the video you want to generate... e.g. 'A yoga instructor demonstrating sun salutation at sunrise on a mountain peak, cinematic lighting'"
                className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                <select value={style} onChange={e => setStyle(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {STYLES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
                <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={generate} disabled={generating || !prompt.trim()} className="bg-violet-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                {generating ? 'Queuing...' : 'Generate Video'}
              </button>
              {result && <p className="text-sm text-green-600">{result}</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Generation History</h2>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No jobs yet. Generate your first video above.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['#', 'Prompt', 'Style', 'Duration', 'Resolution', 'Model', 'Status', 'Created'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{j.job_number}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate text-xs">{j.prompt}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.style}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.duration_seconds}s</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.resolution}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{j.model_used}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Prompt Writer</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a video concept and I'll write an optimised generation prompt for you..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50">{aiLoading ? 'Writing...' : 'Write Prompt'}</button>
          {aiResponse && (
            <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p>
              <button onClick={() => { setPrompt(aiResponse); setActiveTab('generate'); }} className="mt-2 text-xs text-violet-700 underline">Use this prompt →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
