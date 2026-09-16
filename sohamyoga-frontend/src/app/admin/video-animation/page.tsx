'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnimProject {
  id: number;
  name: string;
  type: string;
  style: string | null;
  duration_seconds: number;
  client: string | null;
  brief: string | null;
  script: string | null;
  status: string;
  complexity: string;
  estimated_hours: number;
  created_at: string;
}

interface AnimAsset {
  id: number;
  project_id: number;
  asset_name: string;
  asset_type: string;
  format: string | null;
  version: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface MotionTemplate {
  id: number;
  name: string;
  category: string;
  duration_seconds: number;
  style: string | null;
  tags: string[];
  usage_count: number;
  created_at: string;
}

interface RepurposeJob {
  id: number;
  source_video: string;
  target_formats: string[];
  clips_count: number;
  status: string;
  output_summary: string | null;
  created_at: string;
}

interface AnimStats {
  total: number;
  explainer: number;
  motion_graphics: number;
  three_d: number;
  whiteboard: number;
  concept: number;
  in_progress: number;
  completed: number;
  total_assets: number;
  total_templates: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ANIM_TYPES = ['explainer', 'motion_graphics', '3d_animation', 'whiteboard', 'mixed_media'];
const COMPLEXITY_LEVELS = ['low', 'medium', 'high', 'very_high'];
const TEMPLATE_CATEGORIES = ['brand_intro', 'data_viz', 'transition', 'lower_third', 'bumper', 'background_motion', 'icon_animation', 'text_reveal'];
const REPURPOSE_FORMATS = ['instagram_reel', 'youtube_short', 'tiktok', 'linkedin_video', 'instagram_story', 'twitter_gif', 'email_banner', 'website_hero'];

const STATUS_COLORS: Record<string, string> = {
  concept: '#6b7280', storyboard: '#0891b2', production: '#d97706', review: '#7c3aed',
  revision: '#dc2626', approved: '#059669', completed: '#059669', queued: '#6b7280',
  in_progress: '#2563eb',
};

const TYPE_COLORS: Record<string, string> = {
  explainer: '#2563eb', motion_graphics: '#7c3aed', '3d_animation': '#059669',
  whiteboard: '#d97706', mixed_media: '#dc2626',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  low: '#059669', medium: '#d97706', high: '#dc2626', very_high: '#7c3aed',
};

function statusBadge(status: string) {
  return (
    <span style={{ background: STATUS_COLORS[status] || '#6b7280', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ label, value, color = '#7c3aed' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 22px', minWidth: 110 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const TABS = ['Animation Dashboard', 'Project Manager', 'Asset Library', 'Motion Templates', 'Repurposing Studio'];

export default function VideoAnimationPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [projects, setProjects] = useState<AnimProject[]>([]);
  const [assets, setAssets] = useState<AnimAsset[]>([]);
  const [templates, setTemplates] = useState<MotionTemplate[]>([]);
  const [repurpose, setRepurpose] = useState<RepurposeJob[]>([]);
  const [stats, setStats] = useState<AnimStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState('');
  const [selectedProject, setSelectedProject] = useState<AnimProject | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewRepurpose, setShowNewRepurpose] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', type: 'explainer', style: '', duration_seconds: 60, client: '', brief: '', complexity: 'medium', estimated_hours: 0 });
  const [newAsset, setNewAsset] = useState({ project_id: 0, asset_name: '', asset_type: 'character', format: '', notes: '' });
  const [newTemplate, setNewTemplate] = useState({ name: '', category: 'brand_intro', duration_seconds: 10, style: '', tags: '' });
  const [newRepurpose, setNewRepurpose] = useState({ source_video: '', target_formats: [] as string[] });
  const [repurposePlan, setRepurposePlan] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/video-animation');
      const data = await res.json();
      setProjects(data.projects || []);
      setAssets(data.assets || []);
      setTemplates(data.templates || []);
      setRepurpose(data.repurpose || []);
      setStats(data.stats || null);
      if (data.projects?.length > 0 && !selectedProject) setSelectedProject(data.projects[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { load(); }, []);

  async function generateBrief(project: AnimProject) {
    setAiStatus(`Generating animation brief for "${project.name}"...`);
    try {
      const res = await fetch(`/api/admin/video-animation/${project.id}/brief`, { method: 'POST' });
      const data = await res.json();
      if (data.brief) {
        setSelectedProject(prev => prev ? { ...prev, brief: data.brief } : null);
        setAiStatus('Animation brief generated.');
        await load();
      }
    } catch { setAiStatus('Brief generation failed.'); }
    setTimeout(() => setAiStatus(''), 5000);
  }

  async function generateRepurposePlan(job: RepurposeJob) {
    setAiStatus('Generating repurposing plan with AI...');
    try {
      const res = await fetch(`/api/admin/video-animation/repurpose/${job.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_title: job.source_video }),
      });
      const data = await res.json();
      if (data.plan) { setRepurposePlan(data.plan); setAiStatus('Repurposing plan generated.'); await load(); }
    } catch { setAiStatus('Plan generation failed.'); }
    setTimeout(() => setAiStatus(''), 5000);
  }

  async function updateProjectStatus(id: number, status: string) {
    await fetch(`/api/admin/video-animation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function createProject() {
    const res = await fetch('/api/admin/video-animation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    });
    if (res.ok) { setShowNewProject(false); setNewProject({ name: '', type: 'explainer', style: '', duration_seconds: 60, client: '', brief: '', complexity: 'medium', estimated_hours: 0 }); await load(); }
  }

  async function createAsset() {
    const res = await fetch(`/api/admin/video-animation/${newAsset.project_id}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) { setShowNewAsset(false); setNewAsset({ project_id: 0, asset_name: '', asset_type: 'character', format: '', notes: '' }); await load(); }
  }

  async function createTemplate() {
    const res = await fetch('/api/admin/video-animation/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTemplate, tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean) }),
    });
    if (res.ok) { setShowNewTemplate(false); setNewTemplate({ name: '', category: 'brand_intro', duration_seconds: 10, style: '', tags: '' }); await load(); }
  }

  async function createRepurposeJob() {
    const res = await fetch('/api/admin/video-animation/repurpose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRepurpose),
    });
    if (res.ok) { setShowNewRepurpose(false); setNewRepurpose({ source_video: '', target_formats: [] }); await load(); }
  }

  const filteredProjects = projects.filter(p => !filterType || p.type === filterType);
  const filteredTemplates = templates.filter(t => !filterCategory || t.category === filterCategory);
  const STATUS_ORDER = ['concept', 'storyboard', 'production', 'review', 'revision', 'completed'];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a0533', color: '#fff', padding: '20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Video Animation Studio</div>
        <div style={{ fontSize: 13, color: '#d8b4fe', marginTop: 4 }}>Explainer · Motion Graphics · 3D Animation · Whiteboard · Repurposing</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0, padding: '0 32px', overflowX: 'auto' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontWeight: activeTab === i ? 700 : 500, fontSize: 14,
            color: activeTab === i ? '#1a0533' : '#6b7280',
            borderBottom: activeTab === i ? '3px solid #7c3aed' : '3px solid transparent',
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ padding: '28px 32px' }}>
        {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>Loading...</div>}
        {aiStatus && (
          <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#7c3aed', fontWeight: 600 }}>
            {aiStatus}
          </div>
        )}

        {/* ── TAB 0: Animation Dashboard ── */}
        {!loading && activeTab === 0 && (
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
              <StatCard label="Total Projects" value={stats?.total || 0} color="#1a0533" />
              <StatCard label="Explainer" value={stats?.explainer || 0} color="#2563eb" />
              <StatCard label="Motion Graphics" value={stats?.motion_graphics || 0} color="#7c3aed" />
              <StatCard label="3D Animation" value={stats?.three_d || 0} color="#059669" />
              <StatCard label="Whiteboard" value={stats?.whiteboard || 0} color="#d97706" />
              <StatCard label="In Progress" value={stats?.in_progress || 0} color="#2563eb" />
              <StatCard label="Completed" value={stats?.completed || 0} color="#059669" />
              <StatCard label="Total Assets" value={stats?.total_assets || 0} color="#0891b2" />
              <StatCard label="Templates" value={stats?.total_templates || 0} color="#9333ea" />
            </div>

            {/* Project Type Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {ANIM_TYPES.map(type => {
                const typeProjects = projects.filter(p => p.type === type);
                const totalHours = typeProjects.reduce((acc, p) => acc + Number(p.estimated_hours), 0);
                return (
                  <div key={type} style={{ background: '#fff', border: `2px solid ${TYPE_COLORS[type] || '#e5e7eb'}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: TYPE_COLORS[type] || '#374151', fontSize: 13, textTransform: 'capitalize', marginBottom: 8 }}>
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#1a0533' }}>{typeProjects.length}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{totalHours}h estimated</div>
                  </div>
                );
              })}
            </div>

            {/* Recent Projects */}
            <h3 style={{ color: '#1a0533', marginBottom: 16 }}>All Animation Projects</h3>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Project', 'Type', 'Style', 'Duration', 'Complexity', 'Est. Hours', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1a0533' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: TYPE_COLORS[p.type] || '#6b7280', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                          {p.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 13 }}>{p.style || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#374151' }}>{p.duration_seconds}s</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: COMPLEXITY_COLORS[p.complexity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                          {p.complexity}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#374151' }}>{p.estimated_hours}h</td>
                      <td style={{ padding: '14px 16px' }}>{statusBadge(p.status)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={() => { setSelectedProject(p); setActiveTab(1); }} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 1: Project Manager (Kanban) ── */}
        {!loading && activeTab === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a0533' }}>Project Manager</h3>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                  <option value="">All Types</option>
                  {ANIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <button onClick={() => setShowNewProject(true)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + New Project
              </button>
            </div>

            {showNewProject && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>New Animation Project</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Project Name *" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newProject.type} onChange={e => setNewProject(p => ({ ...p, type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {ANIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input placeholder="Style (e.g. flat_2d, kinetic_typography)" value={newProject.style} onChange={e => setNewProject(p => ({ ...p, style: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Client" value={newProject.client} onChange={e => setNewProject(p => ({ ...p, client: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Duration (seconds)" type="number" value={newProject.duration_seconds} onChange={e => setNewProject(p => ({ ...p, duration_seconds: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newProject.complexity} onChange={e => setNewProject(p => ({ ...p, complexity: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {COMPLEXITY_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="Estimated Hours" type="number" value={newProject.estimated_hours} onChange={e => setNewProject(p => ({ ...p, estimated_hours: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <textarea placeholder="Project Brief" value={newProject.brief} onChange={e => setNewProject(p => ({ ...p, brief: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', gridColumn: '1 / -1' }} rows={3} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createProject} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Create</button>
                  <button onClick={() => setShowNewProject(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
              {STATUS_ORDER.map(col => (
                <div key={col}>
                  <div style={{ background: STATUS_COLORS[col] || '#6b7280', color: '#fff', borderRadius: '8px 8px 0 0', padding: '8px 12px', fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>
                    {col} ({filteredProjects.filter(p => p.status === col).length})
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '0 0 8px 8px', minHeight: 200, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredProjects.filter(p => p.status === col).map(p => (
                      <div key={p.id} style={{ background: '#fff', border: `1px solid ${TYPE_COLORS[p.type] || '#e5e7eb'}`, borderLeft: `4px solid ${TYPE_COLORS[p.type] || '#e5e7eb'}`, borderRadius: 8, padding: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1a0533', marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{p.duration_seconds}s · {p.estimated_hours}h</div>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ background: COMPLEXITY_COLORS[p.complexity] || '#6b7280', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            {p.complexity}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button onClick={() => { setSelectedProject(p); generateBrief(p); }} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                            AI Brief
                          </button>
                          {col !== 'completed' && (
                            <button onClick={() => { const next = STATUS_ORDER[STATUS_ORDER.indexOf(col) + 1]; if (next) updateProjectStatus(p.id, next); }}
                              style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>
                              Next
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected project brief panel */}
            {selectedProject?.brief && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, color: '#1a0533' }}>Brief: {selectedProject.name}</h4>
                  <button onClick={() => generateBrief(selectedProject)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>
                    Regenerate Brief
                  </button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
                  {selectedProject.brief}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Asset Library ── */}
        {!loading && activeTab === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1a0533' }}>Asset Library</h3>
              <button onClick={() => setShowNewAsset(true)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + Add Asset
              </button>
            </div>

            {showNewAsset && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Add Asset</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select value={newAsset.project_id} onChange={e => setNewAsset(p => ({ ...p, project_id: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    <option value={0}>Select Project *</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input placeholder="Asset Name *" value={newAsset.asset_name} onChange={e => setNewAsset(p => ({ ...p, asset_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newAsset.asset_type} onChange={e => setNewAsset(p => ({ ...p, asset_type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {['character', 'background', 'icon_set', 'ui_element', 'brand_asset', 'template', 'environment', 'diagram', 'sound_effect', 'music'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Format (e.g. SVG, AE, Blender)" value={newAsset.format} onChange={e => setNewAsset(p => ({ ...p, format: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Notes" value={newAsset.notes} onChange={e => setNewAsset(p => ({ ...p, notes: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, gridColumn: '1 / -1' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createAsset} disabled={!newAsset.project_id} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                  <button onClick={() => setShowNewAsset(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {projects.map(proj => {
              const projAssets = assets.filter(a => a.project_id === proj.id);
              if (projAssets.length === 0) return null;
              return (
                <div key={proj.id} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, color: '#1a0533' }}>{proj.name}</h4>
                    <span style={{ background: TYPE_COLORS[proj.type] || '#6b7280', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {proj.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {projAssets.map(asset => (
                      <div key={asset.id} style={{ background: '#fff', border: `1px solid ${asset.status === 'approved' ? '#86efac' : '#e5e7eb'}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#1a0533', fontSize: 13 }}>{asset.asset_name}</div>
                          <span style={{ background: STATUS_COLORS[asset.status] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{asset.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{asset.asset_type}</span>
                          {asset.format && <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{asset.format}</span>}
                          <span style={{ color: '#6b7280', fontSize: 11 }}>v{asset.version}</span>
                        </div>
                        {asset.notes && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{asset.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB 3: Motion Templates ── */}
        {!loading && activeTab === 3 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a0533' }}>Motion Templates</h3>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                  <option value="">All Categories</option>
                  {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <button onClick={() => setShowNewTemplate(true)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + Add Template
              </button>
            </div>

            {showNewTemplate && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Add Motion Template</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Template Name *" value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newTemplate.category} onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input placeholder="Duration (seconds)" type="number" value={newTemplate.duration_seconds} onChange={e => setNewTemplate(p => ({ ...p, duration_seconds: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Style (e.g. kinetic, minimal, bold)" value={newTemplate.style} onChange={e => setNewTemplate(p => ({ ...p, style: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Tags (comma-separated)" value={newTemplate.tags} onChange={e => setNewTemplate(p => ({ ...p, tags: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, gridColumn: '1 / -1' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createTemplate} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                  <button onClick={() => setShowNewTemplate(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filteredTemplates.map(tmpl => (
                <div key={tmpl.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, color: '#1a0533', fontSize: 15 }}>{tmpl.name}</div>
                    <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: 18 }}>{tmpl.usage_count}x</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{tmpl.category.replace(/_/g, ' ')}</span>
                    <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 10px', borderRadius: 4, fontSize: 12 }}>{tmpl.duration_seconds}s</span>
                    {tmpl.style && <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 10px', borderRadius: 4, fontSize: 12 }}>{tmpl.style}</span>}
                  </div>
                  {tmpl.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {tmpl.tags.map(tag => (
                        <span key={tag} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: '1px 8px', borderRadius: 12, fontSize: 11, color: '#6b7280' }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: Repurposing Studio ── */}
        {!loading && activeTab === 4 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1a0533' }}>Repurposing Studio</h3>
              <button onClick={() => setShowNewRepurpose(true)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + New Repurpose Job
              </button>
            </div>

            {showNewRepurpose && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>New Repurpose Job</h4>
                <div style={{ marginBottom: 12 }}>
                  <input placeholder="Source Video Filename *" value={newRepurpose.source_video} onChange={e => setNewRepurpose(p => ({ ...p, source_video: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Target Formats:</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {REPURPOSE_FORMATS.map(fmt => (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input type="checkbox" checked={newRepurpose.target_formats.includes(fmt)}
                          onChange={e => setNewRepurpose(p => ({
                            ...p,
                            target_formats: e.target.checked ? [...p.target_formats, fmt] : p.target_formats.filter(f => f !== fmt),
                          }))} />
                        {fmt.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={createRepurposeJob} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Create</button>
                  <button onClick={() => setShowNewRepurpose(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {repurpose.map(job => (
                <div key={job.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a0533', fontSize: 15, marginBottom: 4 }}>{job.source_video}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{job.clips_count} target formats · Created {new Date(job.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {statusBadge(job.status)}
                      {job.status !== 'completed' && (
                        <button onClick={() => generateRepurposePlan(job)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                          AI Generate Plan
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(job.target_formats || []).map(fmt => (
                      <span key={fmt} style={{ background: '#ede9fe', color: '#7c3aed', padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                        {fmt.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>

                  {job.output_summary && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 14, fontSize: 13, color: '#166534' }}>
                      {job.output_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* AI Generated Plan Display */}
            {repurposePlan.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginTop: 24 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1a0533', fontWeight: 700 }}>AI Repurposing Plan</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {(repurposePlan as {
                    format: string; title: string; start_time: string; end_time: string;
                    duration: number; platform: string; aspect_ratio: string; optimization: string;
                    subtitles_needed: boolean; caption_suggestion: string;
                  }[]).map((item, i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>{item.format?.replace(/_/g, ' ')}</div>
                      <div style={{ fontWeight: 600, color: '#1a0533', marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        {item.start_time} → {item.end_time} ({item.duration}s) · {item.aspect_ratio}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6, lineHeight: 1.5 }}>{item.optimization}</div>
                      {item.caption_suggestion && (
                        <div style={{ background: '#ede9fe', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#7c3aed', fontStyle: 'italic' }}>
                          {item.caption_suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
