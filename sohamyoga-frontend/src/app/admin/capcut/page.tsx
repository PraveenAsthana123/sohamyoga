'use client';

import { useState, useEffect } from 'react';

interface CapCutProject {
  id: number;
  project_number: string;
  project_name: string;
  template_id: string | null;
  template_name: string | null;
  script: string | null;
  aspect_ratio: string;
  duration_estimate: string | null;
  background_music: string | null;
  voiceover_text: string | null;
  voiceover_voice: string | null;
  subtitle_style: string | null;
  export_format: string;
  export_resolution: string;
  status: string;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
}

const ASPECT_RATIOS = ['9:16 (Reels/TikTok)', '16:9 (YouTube)', '1:1 (Instagram)', '4:3 (Facebook)'];
const EXPORT_FORMATS = ['MP4', 'MOV', 'GIF'];
const EXPORT_RESOLUTIONS = ['720p', '1080p', '4K'];
const VOICES = ['en-US Female', 'en-US Male', 'en-GB Female', 'en-AU Female', 'Auto'];
const SUBTITLE_STYLES = ['None', 'Bold White', 'Yellow Highlight', 'Karaoke', 'Minimal', 'TikTok Style'];
const TEMPLATES = [
  { id: 'product-showcase', name: 'Product Showcase' },
  { id: 'talking-head', name: 'Talking Head / Tutorial' },
  { id: 'slideshow', name: 'Slideshow / Photo Montage' },
  { id: 'social-reel', name: 'Social Media Reel' },
  { id: 'testimonial', name: 'Customer Testimonial' },
  { id: 'explainer', name: 'Explainer / How-To' },
  { id: 'promo-ad', name: 'Promotional Ad' },
  { id: 'event-recap', name: 'Event Recap' },
];

export default function CapCutPage() {
  const [projects, setProjects] = useState<CapCutProject[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'projects' | 'templates' | 'settings'>('create');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('social-reel');
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16 (Reels/TikTok)');
  const [voiceoverText, setVoiceoverText] = useState('');
  const [voice, setVoice] = useState('en-US Female');
  const [subtitleStyle, setSubtitleStyle] = useState('TikTok Style');
  const [exportFormat, setExportFormat] = useState('MP4');
  const [exportResolution, setExportResolution] = useState('1080p');
  const [result, setResult] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetch('/api/admin/capcut')
      .then(r => r.json())
      .then(d => { setProjects(d.items || []); setApiKeySet(d.api_key_set || false); })
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!projectName.trim()) return;
    setCreating(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/capcut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: projectName, template_id: selectedTemplate, template_name: TEMPLATES.find(t => t.id === selectedTemplate)?.name, script: script || null, aspect_ratio: aspectRatio, voiceover_text: voiceoverText || null, voiceover_voice: voice, subtitle_style: subtitleStyle, export_format: exportFormat, export_resolution: exportResolution }),
      });
      const d = await res.json();
      setResult(d.message || 'Project created');
      setProjects(prev => [d.project, ...prev].filter(Boolean));
      setProjectName('');
      setScript('');
      setVoiceoverText('');
    } catch { setResult('Failed to create project'); } finally { setCreating(false); }
  };

  const saveKey = async () => {
    setSavingKey(true);
    try {
      await fetch('/api/admin/capcut', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_api_key', api_key: apiKey }) });
      setApiKeySet(true);
      setApiKey('');
    } finally { setSavingKey(false); }
  };

  const statusColor = (s: string) => ({ draft: 'bg-gray-100 text-gray-600', queued: 'bg-yellow-100 text-yellow-700', rendering: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CapCut Integration</h1>
          <p className="text-gray-600 mt-1">AI-powered video editing — auto-captions, templates, voiceover, reels generation</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-black text-white rounded text-xs font-medium">ByteDance</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${apiKeySet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{apiKeySet ? 'API Key Set' : 'No API Key'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Projects', value: projects.length, color: 'bg-slate-600' },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Rendering', value: projects.filter(p => p.status === 'rendering').length, color: 'bg-blue-500' },
          { label: 'Drafts', value: projects.filter(p => p.status === 'draft').length, color: 'bg-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['create', 'projects', 'templates', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'create' ? 'Create Project' : t === 'projects' ? 'All Projects' : t === 'templates' ? 'Templates' : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          {!apiKeySet && <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">Connect CapCut API in Settings to enable automated rendering.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Summer Yoga Promo Reel" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Script / Content Brief</label>
            <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Describe the video content, key points to cover, products to feature, or paste a script..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voiceover Text</label>
            <textarea value={voiceoverText} onChange={e => setVoiceoverText(e.target.value)} placeholder="Text for AI voiceover narration (leave blank for music-only)" className="w-full border border-gray-200 rounded-lg p-3 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {ASPECT_RATIOS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
              <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {VOICES.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitles</label>
              <select value={subtitleStyle} onChange={e => setSubtitleStyle(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {SUBTITLE_STYLES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {EXPORT_FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
              <select value={exportResolution} onChange={e => setExportResolution(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
                {EXPORT_RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={create} disabled={creating || !projectName.trim()} className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Project'}
            </button>
            {result && <p className="text-sm text-green-600">{result}</p>}
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">All Projects</h2>
            <button onClick={() => setActiveTab('create')} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-900">+ New Project</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : projects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No projects yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['#', 'Project', 'Template', 'Ratio', 'Format', 'Res', 'Status', 'Output', 'Created'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs text-gray-400">{p.project_number}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 text-xs">{p.project_name}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{p.template_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{p.aspect_ratio}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{p.export_format}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{p.export_resolution}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
                    <td className="px-3 py-3 text-xs">{p.output_url ? <a href={p.output_url} target="_blank" rel="noreferrer" className="text-slate-700 hover:underline">Download</a> : '—'}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Available Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map(t => (
              <div key={t.id} className="border border-gray-200 rounded-lg p-4 hover:border-slate-400 cursor-pointer" onClick={() => { setSelectedTemplate(t.id); setActiveTab('create'); }}>
                <div className="w-full h-20 bg-gray-100 rounded mb-3 flex items-center justify-center">
                  <span className="text-2xl">{t.id === 'product-showcase' ? '📦' : t.id === 'talking-head' ? '🎙️' : t.id === 'slideshow' ? '📸' : t.id === 'social-reel' ? '📱' : t.id === 'testimonial' ? '⭐' : t.id === 'explainer' ? '📖' : t.id === 'promo-ad' ? '📢' : '🎬'}</span>
                </div>
                <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                <button className="mt-2 text-xs text-slate-600 hover:underline">Use template →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">CapCut API Settings</h2>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            CapCut for Business API access is available via <span className="font-mono">capcut.com/business</span>. The API enables automated video creation, template rendering, auto-captioning, and voiceover generation at scale.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CapCut API Key {apiKeySet && <span className="text-green-600 font-normal">(currently set)</span>}</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Your CapCut for Business API key" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <button onClick={saveKey} disabled={savingKey || !apiKey.trim()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">{savingKey ? 'Saving...' : 'Save API Key'}</button>
        </div>
      )}
    </div>
  );
}
