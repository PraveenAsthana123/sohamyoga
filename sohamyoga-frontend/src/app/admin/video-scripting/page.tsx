'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VsScript {
  id: number;
  project_name: string;
  video_type: string;
  duration_seconds: number;
  target_audience: string | null;
  key_message: string | null;
  script_text: string | null;
  status: string;
  version: number;
  created_at: string;
}

interface StoryboardScene {
  scene: number;
  shot_type: string;
  description: string;
  dialogue: string;
  duration_sec: number;
  visual_notes: string;
}

interface VsStoryboard {
  id: number;
  script_id: number;
  title: string;
  scenes: StoryboardScene[];
  status: string;
  created_at: string;
}

interface ShotItem {
  shot_no: number;
  scene: number;
  type: string;
  angle: string;
  lens: string;
  duration: number;
  notes: string;
}

interface VsShotPlan {
  id: number;
  project_name: string;
  shots: ShotItem[];
  total_shots: number;
  estimated_hours: number;
  created_at: string;
}

interface VsLocation {
  id: number;
  project_name: string;
  location_name: string;
  address: string | null;
  type: string | null;
  availability: string[];
  cost_per_day: number;
  notes: string | null;
  approved: boolean;
  created_at: string;
}

interface VsCastMember {
  id: number;
  project_name: string;
  role: string;
  name: string;
  type: string;
  rate_per_day: number;
  availability: string[];
  notes: string | null;
  confirmed: boolean;
  created_at: string;
}

interface DashboardStats {
  total_scripts: number;
  approved: number;
  in_review: number;
  draft: number;
  total_storyboards: number;
  total_locations: number;
  approved_locations: number;
  total_cast: number;
  confirmed_cast: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VIDEO_TYPES = ['brand', 'tutorial', 'ad', 'sales', 'explainer', 'testimonial', 'reel', 'corporate', 'animation', 'documentary'];
const SHOT_TYPES = ['wide', 'medium', 'close_up', 'cutaway', 'aerial', 'pov', 'over_shoulder'];
const CAST_TYPES = ['actor', 'instructor', 'extra', 'vo', 'model', 'presenter'];

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', in_review: '#d97706', approved: '#059669',
  in_production: '#2563eb', completed: '#7c3aed', cancelled: '#dc2626',
};

const TYPE_COLORS: Record<string, string> = {
  brand: '#7c3aed', tutorial: '#0891b2', ad: '#dc2626', sales: '#d97706',
  explainer: '#2563eb', testimonial: '#059669', reel: '#f59e0b', corporate: '#374151',
  animation: '#9333ea', documentary: '#065f46',
};

function statusBadge(status: string) {
  return (
    <span style={{
      background: STATUS_COLORS[status] || '#6b7280', color: '#fff',
      padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
    }}>{status.replace(/_/g, ' ')}</span>
  );
}

function typeBadge(type: string) {
  return (
    <span style={{
      background: TYPE_COLORS[type] || '#6b7280', color: '#fff',
      padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
    }}>{type}</span>
  );
}

function StatCard({ label, value, color = '#2563eb' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 22px', minWidth: 120 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ['Dashboard', 'Script Editor', 'Storyboard Builder', 'Shot Planner', 'Location Scouting', 'Casting'];

export default function VideoScriptingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [scripts, setScripts] = useState<VsScript[]>([]);
  const [storyboards, setStoryboards] = useState<VsStoryboard[]>([]);
  const [locations, setLocations] = useState<VsLocation[]>([]);
  const [cast, setCast] = useState<VsCastMember[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScript, setSelectedScript] = useState<VsScript | null>(null);
  const [shotPlans, setShotPlans] = useState<VsShotPlan[]>([]);
  const [aiStatus, setAiStatus] = useState('');
  const [newScriptForm, setNewScriptForm] = useState({ project_name: '', video_type: 'brand', duration_seconds: 60, target_audience: '', key_message: '' });
  const [showNewScript, setShowNewScript] = useState(false);
  const [newLocation, setNewLocation] = useState({ project_name: '', location_name: '', address: '', type: 'indoor', cost_per_day: 0, notes: '' });
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newCast, setNewCast] = useState({ project_name: '', role: '', name: '', type: 'actor', rate_per_day: 0, notes: '' });
  const [showNewCast, setShowNewCast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/video-scripting');
      const data = await res.json();
      setScripts(data.scripts || []);
      setStoryboards(data.storyboards || []);
      setLocations(data.locations || []);
      setCast(data.cast || []);
      setStats(data.stats || null);
      if (data.scripts?.length > 0 && !selectedScript) setSelectedScript(data.scripts[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedScript]);

  useEffect(() => { load(); }, []);

  async function loadShots(script: VsScript) {
    const res = await fetch(`/api/admin/video-scripting/${script.id}/shots`);
    const data = await res.json();
    setShotPlans(data.shots || []);
  }

  async function selectScript(s: VsScript) {
    setSelectedScript(s);
    await loadShots(s);
  }

  async function generateScript() {
    if (!selectedScript) return;
    setAiStatus('Generating script with AI...');
    try {
      const res = await fetch(`/api/admin/video-scripting/${selectedScript.id}/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.script_text) {
        setSelectedScript(prev => prev ? { ...prev, script_text: data.script_text, status: 'in_review' } : null);
        setAiStatus('Script generated successfully.');
        await load();
      }
    } catch {
      setAiStatus('AI generation failed. Please try again.');
    }
    setTimeout(() => setAiStatus(''), 4000);
  }

  async function generateStoryboard() {
    if (!selectedScript) return;
    setAiStatus('Generating storyboard with AI...');
    try {
      const res = await fetch(`/api/admin/video-scripting/${selectedScript.id}/storyboard`, { method: 'POST' });
      const data = await res.json();
      if (data.storyboard) {
        setAiStatus('Storyboard generated successfully.');
        await load();
      }
    } catch {
      setAiStatus('Storyboard generation failed.');
    }
    setTimeout(() => setAiStatus(''), 4000);
  }

  async function saveScriptText() {
    if (!selectedScript) return;
    const res = await fetch(`/api/admin/video-scripting/${selectedScript.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_text: selectedScript.script_text }),
    });
    if (res.ok) { setAiStatus('Saved.'); await load(); setTimeout(() => setAiStatus(''), 2000); }
  }

  async function createScript() {
    const res = await fetch('/api/admin/video-scripting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newScriptForm),
    });
    if (res.ok) {
      setShowNewScript(false);
      setNewScriptForm({ project_name: '', video_type: 'brand', duration_seconds: 60, target_audience: '', key_message: '' });
      await load();
    }
  }

  async function createLocation() {
    const res = await fetch('/api/admin/video-scripting/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLocation),
    });
    if (res.ok) {
      setShowNewLocation(false);
      setNewLocation({ project_name: '', location_name: '', address: '', type: 'indoor', cost_per_day: 0, notes: '' });
      await load();
    }
  }

  async function createCast() {
    const res = await fetch('/api/admin/video-scripting/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCast),
    });
    if (res.ok) {
      setShowNewCast(false);
      setNewCast({ project_name: '', role: '', name: '', type: 'actor', rate_per_day: 0, notes: '' });
      await load();
    }
  }

  const selectedStoryboards = storyboards.filter(b => b.script_id === selectedScript?.id);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1e1b4b', color: '#fff', padding: '20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Video Scripting Studio</div>
        <div style={{ fontSize: 13, color: '#a5b4fc', marginTop: 4 }}>Scriptwriting · Storyboarding · Shot Planning · Location · Casting · AI Generation</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0, padding: '0 32px' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: activeTab === i ? 700 : 500, fontSize: 14,
            color: activeTab === i ? '#1e1b4b' : '#6b7280',
            borderBottom: activeTab === i ? '3px solid #1e1b4b' : '3px solid transparent',
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ padding: '28px 32px' }}>
        {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>Loading...</div>}
        {aiStatus && (
          <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#1d4ed8', fontWeight: 600 }}>
            {aiStatus}
          </div>
        )}

        {/* ── TAB 0: Dashboard ── */}
        {!loading && activeTab === 0 && (
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
              <StatCard label="Total Scripts" value={stats?.total_scripts || 0} color="#1e1b4b" />
              <StatCard label="Approved" value={stats?.approved || 0} color="#059669" />
              <StatCard label="In Review" value={stats?.in_review || 0} color="#d97706" />
              <StatCard label="Draft" value={stats?.draft || 0} color="#6b7280" />
              <StatCard label="Storyboards" value={stats?.total_storyboards || 0} color="#7c3aed" />
              <StatCard label="Locations" value={stats?.total_locations || 0} color="#0891b2" />
              <StatCard label="Cast Members" value={stats?.total_cast || 0} color="#d97706" />
              <StatCard label="Confirmed Cast" value={stats?.confirmed_cast || 0} color="#059669" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#1e1b4b' }}>All Script Projects</h3>
              <button onClick={() => setShowNewScript(true)} style={{
                background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700,
              }}>+ New Script Project</button>
            </div>

            {showNewScript && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>New Script Project</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Project Name *" value={newScriptForm.project_name} onChange={e => setNewScriptForm(p => ({ ...p, project_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newScriptForm.video_type} onChange={e => setNewScriptForm(p => ({ ...p, video_type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {VIDEO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Duration (seconds)" type="number" value={newScriptForm.duration_seconds} onChange={e => setNewScriptForm(p => ({ ...p, duration_seconds: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Target Audience" value={newScriptForm.target_audience} onChange={e => setNewScriptForm(p => ({ ...p, target_audience: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Key Message" value={newScriptForm.key_message} onChange={e => setNewScriptForm(p => ({ ...p, key_message: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, gridColumn: '1 / -1' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createScript} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Create</button>
                  <button onClick={() => setShowNewScript(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Project', 'Type', 'Duration', 'Target Audience', 'Status', 'Version', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scripts.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1e1b4b' }}>{s.project_name}</td>
                      <td style={{ padding: '14px 16px' }}>{typeBadge(s.video_type)}</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>{s.duration_seconds}s</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 13 }}>{s.target_audience || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>{statusBadge(s.status)}</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>v{s.version}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={() => { selectScript(s); setActiveTab(1); }} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 1: Script Editor ── */}
        {!loading && activeTab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: 12, fontSize: 14 }}>Scripts</div>
              {scripts.map(s => (
                <div key={s.id} onClick={() => selectScript(s)} style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                  background: selectedScript?.id === s.id ? '#ede9fe' : '#fff',
                  border: `1px solid ${selectedScript?.id === s.id ? '#7c3aed' : '#e5e7eb'}`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e1b4b' }}>{s.project_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', gap: 8 }}>
                    {typeBadge(s.video_type)} {statusBadge(s.status)}
                  </div>
                </div>
              ))}
            </div>

            {selectedScript && (
              <div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', color: '#1e1b4b' }}>{selectedScript.project_name}</h3>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        {selectedScript.video_type} · {selectedScript.duration_seconds}s · v{selectedScript.version}
                        {selectedScript.target_audience && ` · Audience: ${selectedScript.target_audience}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={generateScript} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700 }}>
                        AI Generate
                      </button>
                      <button onClick={saveScriptText} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700 }}>
                        Save
                      </button>
                    </div>
                  </div>

                  {selectedScript.key_message && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                      Key Message: {selectedScript.key_message}
                    </div>
                  )}

                  <textarea
                    value={selectedScript.script_text || ''}
                    onChange={e => setSelectedScript(prev => prev ? { ...prev, script_text: e.target.value } : null)}
                    placeholder="Script text will appear here. Click AI Generate to create automatically, or type manually..."
                    style={{ width: '100%', minHeight: 400, padding: 16, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>

                {selectedScript.script_text && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: '#166534', marginBottom: 8 }}>Script Stats</div>
                    <div style={{ fontSize: 13, color: '#166534' }}>
                      Words: {selectedScript.script_text.trim().split(/\s+/).length} ·
                      Est. duration: {Math.round(selectedScript.script_text.trim().split(/\s+/).length / 130 * 60)}s ·
                      Target: {selectedScript.duration_seconds}s
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Storyboard Builder ── */}
        {!loading && activeTab === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e1b4b' }}>Storyboard Builder</h3>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Select a script, then generate or view its storyboard scenes</div>
              </div>
              {selectedScript && (
                <button onClick={generateStoryboard} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                  AI Generate Storyboard
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              {scripts.map(s => (
                <button key={s.id} onClick={() => selectScript(s)} style={{
                  padding: '8px 16px', borderRadius: 8, border: `2px solid ${selectedScript?.id === s.id ? '#7c3aed' : '#e5e7eb'}`,
                  background: selectedScript?.id === s.id ? '#ede9fe' : '#fff', cursor: 'pointer', fontWeight: selectedScript?.id === s.id ? 700 : 500,
                  color: selectedScript?.id === s.id ? '#7c3aed' : '#374151',
                }}>{s.project_name}</button>
              ))}
            </div>

            {selectedStoryboards.length === 0 && selectedScript && (
              <div style={{ background: '#fff', border: '2px dashed #d1d5db', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                No storyboard for {selectedScript.project_name} yet. Click AI Generate Storyboard to create one.
              </div>
            )}

            {selectedStoryboards.map(board => (
              <div key={board.id} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, color: '#1e1b4b' }}>{board.title}</h4>
                  {statusBadge(board.status)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {(board.scenes || []).map((scene, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: '#1e1b4b', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>Scene {scene.scene}</span>
                        <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 4 }}>{scene.shot_type}</span>
                      </div>
                      <div style={{ padding: 14 }}>
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>{scene.description}</div>
                        {scene.dialogue && (
                          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#0369a1', fontStyle: 'italic', marginBottom: 8 }}>
                            "{scene.dialogue}"
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{scene.visual_notes}</div>
                        <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Duration: {scene.duration_sec}s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 3: Shot Planner ── */}
        {!loading && activeTab === 3 && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              {scripts.map(s => (
                <button key={s.id} onClick={() => selectScript(s)} style={{
                  padding: '8px 16px', borderRadius: 8, border: `2px solid ${selectedScript?.id === s.id ? '#1e1b4b' : '#e5e7eb'}`,
                  background: selectedScript?.id === s.id ? '#1e1b4b' : '#fff',
                  color: selectedScript?.id === s.id ? '#fff' : '#374151',
                  cursor: 'pointer', fontWeight: 600,
                }}>{s.project_name}</button>
              ))}
            </div>

            {shotPlans.length === 0 ? (
              <div style={{ background: '#fff', border: '2px dashed #d1d5db', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                No shot plan yet for {selectedScript?.project_name || 'selected project'}.
              </div>
            ) : (
              shotPlans.map(plan => (
                <div key={plan.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                  <div style={{ background: '#f8fafc', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 700, color: '#1e1b4b' }}>Shot Plan: {plan.project_name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{plan.total_shots} shots · {plan.estimated_hours}h estimated</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Shot #', 'Scene', 'Type', 'Angle', 'Lens', 'Duration', 'Notes'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.shots || []).map((shot, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e1b4b' }}>#{shot.shot_no}</td>
                          <td style={{ padding: '12px 16px', color: '#6b7280' }}>Scene {shot.scene}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{shot.type}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{shot.angle}</td>
                          <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{shot.lens}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e1b4b' }}>{shot.duration}s</td>
                          <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{shot.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 4: Location Scouting ── */}
        {!loading && activeTab === 4 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, color: '#1e1b4b' }}>Location Scouting</h3>
              <button onClick={() => setShowNewLocation(true)} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + Add Location
              </button>
            </div>

            {showNewLocation && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Add Location</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Project Name *" value={newLocation.project_name} onChange={e => setNewLocation(p => ({ ...p, project_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Location Name *" value={newLocation.location_name} onChange={e => setNewLocation(p => ({ ...p, location_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Address" value={newLocation.address} onChange={e => setNewLocation(p => ({ ...p, address: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newLocation.type} onChange={e => setNewLocation(p => ({ ...p, type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {['indoor', 'outdoor', 'studio', 'corporate', 'residential'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Cost per day ($)" type="number" value={newLocation.cost_per_day} onChange={e => setNewLocation(p => ({ ...p, cost_per_day: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Notes" value={newLocation.notes} onChange={e => setNewLocation(p => ({ ...p, notes: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createLocation} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                  <button onClick={() => setShowNewLocation(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {locations.map(loc => (
                <div key={loc.id} style={{ background: '#fff', border: `2px solid ${loc.approved ? '#86efac' : '#e5e7eb'}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: 15 }}>{loc.location_name}</div>
                    <span style={{ background: loc.approved ? '#dcfce7' : '#fef3c7', color: loc.approved ? '#166534' : '#92400e', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                      {loc.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Project: {loc.project_name}</div>
                  {loc.address && <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{loc.address}</div>}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#374151' }}>{loc.type}</span>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#374151' }}>
                      {loc.cost_per_day > 0 ? `$${loc.cost_per_day}/day` : 'Free'}
                    </span>
                  </div>
                  {loc.notes && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{loc.notes}</div>}
                  {loc.availability?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#2563eb' }}>Avail: {loc.availability.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: Casting ── */}
        {!loading && activeTab === 5 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, color: '#1e1b4b' }}>Casting</h3>
              <button onClick={() => setShowNewCast(true)} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + Add Cast Member
              </button>
            </div>

            {showNewCast && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Add Cast Member</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Project Name *" value={newCast.project_name} onChange={e => setNewCast(p => ({ ...p, project_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Role *" value={newCast.role} onChange={e => setNewCast(p => ({ ...p, role: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Name *" value={newCast.name} onChange={e => setNewCast(p => ({ ...p, name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newCast.type} onChange={e => setNewCast(p => ({ ...p, type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {CAST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Rate per day ($)" type="number" value={newCast.rate_per_day} onChange={e => setNewCast(p => ({ ...p, rate_per_day: +e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Notes" value={newCast.notes} onChange={e => setNewCast(p => ({ ...p, notes: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createCast} style={{ background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                  <button onClick={() => setShowNewCast(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Name', 'Role', 'Type', 'Project', 'Rate/Day', 'Availability', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cast.map(member => (
                    <tr key={member.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e1b4b' }}>{member.name}</td>
                      <td style={{ padding: '14px 16px', color: '#374151' }}>{member.role}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{member.type}</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 13 }}>{member.project_name}</td>
                      <td style={{ padding: '14px 16px', color: '#374151' }}>{member.rate_per_day > 0 ? `$${member.rate_per_day}` : 'Free'}</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 12 }}>{member.availability?.join(', ') || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: member.confirmed ? '#dcfce7' : '#fef3c7', color: member.confirmed ? '#166534' : '#92400e', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                          {member.confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
