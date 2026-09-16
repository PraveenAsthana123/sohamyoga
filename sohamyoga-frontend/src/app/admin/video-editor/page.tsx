'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface VideoProject {
  id: string;
  title: string;
  description: string;
  project_type: string;
  platform: string[];
  status: string;
  aspect_ratio: string;
  resolution: string;
  duration_seconds: number | null;
  music_track: string | null;
  ai_script: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface VideoClip {
  id: string;
  project_id: string;
  clip_name: string;
  start_time: number;
  end_time: number;
  duration: number;
  order_index: number;
  text_overlay: string | null;
  text_position: string;
  filter_name: string | null;
  volume: number;
}

interface VideoTemplate {
  id: string;
  name: string;
  category: string;
  platform: string;
  aspect_ratio: string;
  duration_seconds: number;
  description: string;
  use_count: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ['reel','short','story','ad','course','testimonial','product_demo'];
const PLATFORMS = ['instagram','youtube','tiktok','facebook','linkedin'];
const ASPECT_RATIOS = ['9:16','16:9','1:1'];
const FILTERS = ['none','warm','cool','vintage','bright'];
const TEXT_POSITIONS = ['top','middle','bottom'];
const STOCK_MUSIC = [
  { name: 'Energetic Pop', genre: 'Pop', mood: 'Upbeat', bpm: 128 },
  { name: 'Calm Acoustic', genre: 'Acoustic', mood: 'Calm', bpm: 75 },
  { name: 'Corporate', genre: 'Corporate', mood: 'Professional', bpm: 100 },
  { name: 'Hip Hop Beat', genre: 'Hip Hop', mood: 'Fun', bpm: 95 },
  { name: 'Cinematic', genre: 'Orchestral', mood: 'Dramatic', bpm: 60 },
];

const PLATFORM_ICONS: Record<string, string> = {
  instagram: 'IG', youtube: 'YT', tiktok: 'TT', facebook: 'FB', linkedin: 'LI',
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  youtube: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-900 text-white',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
};

const TYPE_COLORS: Record<string, string> = {
  reel: 'bg-pink-50 border-pink-200',
  short: 'bg-red-50 border-red-200',
  story: 'bg-purple-50 border-purple-200',
  ad: 'bg-amber-50 border-amber-200',
  course: 'bg-blue-50 border-blue-200',
  testimonial: 'bg-green-50 border-green-200',
  product_demo: 'bg-indigo-50 border-indigo-200',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  editing: 'bg-blue-100 text-blue-700',
  rendering: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  posted: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-200 text-gray-500',
};

const SCRIPT_EXAMPLES = [
  {
    platform: 'Instagram Reel',
    title: 'Product Hook (30s)',
    script: `[0:00] Hook: "I tried yoga every morning for 30 days — here's what happened..."\n[0:03] Main: Show 3 quick transformation clips with text overlays. Energy, flexibility, stress.\n[0:20] CTA: "Follow for Day 1-30 results. Drop a 🧘 if you want the full series!"`,
  },
  {
    platform: 'YouTube Short',
    title: 'Tutorial (60s)',
    script: `[0:00] Hook: "This breathing technique will calm you in 60 seconds."\n[0:03] Step 1: "Breathe in for 4 counts" — visual countdown\n[0:12] Step 2: "Hold for 4 counts" — hold graphic\n[0:20] Step 3: "Out for 4 counts" — exhale animation\n[0:28] Demo: Show 2x full rounds\n[0:50] CTA: "Subscribe for daily wellness tips →"`,
  },
  {
    platform: 'TikTok',
    title: 'Trending Hook (15s)',
    script: `[0:00] "POV: You discovered yoga changes everything" — jump cut\n[0:03] Quick montage: 4 x 2s clips of poses with text overlays\n[0:11] End card: "@sohamyoga — start your journey today"`,
  },
];

// ── Helper Components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  const isPulsing = status === 'rendering';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {isPulsing && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLORS[platform] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${cls}`}>
      {PLATFORM_ICONS[platform] ?? platform.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [scriptResult, setScriptResult] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [musicMood, setMusicMood] = useState('');
  const [timelineProject, setTimelineProject] = useState<VideoProject | null>(null);

  // New project form
  const [newForm, setNewForm] = useState({
    title: '', description: '', project_type: 'reel',
    platform: ['instagram'] as string[], aspect_ratio: '9:16',
  });

  // Script form
  const [scriptForm, setScriptForm] = useState({
    platform: 'instagram', type: 'reel', topic: '', duration_seconds: 30,
    tone: 'energetic', target_audience: 'wellness enthusiasts',
  });

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      const r = await fetch(`/api/admin/video-editor?${params}`);
      const d = await r.json() as { projects?: VideoProject[] };
      setProjects(d.projects ?? []);
    } catch {}
    setLoading(false);
  }, [filterStatus, filterType]);

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/video-editor?resource=templates');
      const d = await r.json() as { templates?: VideoTemplate[] };
      setTemplates(d.templates ?? []);
    } catch {}
  }, []);

  const fetchClips = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const r = await fetch(`/api/admin/video-editor/${projectId}`);
      const d = await r.json() as { clips?: VideoClip[] };
      setClips(d.clips ?? []);
    } catch {}
  }, []);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);
  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject) ?? null;
      setTimelineProject(proj);
      void fetchClips(selectedProject);
    }
  }, [selectedProject, projects, fetchClips]);

  async function createProject() {
    if (!newForm.title.trim()) return;
    try {
      await fetch('/api/admin/video-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      setShowNewModal(false);
      setNewForm({ title: '', description: '', project_type: 'reel', platform: ['instagram'], aspect_ratio: '9:16' });
      void fetchProjects();
    } catch {}
  }

  async function deleteProject(id: string) {
    if (!confirm('Archive this project?')) return;
    await fetch(`/api/admin/video-editor/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) });
    void fetchProjects();
  }

  async function cloneProject(proj: VideoProject) {
    await fetch('/api/admin/video-editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proj, title: `${proj.title} (Copy)`, status: 'draft' }),
    });
    void fetchProjects();
  }

  async function generateScript() {
    if (!scriptForm.topic.trim()) { alert('Enter a topic first'); return; }
    setScriptLoading(true);
    setScriptResult('');
    try {
      const r = await fetch(`/api/admin/video-editor/${selectedProject || 'none'}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scriptForm),
      });
      const d = await r.json() as { script?: string; word_count?: number; estimated_duration_seconds?: number };
      setScriptResult(d.script ?? '');
    } catch { setScriptResult('Error generating script. Check Ollama is running.'); }
    setScriptLoading(false);
  }

  async function useTemplate(t: VideoTemplate) {
    await fetch('/api/admin/video-editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `New ${t.name}`,
        project_type: t.category,
        aspect_ratio: t.aspect_ratio,
        duration_seconds: t.duration_seconds,
        platform: [t.platform],
      }),
    });
    void fetchProjects();
    setTab(0);
  }

  async function addClip() {
    if (!selectedProject) return;
    await fetch('/api/admin/video-editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'clip', project_id: selectedProject, clip_name: `Clip ${clips.length + 1}`, order_index: clips.length }),
    });
    void fetchClips(selectedProject);
  }

  async function setRendering() {
    if (!selectedProject) return;
    await fetch(`/api/admin/video-editor/${selectedProject}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rendering' }),
    });
    void fetchProjects();
    alert('Project sent to render queue (status: rendering). Connect an FFmpeg server for real rendering.');
  }

  const filteredMusic = musicMood
    ? STOCK_MUSIC.filter(m => m.mood.toLowerCase() === musicMood.toLowerCase())
    : STOCK_MUSIC;

  const tabs = ['Projects', 'Script Generator (AI)', 'Timeline Editor', 'Templates', 'Assets & Music'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Video Studio</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create, edit, and manage video content with AI assistance</p>
          </div>
          <button onClick={() => setShowNewModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Project
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Tab 0: Projects ─────────────────────────────────────────────── */}
        {tab === 0 && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">All Types</option>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">All Statuses</option>
                {['draft','editing','rendering','ready','posted','archived'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setFilterType(''); setFilterStatus(''); }} className="text-sm text-gray-500 hover:text-gray-700 px-2">Clear</button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No projects found. Create your first video project.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(proj => (
                  <div key={proj.id} className={`bg-white rounded-xl border-2 ${TYPE_COLORS[proj.project_type] ?? 'border-gray-200'} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
                    {/* Thumbnail Placeholder */}
                    <div className={`h-32 flex items-center justify-center text-4xl ${TYPE_COLORS[proj.project_type]?.replace('border-','bg-') ?? 'bg-gray-100'}`}>
                      {proj.project_type === 'reel' ? '🎬' : proj.project_type === 'short' ? '▶' : proj.project_type === 'story' ? '📖' : proj.project_type === 'ad' ? '📣' : proj.project_type === 'course' ? '🎓' : '🎥'}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{proj.title}</h3>
                        <StatusBadge status={proj.status} />
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {proj.platform?.map(p => <PlatformBadge key={p} platform={p} />)}
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{proj.aspect_ratio}</span>
                        {proj.duration_seconds && <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{proj.duration_seconds}s</span>}
                      </div>
                      {proj.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{proj.description}</p>}
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { setSelectedProject(proj.id); setTab(2); }}
                          className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100">Edit</button>
                        <button onClick={() => cloneProject(proj)}
                          className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Clone</button>
                        <button onClick={() => deleteProject(proj.id)}
                          className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600">Archive</button>
                        <a href="/admin/reels" className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded hover:bg-purple-100">
                          Post →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 1: Script Generator ──────────────────────────────────────── */}
        {tab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Script Generator</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                      <select value={scriptForm.platform} onChange={e => setScriptForm(f => ({ ...f, platform: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Video Type</label>
                      <select value={scriptForm.type} onChange={e => setScriptForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Topic *</label>
                    <input value={scriptForm.topic} onChange={e => setScriptForm(f => ({ ...f, topic: e.target.value }))}
                      placeholder="e.g. morning yoga routine for beginners"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                      <select value={scriptForm.duration_seconds} onChange={e => setScriptForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {[15, 30, 60, 90, 120].map(d => <option key={d} value={d}>{d}s</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
                      <select value={scriptForm.tone} onChange={e => setScriptForm(f => ({ ...f, tone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {['energetic','professional','casual','inspirational','educational'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Target Audience</label>
                    <input value={scriptForm.target_audience} onChange={e => setScriptForm(f => ({ ...f, target_audience: e.target.value }))}
                      placeholder="e.g. wellness enthusiasts aged 25-40"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <button onClick={generateScript} disabled={scriptLoading}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {scriptLoading ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating with Ollama...</>
                    ) : '✨ Generate Script'}
                  </button>
                </div>
              </div>

              {scriptResult && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Generated Script</h3>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(scriptResult)}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200">Copy</button>
                      <button onClick={generateScript}
                        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100">New Variation</button>
                    </div>
                  </div>
                  <textarea value={scriptResult} onChange={e => setScriptResult(e.target.value)}
                    rows={12}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 bg-gray-50 resize-none" />
                </div>
              )}
            </div>

            {/* Examples Panel */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Script Examples</h2>
              <div className="space-y-4">
                {SCRIPT_EXAMPLES.map((ex, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{ex.platform}</span>
                      <span className="text-sm font-medium text-gray-800">{ex.title}</span>
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3">{ex.script}</pre>
                    <button onClick={() => setScriptResult(ex.script)}
                      className="mt-2 text-xs text-indigo-600 hover:text-indigo-800">Use this template →</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Timeline Editor ───────────────────────────────────────── */}
        {tab === 2 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Project</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                  className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">-- Choose a project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {selectedProject && (
                <div className="flex gap-2 pt-5">
                  <button onClick={addClip}
                    className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100">+ Add Clip</button>
                  <button onClick={setRendering}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">Send to Render</button>
                </div>
              )}
            </div>

            {!selectedProject ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                Select a project above to open the timeline editor
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Clip list */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 px-5 py-3 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-700">Clips — drag to reorder (visual)</h3>
                    </div>
                    {clips.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">No clips yet. Click &quot;Add Clip&quot; to start building.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {clips.map((clip, idx) => (
                          <div key={clip.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                              <span className="font-medium text-sm text-gray-900 flex-1">{clip.clip_name}</span>
                              <span className="text-xs text-gray-400">{clip.duration ?? '?'}s</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 ml-9">
                              <div className="flex gap-2">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">Start (s)</label>
                                  <input defaultValue={clip.start_time} type="number" min={0}
                                    className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">End (s)</label>
                                  <input defaultValue={clip.end_time} type="number" min={0}
                                    className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Filter</label>
                                <select defaultValue={clip.filter_name ?? 'none'}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white">
                                  {FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-500 mb-0.5">Text Overlay</label>
                                <div className="flex gap-2">
                                  <input defaultValue={clip.text_overlay ?? ''} placeholder="Text to show on clip..."
                                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                                  <select defaultValue={clip.text_position}
                                    className="border border-gray-200 rounded px-2 py-1 text-xs bg-white">
                                    {TEXT_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-500 mb-0.5">Volume: {clip.volume}</label>
                                <input type="range" min={0} max={1} step={0.05} defaultValue={clip.volume}
                                  className="w-full accent-indigo-600" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timeline bar */}
                  {clips.length > 0 && (
                    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="text-xs font-medium text-gray-600 mb-2">Timeline Preview</h4>
                      <div className="flex gap-1 h-10 rounded-lg overflow-hidden border border-gray-200">
                        {clips.map((clip, idx) => {
                          const colors = ['bg-indigo-400','bg-blue-400','bg-purple-400','bg-teal-400','bg-pink-400'];
                          const dur = clip.duration ?? 5;
                          const totalDur = clips.reduce((s, c) => s + (c.duration ?? 5), 0) || 1;
                          return (
                            <div key={clip.id} className={`${colors[idx % colors.length]} flex items-center justify-center text-white text-xs font-medium`}
                              style={{ width: `${(dur / totalDur) * 100}%` }}>
                              {clip.clip_name.slice(0, 8)}
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => {
                        const json = JSON.stringify({ clips, total_duration: clips.reduce((s, c) => s + (c.duration ?? 0), 0), aspect_ratio: timelineProject?.aspect_ratio }, null, 2);
                        navigator.clipboard.writeText(json);
                        alert('Timeline JSON copied to clipboard!');
                      }} className="mt-2 text-xs text-gray-500 hover:text-gray-700">Export Timeline JSON →</button>
                    </div>
                  )}
                </div>

                {/* Preview panel */}
                <div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Frame Preview</h4>
                    <div className="bg-gray-900 rounded-lg aspect-[9/16] max-h-64 flex items-center justify-center relative overflow-hidden mx-auto" style={{ maxWidth: '120px' }}>
                      <div className="text-gray-500 text-xs text-center px-2">
                        {clips[0]?.clip_name ?? 'No clip'}
                      </div>
                      {clips[0]?.text_overlay && (
                        <div className={`absolute left-0 right-0 ${clips[0].text_position === 'top' ? 'top-2' : clips[0].text_position === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-2'} text-center`}>
                          <span className="text-white text-xs font-bold drop-shadow px-1 py-0.5 bg-black bg-opacity-40 rounded">
                            {clips[0].text_overlay}
                          </span>
                        </div>
                      )}
                    </div>
                    {timelineProject && (
                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        <div>Ratio: <span className="font-medium text-gray-700">{timelineProject.aspect_ratio}</span></div>
                        <div>Resolution: <span className="font-medium text-gray-700">{timelineProject.resolution}</span></div>
                        <div>Clips: <span className="font-medium text-gray-700">{clips.length}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Templates ─────────────────────────────────────────────── */}
        {tab === 3 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Video Templates</h2>
              <button onClick={() => {
                const name = prompt('Template name?');
                if (name) {
                  fetch('/api/admin/video-editor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resource: 'template', name, category: 'how_to' }),
                  }).then(() => fetchTemplates());
                }
              }} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                Create Template from Project
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-24 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <span className="text-2xl">
                      {t.category === 'product_showcase' ? '🛍️' : t.category === 'testimonial' ? '💬' : t.category === 'how_to' ? '📋' : t.category === 'announcement' ? '📣' : t.category === 'behind_scenes' ? '🎥' : '✨'}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900">{t.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{t.category}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t.platform}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t.duration_seconds}s</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{t.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Used {t.use_count}×</span>
                      <button onClick={() => useTemplate(t)}
                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                        Use Template
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 4: Assets & Music ─────────────────────────────────────────── */}
        {tab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Music */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Music Library</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {['','Upbeat','Calm','Professional','Fun','Dramatic'].map(m => (
                  <button key={m} onClick={() => setMusicMood(m)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${musicMood === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {m || 'All Moods'}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredMusic.map((track, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{track.name}</div>
                        <div className="text-xs text-gray-500">{track.genre} · {track.mood} · {track.bpm} BPM</div>
                      </div>
                      <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200">▶ Preview</button>
                    </div>
                    {/* CSS waveform animation */}
                    <div className="flex items-end gap-0.5 h-6">
                      {Array.from({ length: 24 }).map((_, j) => (
                        <div key={j} className="bg-indigo-300 rounded-sm flex-1"
                          style={{ height: `${20 + Math.sin(j * 0.8 + i) * 12}px`, opacity: 0.7 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload section */}
            <div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Assets</h2>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="text-4xl mb-3">📁</div>
                  <p className="text-sm text-gray-600 font-medium">Drag & drop video clips or thumbnails</p>
                  <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM · JPG, PNG · Max 500MB</p>
                  <button className="mt-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
                    Browse Files
                  </button>
                  <p className="text-xs text-gray-400 mt-3">Note: File upload requires cloud storage configuration (AWS S3 / Cloudinary)</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Asset Tips</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex gap-2"><span className="text-green-500">✓</span> Shoot in 9:16 for Reels &amp; Shorts</div>
                  <div className="flex gap-2"><span className="text-green-500">✓</span> Hook within first 1-3 seconds</div>
                  <div className="flex gap-2"><span className="text-green-500">✓</span> Use text overlays for silent viewers</div>
                  <div className="flex gap-2"><span className="text-green-500">✓</span> 1080p minimum for all platforms</div>
                  <div className="flex gap-2"><span className="text-yellow-500">⚠</span> Avoid copyrighted music without license</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Project Modal ──────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-5">New Video Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Project title"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={newForm.project_type} onChange={e => setNewForm(f => ({ ...f, project_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Aspect Ratio</label>
                  <select value={newForm.aspect_ratio} onChange={e => setNewForm(f => ({ ...f, aspect_ratio: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {ASPECT_RATIOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={newForm.platform.includes(p)}
                        onChange={e => setNewForm(f => ({
                          ...f,
                          platform: e.target.checked ? [...f.platform, p] : f.platform.filter(x => x !== p),
                        }))} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Brief description..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={createProject}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
