'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'projects', 'generator', 'review', 'bundles'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', projects: 'Projects', generator: 'Asset Generator',
  review: 'Asset Review', bundles: 'Bundle Manager',
};

const ALL_CHANNELS = ['Blog', 'Newsletter', 'LinkedIn', 'Twitter', 'Instagram', 'TikTok', 'YouTube Short'];

const PLATFORM_ICONS: Record<string, string> = {
  Blog: '📝', Newsletter: '✉', LinkedIn: 'in', Twitter: '𝕏',
  Instagram: '📸', TikTok: '♪', 'YouTube Short': '▶',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  planning: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  ready: 'bg-emerald-100 text-emerald-700',
};

interface Project {
  id: number; title: string; source_type: string; status: string;
  goals: string[]; target_channels: string[];
  asset_count: number; approved_count: number; created_at: string;
}

interface Asset {
  id: number; project_id: number; asset_type: string; title: string;
  platform: string; format: string; content: string; status: string;
  approved_by: string | null; approved_at: string | null; created_at: string;
}

interface Bundle {
  id: number; bundle_name: string; assets_count: number; channels: string[];
  status: string; created_at: string;
}

interface Stats {
  total_projects: string; total_assets: string;
  assets_this_week: string; approved_assets: string; all_channels: string[];
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function KpiCard({ label, value, sub, border }: { label: string; value: string | number; sub?: string; border: string }) {
  return (
    <div className={`rounded-lg p-4 ${border}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ContentRepurposingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectDetail, setProjectDetail] = useState<{ project: Project; assets: Asset[]; bundles: Bundle[] } | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<{ platform: string; title: string; status: string }[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [assetFilter, setAssetFilter] = useState({ platform: '', status: '' });
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editContent, setEditContent] = useState('');
  const [bundling, setBundling] = useState(false);
  const [msg, setMsg] = useState('');
  const [newProject, setNewProject] = useState({ title: '', source_type: 'video', source_reference: '', source_duration_minutes: 0 });
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-repurposing', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { projects: Project[]; stats: Stats };
        setProjects(data.projects);
        setStats(data.stats);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadProjectDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/admin/content-repurposing/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as { project: Project; assets: Asset[]; bundles: Bundle[] };
      setProjectDetail(data);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadProjectDetail(selectedProjectId);
  }, [selectedProjectId, loadProjectDetail]);

  // Load all assets across projects for the Review tab
  const loadAllAssets = useCallback(async () => {
    const all: Asset[] = [];
    for (const p of projects) {
      const res = await fetch(`/api/admin/content-repurposing/${p.id}/assets?platform=${assetFilter.platform}&status=${assetFilter.status}`, { cache: 'no-store' });
      if (res.ok) { const rows = await res.json() as Asset[]; all.push(...rows); }
    }
    setAllAssets(all);
  }, [projects, assetFilter]);

  useEffect(() => {
    if (tab === 'review' && projects.length) loadAllAssets();
  }, [tab, projects, loadAllAssets]);

  const generateAssets = async () => {
    if (!selectedProjectId || !selectedChannels.length) { setMsg('Select a project and at least one channel.'); return; }
    setGenerating(true);
    setMsg('');
    setGeneratedAssets([]);
    try {
      const res = await fetch(`/api/admin/content-repurposing/${selectedProjectId}/generate-assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_channels: selectedChannels }),
      });
      if (res.ok) {
        const d = await res.json() as { created_count: number; assets: { platform: string; title: string; status: string }[] };
        setGeneratedAssets(d.assets);
        setMsg(`Generated ${d.created_count} assets!`);
        await load();
        await loadProjectDetail(selectedProjectId);
      } else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setGenerating(false); }
  };

  const updateAsset = async (id: number, updates: { content?: string; status?: string; approved_by?: string }) => {
    const res = await fetch(`/api/admin/content-repurposing/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) { setMsg('Updated!'); setEditingAsset(null); await loadAllAssets(); }
    else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
  };

  const createBundle = async (projectId: number) => {
    setBundling(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/content-repurposing/${projectId}/bundle`, { method: 'POST' });
      if (res.ok) { setMsg('Bundle created!'); await load(); await loadProjectDetail(projectId); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setBundling(false); }
  };

  const submitNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/content-repurposing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    });
    if (res.ok) { setMsg('Project created!'); setShowNewProjectForm(false); setNewProject({ title: '', source_type: 'video', source_reference: '', source_duration_minutes: 0 }); await load(); }
    else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
  };

  const toggleChannel = (ch: string) =>
    setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const projectsWithBundles = projectDetail?.bundles ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Content Repurposing</h1>
        <p className="text-slate-300 text-sm mt-0.5">UC16, UC20, UC37 — Repurpose recordings into shorts, reels, and multi-channel assets</p>
      </div>

      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="mx-6 mt-4 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800 text-sm">{msg}</div>}

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Projects" value={stats?.total_projects ?? 0} border="border-l-4 border-blue-500 bg-blue-50" />
                  <KpiCard label="Total Assets" value={stats?.total_assets ?? 0} border="border-l-4 border-purple-500 bg-purple-50" />
                  <KpiCard label="Assets This Week" value={stats?.assets_this_week ?? 0} border="border-l-4 border-green-500 bg-green-50" />
                  <KpiCard label="Approval Rate" value={stats && parseInt(stats.total_assets) > 0 ? `${Math.round(parseInt(stats.approved_assets) / parseInt(stats.total_assets) * 100)}%` : '0%'} border="border-l-4 border-amber-500 bg-amber-50" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-sm mb-3">Projects by Status</h3>
                    {projects.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="text-sm truncate max-w-[200px]">{p.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{p.asset_count} assets</span>
                          <Badge label={p.status} cls={STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-sm mb-3">Channels Covered</h3>
                    <div className="flex flex-wrap gap-2">
                      {ALL_CHANNELS.map(ch => {
                        const active = projects.some(p => p.target_channels?.includes(ch));
                        return (
                          <div key={ch} className={`px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                            {PLATFORM_ICONS[ch]} {ch}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PROJECTS */}
        {tab === 'projects' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Repurposing Projects</h2>
              <button onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700">
                + New Project
              </button>
            </div>
            {showNewProjectForm && (
              <form onSubmit={submitNewProject} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm">New Repurposing Project</h3>
                <input value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} required
                  placeholder="Project title *" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newProject.source_type} onChange={e => setNewProject(p => ({ ...p, source_type: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="video">Video</option>
                    <option value="recording">Recording</option>
                    <option value="webinar">Webinar</option>
                    <option value="podcast">Podcast</option>
                  </select>
                  <input value={newProject.source_reference} onChange={e => setNewProject(p => ({ ...p, source_reference: e.target.value }))}
                    placeholder="Source file/URL" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700">Create</button>
                  <button type="button" onClick={() => setShowNewProjectForm(false)} className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
                    <Badge label={p.status} cls={STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <p className="text-xs text-gray-400 mb-2 capitalize">{p.source_type}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(p.goals || []).map((g, i) => (
                      <span key={i} className="bg-purple-50 text-purple-700 text-xs px-1.5 py-0.5 rounded">{g}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-2">
                    <span>{p.asset_count} assets · {p.approved_count} approved</span>
                    <button onClick={() => { setSelectedProjectId(p.id); setTab('generator'); }}
                      className="text-blue-600 hover:text-blue-800">Generate →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASSET GENERATOR */}
        {tab === 'generator' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-sm mb-3">Select Project</h3>
              <select value={selectedProjectId ?? ''} onChange={e => { setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null); setGeneratedAssets([]); }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">-- Choose a project --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-sm mb-3">Target Channels</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ALL_CHANNELS.map(ch => (
                  <label key={ch} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${selectedChannels.includes(ch) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedChannels.includes(ch)} onChange={() => toggleChannel(ch)} className="accent-blue-600" />
                    <span className="text-sm">{PLATFORM_ICONS[ch]} {ch}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={generateAssets} disabled={generating || !selectedProjectId || !selectedChannels.length}
                  className="bg-purple-600 text-white rounded px-6 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                  {generating ? `Generating ${selectedChannels.length} assets…` : 'Generate All'}
                </button>
                <button onClick={() => setSelectedChannels(ALL_CHANNELS)}
                  className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">Select All</button>
                <button onClick={() => setSelectedChannels([])}
                  className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">Clear</button>
              </div>
            </div>

            {generatedAssets.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Generated Assets</h3>
                {generatedAssets.map((a, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                    <span className="text-lg">{PLATFORM_ICONS[a.platform] || '📄'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.platform}</p>
                    </div>
                    <Badge label={a.status} cls={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                ))}
              </div>
            )}

            {selectedProjectId && projectDetail && projectDetail.project.id === selectedProjectId && projectDetail.assets.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">All Assets for This Project</h3>
                {projectDetail.assets.map(a => (
                  <details key={a.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <summary className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                      <span>{PLATFORM_ICONS[a.platform] || '📄'}</span>
                      <span className="flex-1 text-sm font-medium">{a.title}</span>
                      <Badge label={a.platform} cls="bg-gray-100 text-gray-600" />
                      <Badge label={a.status} cls={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'} />
                    </summary>
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 rounded p-2">{a.content}</pre>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ASSET REVIEW */}
        {tab === 'review' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select value={assetFilter.platform} onChange={e => setAssetFilter(f => ({ ...f, platform: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">All Platforms</option>
                {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={assetFilter.status} onChange={e => setAssetFilter(f => ({ ...f, status: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {editingAsset && (
              <div className="bg-white rounded-lg border border-blue-200 p-4">
                <h3 className="font-semibold text-sm mb-2">Editing: {editingAsset.title}</h3>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={6}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => updateAsset(editingAsset.id, { content: editContent })}
                    className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700">Save</button>
                  <button onClick={() => setEditingAsset(null)} className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Platform</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allAssets.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium max-w-[200px] truncate">{a.title}</td>
                      <td className="px-4 py-2">{PLATFORM_ICONS[a.platform]} {a.platform}</td>
                      <td className="px-4 py-2"><Badge label={a.status} cls={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingAsset(a); setEditContent(a.content); }}
                            className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                          {a.status !== 'approved' && (
                            <button onClick={() => updateAsset(a.id, { status: 'approved', approved_by: 'Admin' })}
                              className="text-xs text-green-600 hover:text-green-800">Approve</button>
                          )}
                          {a.status !== 'rejected' && (
                            <button onClick={() => updateAsset(a.id, { status: 'rejected' })}
                              className="text-xs text-red-600 hover:text-red-800">Reject</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allAssets.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No assets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BUNDLE MANAGER */}
        {tab === 'bundles' && (
          <div className="space-y-4">
            {projects.map(p => (
              <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs text-gray-400">{p.approved_count} approved assets ready</p>
                  </div>
                  <button onClick={async () => { await loadProjectDetail(p.id); setSelectedProjectId(p.id); }}
                    className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">Load Details</button>
                </div>

                {selectedProjectId === p.id && projectDetail && (
                  <div className="space-y-3">
                    {projectDetail.bundles.length > 0 ? (
                      projectDetail.bundles.map(b => (
                        <div key={b.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{b.bundle_name}</p>
                            <p className="text-xs text-gray-400">{b.assets_count} assets · {(b.channels || []).join(', ')}</p>
                          </div>
                          <Badge label={b.status} cls={STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'} />
                          <button className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-1 cursor-not-allowed" disabled>
                            Download ZIP (coming soon)
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400">No bundles yet.</p>
                    )}
                    {p.approved_count > 0 && (
                      <button onClick={() => createBundle(p.id)} disabled={bundling}
                        className="bg-green-600 text-white rounded px-4 py-2 text-sm hover:bg-green-700 disabled:opacity-60">
                        {bundling ? 'Creating…' : 'Create Bundle from Approved Assets'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
