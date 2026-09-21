'use client';

import { useState, useEffect } from 'react';

interface ImageJob {
  id: number;
  job_number: string;
  prompt: string;
  negative_prompt: string | null;
  style: string;
  aspect_ratio: string;
  num_images: number;
  model_used: string;
  status: string;
  output_urls: string | null;
  created_at: string;
}

const STYLES = ['Photorealistic', 'Illustration', 'Watercolor', 'Oil Painting', 'Digital Art', 'Minimalist', 'Vintage', 'Anime', 'Product Shot', 'Logo / Icon'];
const ASPECT_RATIOS = ['1:1 (Square)', '16:9 (Landscape)', '9:16 (Portrait)', '4:3', '3:4', '2:1 (Banner)'];

export default function TextToImagePage() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'ai'>('generate');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [style, setStyle] = useState('Photorealistic');
  const [aspectRatio, setAspectRatio] = useState('1:1 (Square)');
  const [numImages, setNumImages] = useState(1);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch('/api/admin/text-to-image')
      .then(r => r.json())
      .then(d => setJobs(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/text-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negative_prompt: negativePrompt, style, aspect_ratio: aspectRatio, num_images: numImages }),
      });
      const d = await res.json();
      setResult(d.message || 'Job queued');
      setJobs(prev => [d.job, ...prev].filter(Boolean));
      setPrompt('');
      setNegativePrompt('');
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
        <h1 className="text-2xl font-bold text-gray-900">Text to Image</h1>
        <p className="text-gray-600 mt-1">Generate images from text prompts — product shots, banners, social graphics, and more</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'bg-pink-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Images Created', value: jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.num_images || 1), 0), color: 'bg-blue-500' },
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
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Prompt Writer' : t === 'history' ? 'Job History' : 'Generate Image'}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Image Generation Job</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the image... e.g. 'A serene yoga studio at dawn, soft golden light through floor-to-ceiling windows, minimalist decor, plants, wooden floors'" className="w-full border border-gray-200 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negative Prompt <span className="text-gray-400 font-normal">(what to avoid)</span></label>
              <input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="e.g. blurry, low quality, text, watermark, people" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                <select value={style} onChange={e => setStyle(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                  {STYLES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                  {ASPECT_RATIOS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Images</label>
                <select value={numImages} onChange={e => setNumImages(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                  {[1,2,4,8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={generate} disabled={generating || !prompt.trim()} className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
                {generating ? 'Queuing...' : 'Generate Image'}
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
            <div className="p-8 text-center text-gray-500">No jobs yet. Generate your first image above.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['#', 'Prompt', 'Style', 'Ratio', 'Count', 'Model', 'Status', 'Created'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{j.job_number}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate text-xs">{j.prompt}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.style}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.aspect_ratio}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.num_images}</td>
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
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe what you need (e.g. 'hero banner for a yoga studio spring campaign') and I'll write an optimised generation prompt..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-700 disabled:opacity-50">{aiLoading ? 'Writing...' : 'Write Prompt'}</button>
          {aiResponse && (
            <div className="mt-4 p-4 bg-pink-50 border border-pink-200 rounded-lg">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p>
              <button onClick={() => { setPrompt(aiResponse); setActiveTab('generate'); }} className="mt-2 text-xs text-pink-700 underline">Use this prompt →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
