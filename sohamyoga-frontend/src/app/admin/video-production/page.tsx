'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface VideoScript {
  id: string;
  title: string;
  project_type: string;
  duration_target_seconds: number | null;
  word_count: number | null;
  status: string;
  script_body: string | null;
  hook: string | null;
  call_to_action: string | null;
  target_audience: string | null;
  tone: string;
  voice_notes: string | null;
  revision_count: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface StoryboardScene {
  id: string;
  storyboard_id: string;
  scene_number: number;
  shot_type: string | null;
  camera_angle: string | null;
  description: string | null;
  dialogue: string | null;
  action: string | null;
  duration_seconds: number;
  visual_notes: string | null;
  audio_notes: string | null;
}

interface Storyboard {
  id: string;
  script_id: string | null;
  script_title: string | null;
  title: string;
  total_scenes: number;
  status: string;
  created_at: string;
  scenes: StoryboardScene[];
}

interface ProductionPlan {
  id: string;
  title: string;
  script_id: string | null;
  script_title: string | null;
  shoot_date: string | null;
  location: string | null;
  director: string | null;
  crew_json: { role: string; name: string; contact: string }[];
  equipment_json: { item: string; quantity: number; notes: string }[];
  call_sheet_notes: string | null;
  status: string;
  budget_cad: number | null;
  actual_cost_cad: number | null;
  created_at: string;
}

interface AgendaItem {
  time: string;
  topic: string;
  speaker: string;
  duration: number;
}

interface Webinar {
  id: string;
  title: string;
  description: string | null;
  host_name: string | null;
  co_hosts: string[];
  platform: string;
  meeting_url: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  capacity: number | null;
  registration_count: number;
  attendees_count: number;
  recording_url: string | null;
  agenda_json: AgendaItem[];
  status: string;
  follow_up_sent: boolean;
  created_at: string;
}

interface DashboardStats {
  scripts: { total: number; approved: number; in_production: number; draft: number; review: number };
  storyboards: number;
  productions: number;
  webinars: { total: number; upcoming: number; completed: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ['ad', 'explainer', 'webinar', 'tutorial', 'testimonial', 'reel', 'corporate', 'animation'];
const TONES = ['professional', 'warm', 'energetic', 'educational', 'authentic', 'inspirational', 'conversational'];
const SHOT_TYPES: Record<string, string> = {
  close_up: '🎥 Close-up', wide: '🌍 Wide', medium: '👤 Medium',
  over_shoulder: '🎬 Over-shoulder', aerial: '✈️ Aerial', pov: '👁️ POV', cutaway: '🎞️ Cutaway',
};
const CAMERA_ANGLES: Record<string, string> = {
  eye_level: '👁️ Eye Level', low_angle: '⬇️ Low Angle',
  high_angle: '⬆️ High Angle', dutch_tilt: '🎭 Dutch Tilt',
};
const PLATFORMS = ['zoom', 'google_meet', 'teams', 'youtube_live', 'linkedin_live'];
const PLATFORM_ICONS: Record<string, string> = {
  zoom: '📹', google_meet: '🟢', teams: '💼', youtube_live: '▶️', linkedin_live: '🔷',
};
const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', review: '#d97706', approved: '#059669',
  in_production: '#2563eb', planned: '#7c3aed', completed: '#059669',
  cancelled: '#dc2626', planning: '#d97706', confirmed: '#059669', live: '#dc2626',
};

function statusBadge(status: string) {
  return (
    <span style={{
      background: STATUS_COLORS[status] || '#6b7280', color: '#fff',
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize',
    }}>{status.replace(/_/g, ' ')}</span>
  );
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    ad: '#dc2626', explainer: '#7c3aed', webinar: '#2563eb', tutorial: '#0891b2',
    testimonial: '#059669', reel: '#d97706', corporate: '#374151', animation: '#9333ea',
  };
  return (
    <span style={{
      background: colors[type] || '#6b7280', color: '#fff',
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize',
    }}>{type}</span>
  );
}

const WPM = 130;
function wordsToSeconds(wc: number) { return Math.round((wc / WPM) * 60); }
function countWords(text: string) { return text.trim().split(/\s+/).filter(Boolean).length; }

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #333', borderRadius: 12,
        padding: 28, maxWidth: 700, width: '90%', maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Input components ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0f0f1a', border: '1px solid #333', borderRadius: 6,
  color: '#e2e8f0', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 4 };
const btnPrimary: React.CSSProperties = {
  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
  padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: 6,
  padding: '9px 18px', cursor: 'pointer', fontSize: 13,
};
const cardStyle: React.CSSProperties = {
  background: '#12122a', border: '1px solid #2d2d4e', borderRadius: 10, padding: 16,
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function VideoProductionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<VideoScript[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/video-production');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as {
        scripts: VideoScript[];
        storyboards: Storyboard[];
        production_plans: ProductionPlan[];
        webinars: Webinar[];
        stats: DashboardStats;
      };
      setScripts(data.scripts);
      setStoryboards(data.storyboards);
      setPlans(data.production_plans);
      setWebinars(data.webinars);
      setStats(data.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const TABS = ['Dashboard', 'Scriptwriting', 'Storyboarding', 'Production Planning', 'Casting', 'Webinar', 'Livestream', 'Animation'];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e2e8f0', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>🎬 Video Production Suite</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
            Scriptwriting · Storyboarding · Production Planning · Casting · Webinars · Livestreams · Animation
          </p>
        </div>

        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)} style={{
              background: activeTab === i ? '#4f46e5' : '#1e1e38',
              color: activeTab === i ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 6, padding: '8px 16px',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 600 : 400,
            }}>{t}</button>
          ))}
        </div>

        {loading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 60 }}>Loading...</div>}

        {!loading && activeTab === 0 && <DashboardTab stats={stats} scripts={scripts} storyboards={storyboards} plans={plans} webinars={webinars} />}
        {!loading && activeTab === 1 && <ScriptwritingTab scripts={scripts} onRefresh={load} />}
        {!loading && activeTab === 2 && <StoryboardingTab storyboards={storyboards} scripts={scripts} onRefresh={load} />}
        {!loading && activeTab === 3 && <ProductionPlanningTab plans={plans} scripts={scripts} onRefresh={load} />}
        {!loading && activeTab === 4 && <CastingTab />}
        {!loading && activeTab === 5 && <WebinarTab webinars={webinars} onRefresh={load} />}
        {!loading && activeTab === 6 && <LivestreamTab />}
        {!loading && activeTab === 7 && <AnimationTab scripts={scripts} />}
      </div>
    </div>
  );
}

// ── Tab 1: Dashboard ──────────────────────────────────────────────────────────

function DashboardTab({ stats, scripts, storyboards, plans, webinars }: {
  stats: DashboardStats | null;
  scripts: VideoScript[];
  storyboards: Storyboard[];
  plans: ProductionPlan[];
  webinars: Webinar[];
}) {
  const kpis = [
    { label: 'Total Scripts', value: stats?.scripts.total ?? 0, sub: `${stats?.scripts.approved ?? 0} approved`, color: '#4f46e5' },
    { label: 'Storyboards', value: stats?.storyboards ?? 0, sub: 'scene boards', color: '#7c3aed' },
    { label: 'Productions Planned', value: stats?.productions ?? 0, sub: 'shoot plans', color: '#0891b2' },
    { label: 'Webinars Upcoming', value: stats?.webinars.upcoming ?? 0, sub: `${stats?.webinars.completed ?? 0} completed`, color: '#059669' },
    { label: 'In Production', value: stats?.scripts.in_production ?? 0, sub: 'active shoots', color: '#d97706' },
    {
      label: 'Content Planned',
      value: (() => {
        const sec = scripts.reduce((a, s) => a + (s.duration_target_seconds || 0), 0);
        return `${Math.floor(sec / 60)}m`;
      })(),
      sub: 'total video minutes',
      color: '#dc2626',
    },
  ];

  const pipeline = [
    { stage: 'Scriptwriting', count: scripts.filter(s => ['draft', 'review'].includes(s.status)).length, color: '#4f46e5' },
    { stage: 'Storyboarding', count: storyboards.filter(s => s.status === 'draft').length, color: '#7c3aed' },
    { stage: 'Shot Planning', count: storyboards.filter(s => s.status === 'approved').length, color: '#0891b2' },
    { stage: 'Production', count: plans.filter(p => p.status === 'confirmed').length, color: '#d97706' },
    { stage: 'Post-Production', count: scripts.filter(s => s.status === 'in_production').length, color: '#dc2626' },
    { stage: 'Distribution', count: webinars.filter(w => w.status === 'completed').length, color: '#059669' },
  ];

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...cardStyle, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: '4px 0 2px' }}>{k.label}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div style={{ ...cardStyle, marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', fontSize: 15 }}>Production Pipeline</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
          {pipeline.map((p, i) => (
            <div key={p.stage} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '10px 16px', background: p.color + '22', borderRadius: 8, border: `1px solid ${p.color}40` }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: p.color }}>{p.count}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.stage}</div>
              </div>
              {i < pipeline.length - 1 && <span style={{ color: '#4b5563', fontSize: 20, margin: '0 6px' }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Scripts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#e2e8f0' }}>Recent Scripts</h3>
          {scripts.slice(0, 5).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e1e38' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e2e8f0' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{s.duration_target_seconds}s · {s.word_count ?? 0} words</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {typeBadge(s.project_type)}
                {statusBadge(s.status)}
              </div>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#e2e8f0' }}>Upcoming Webinars</h3>
          {webinars.filter(w => w.status === 'planned').slice(0, 4).map(w => (
            <div key={w.id} style={{ padding: '8px 0', borderBottom: '1px solid #1e1e38' }}>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>{w.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {PLATFORM_ICONS[w.platform]} {w.platform} · {w.scheduled_at ? new Date(w.scheduled_at).toLocaleDateString() : 'TBD'} · {w.registration_count} registered
              </div>
            </div>
          ))}
          {webinars.filter(w => w.status === 'planned').length === 0 && (
            <div style={{ color: '#6b7280', fontSize: 13 }}>No upcoming webinars</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Scriptwriting ──────────────────────────────────────────────────────

function ScriptwritingTab({ scripts, onRefresh }: { scripts: VideoScript[]; onRefresh: () => void }) {
  const [selected, setSelected] = useState<VideoScript | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editHook, setEditHook] = useState('');
  const [editCta, setEditCta] = useState('');
  const [editVoice, setEditVoice] = useState('');
  const [newForm, setNewForm] = useState({ title: '', project_type: 'ad', duration_target_seconds: 30, tone: 'professional', target_audience: '', call_to_action: '' });

  function selectScript(s: VideoScript) {
    setSelected(s);
    setEditBody(s.script_body || '');
    setEditHook(s.hook || '');
    setEditCta(s.call_to_action || '');
    setEditVoice(s.voice_notes || '');
  }

  async function saveScript() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/video-production/scripts/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_body: editBody, hook: editHook, call_to_action: editCta, voice_notes: editVoice }),
      });
      await onRefresh();
    } finally { setSaving(false); }
  }

  async function setStatus(status: string) {
    if (!selected) return;
    const body: Record<string, unknown> = { status };
    if (status === 'approved') {
      body.approved_by = 'Admin';
      body.approved_at = new Date().toISOString();
    }
    await fetch(`/api/admin/video-production/scripts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await onRefresh();
  }

  async function createScript() {
    await fetch('/api/admin/video-production/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    });
    setShowNew(false);
    setNewForm({ title: '', project_type: 'ad', duration_target_seconds: 30, tone: 'professional', target_audience: '', call_to_action: '' });
    await onRefresh();
  }

  async function generateWithAI() {
    if (!selected) return;
    setAiLoading(true);
    try {
      const prompt = `Write a ${selected.duration_target_seconds}-second ${selected.project_type} video script for a yoga studio with a ${selected.tone} tone targeting ${selected.target_audience || 'general audience'}. Include a strong hook, compelling main content, and a clear call to action: "${selected.call_to_action || 'Learn more'}". Format: HOOK: ... MAIN CONTENT: ... CALL TO ACTION: ...`;
      const res = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt }),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        setEditBody(data.response || editBody);
      }
    } catch (e) {
      console.error(e);
    } finally { setAiLoading(false); }
  }

  const wc = countWords(editBody);
  const estSec = wordsToSeconds(wc);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
      {/* Script List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Scripts ({scripts.length})</span>
          <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New Script</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scripts.map(s => (
            <div key={s.id} onClick={() => selectScript(s)} style={{
              ...cardStyle, cursor: 'pointer',
              borderColor: selected?.id === s.id ? '#4f46e5' : '#2d2d4e',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {typeBadge(s.project_type)}{statusBadge(s.status)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {s.duration_target_seconds}s · {s.word_count ?? 0} words · Rev {s.revision_count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Script Editor */}
      {selected ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>{selected.title}</h3>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Tone: {selected.tone} · Audience: {selected.target_audience || '—'} · Revisions: {selected.revision_count}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={generateWithAI} disabled={aiLoading} style={{ ...btnSecondary, background: '#312e81' }}>
                {aiLoading ? '⏳ Generating...' : '🤖 AI Generate'}
              </button>
              <button onClick={() => void setStatus('review')} style={{ ...btnSecondary, background: '#92400e' }}>Request Review</button>
              <button onClick={() => void setStatus('approved')} style={{ ...btnSecondary, background: '#065f46' }}>✓ Approve</button>
              <button onClick={() => void saveScript()} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>

          {/* Word count bar */}
          <div style={{ background: '#0f0f1a', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#9ca3af', display: 'flex', gap: 20 }}>
            <span>📝 {wc} words</span>
            <span>⏱️ ~{estSec}s of speech @ {WPM} wpm</span>
            <span>🎯 Target: {selected.duration_target_seconds}s</span>
            {Math.abs(estSec - (selected.duration_target_seconds || 0)) > 10 && (
              <span style={{ color: '#f59e0b' }}>⚠️ {estSec > (selected.duration_target_seconds || 0) ? 'Too long' : 'Too short'}</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Hook (Opening line)</label>
              <textarea value={editHook} onChange={e => setEditHook(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} placeholder="The opening hook..." />
            </div>
            <div>
              <label style={labelStyle}>Call to Action</label>
              <textarea value={editCta} onChange={e => setEditCta(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} placeholder="CTA..." />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Script Body</label>
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Full script text..." />
          </div>

          <div>
            <label style={labelStyle}>Voice Notes (delivery guidance)</label>
            <textarea value={editVoice} onChange={e => setEditVoice(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Pacing, emphasis, tone notes..." />
          </div>

          {selected.approved_by && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#059669' }}>
              ✓ Approved by {selected.approved_by} on {selected.approved_at ? new Date(selected.approved_at).toLocaleDateString() : '—'}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          Select a script to edit
        </div>
      )}

      {showNew && (
        <Modal title="New Script" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Title *</label><input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={newForm.project_type} onChange={e => setNewForm(f => ({ ...f, project_type: e.target.value }))} style={inputStyle}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tone</label>
                <select value={newForm.tone} onChange={e => setNewForm(f => ({ ...f, tone: e.target.value }))} style={inputStyle}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Target Duration (seconds)</label><input type="number" value={newForm.duration_target_seconds} onChange={e => setNewForm(f => ({ ...f, duration_target_seconds: parseInt(e.target.value) }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Target Audience</label><input value={newForm.target_audience} onChange={e => setNewForm(f => ({ ...f, target_audience: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Call to Action</label><input value={newForm.call_to_action} onChange={e => setNewForm(f => ({ ...f, call_to_action: e.target.value }))} style={inputStyle} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowNew(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => void createScript()} disabled={!newForm.title} style={btnPrimary}>Create Script</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 3: Storyboarding ──────────────────────────────────────────────────────

function StoryboardingTab({ storyboards, scripts, onRefresh }: { storyboards: Storyboard[]; scripts: VideoScript[]; onRefresh: () => void }) {
  const [selectedSb, setSelectedSb] = useState<Storyboard | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showAddScene, setShowAddScene] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [newSb, setNewSb] = useState({ title: '', script_id: '' });
  const [newScene, setNewScene] = useState({
    shot_type: 'medium', camera_angle: 'eye_level', description: '',
    dialogue: '', action: '', duration_seconds: 5, visual_notes: '', audio_notes: '',
  });

  async function createStoryboard() {
    await fetch('/api/admin/video-production/storyboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSb),
    });
    setShowNew(false);
    setNewSb({ title: '', script_id: '' });
    await onRefresh();
  }

  async function addScene() {
    if (!selectedSb) return;
    await fetch(`/api/admin/video-production/storyboards/${selectedSb.id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newScene),
    });
    setShowAddScene(false);
    setNewScene({ shot_type: 'medium', camera_angle: 'eye_level', description: '', dialogue: '', action: '', duration_seconds: 5, visual_notes: '', audio_notes: '' });
    await onRefresh();
  }

  async function generateAIStoryboard() {
    if (!selectedSb) return;
    setAiLoading(true);
    try {
      const linked = scripts.find(s => s.id === selectedSb.script_id);
      const prompt = `Generate 4 storyboard scenes for a ${linked?.duration_target_seconds ?? 60}s ${linked?.project_type ?? 'video'} video titled "${selectedSb.title}". For each scene return JSON with fields: shot_type (one of: close_up, wide, medium, over_shoulder, aerial, cutaway), camera_angle (one of: eye_level, low_angle, high_angle, dutch_tilt), description, dialogue, action, duration_seconds, visual_notes, audio_notes. Return as JSON array only.`;
      const res = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt }),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        try {
          const text = data.response || '[]';
          const jsonStart = text.indexOf('[');
          const jsonEnd = text.lastIndexOf(']') + 1;
          const scenes = JSON.parse(text.slice(jsonStart, jsonEnd)) as typeof newScene[];
          for (const scene of scenes) {
            await fetch(`/api/admin/video-production/storyboards/${selectedSb.id}/scenes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scene),
            });
          }
          await onRefresh();
        } catch (e) { console.error('Parse error', e); }
      }
    } finally { setAiLoading(false); }
  }

  function exportStoryboard() {
    if (!selectedSb) return;
    const html = `<!DOCTYPE html><html><head><title>${selectedSb.title}</title>
    <style>
      body{font-family:system-ui;padding:24px;background:#fff}
      h1{font-size:20px;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .scene{border:1px solid #333;border-radius:8px;padding:12px;page-break-inside:avoid}
      .scene-num{font-weight:700;font-size:16px;margin-bottom:8px}
      .badges{display:flex;gap:8px;margin-bottom:8px}
      .badge{background:#eee;border-radius:4px;padding:2px 8px;font-size:12px}
      .field{margin:6px 0;font-size:13px}
      .field b{display:block;font-size:11px;color:#666;margin-bottom:2px}
      .visual-box{height:80px;background:#f5f5f5;border:1px dashed #ccc;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px}
    </style></head><body>
    <h1>STORYBOARD: ${selectedSb.title}</h1>
    <p>Total Scenes: ${selectedSb.total_scenes} | Status: ${selectedSb.status}</p>
    <div class="grid">
    ${selectedSb.scenes.map(sc => `
      <div class="scene">
        <div class="scene-num">Scene ${sc.scene_number}</div>
        <div class="badges">
          <span class="badge">${SHOT_TYPES[sc.shot_type || 'medium'] || sc.shot_type}</span>
          <span class="badge">${CAMERA_ANGLES[sc.camera_angle || 'eye_level'] || sc.camera_angle}</span>
          <span class="badge">${sc.duration_seconds}s</span>
        </div>
        <div class="visual-box">[ Visual Frame ]</div>
        <div class="field"><b>Description</b>${sc.description || '—'}</div>
        <div class="field"><b>Dialogue</b>"${sc.dialogue || '—'}"</div>
        <div class="field"><b>Action</b>${sc.action || '—'}</div>
        <div class="field"><b>Visual Notes</b>${sc.visual_notes || '—'}</div>
        <div class="field"><b>Audio Notes</b>${sc.audio_notes || '—'}</div>
      </div>
    `).join('')}
    </div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
      {/* Sidebar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Storyboards</span>
          <button onClick={() => setShowNew(true)} style={btnPrimary}>+</button>
        </div>
        {storyboards.map(sb => (
          <div key={sb.id} onClick={() => setSelectedSb(sb)} style={{
            ...cardStyle, cursor: 'pointer', marginBottom: 8,
            borderColor: selectedSb?.id === sb.id ? '#4f46e5' : '#2d2d4e',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{sb.title}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{sb.script_title || 'No script linked'} · {sb.total_scenes} scenes</div>
            <div style={{ marginTop: 6 }}>{statusBadge(sb.status)}</div>
          </div>
        ))}
      </div>

      {/* Scene Grid */}
      {selectedSb ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>{selectedSb.title}</h3>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedSb.total_scenes} scenes · {selectedSb.script_title || 'No script linked'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportStoryboard} style={btnSecondary}>🖨️ Export</button>
              <button onClick={() => void generateAIStoryboard()} disabled={aiLoading} style={{ ...btnSecondary, background: '#312e81' }}>
                {aiLoading ? '⏳...' : '🤖 AI Generate'}
              </button>
              <button onClick={() => setShowAddScene(true)} style={btnPrimary}>+ Add Scene</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {selectedSb.scenes.map(sc => (
              <div key={sc.id} style={{ ...cardStyle, borderTop: '3px solid #4f46e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: 16 }}>Scene {sc.scene_number}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{sc.duration_seconds}s</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ background: '#1e1e38', color: '#a78bfa', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                    {SHOT_TYPES[sc.shot_type || 'medium'] || sc.shot_type}
                  </span>
                  <span style={{ background: '#1e1e38', color: '#60a5fa', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                    {CAMERA_ANGLES[sc.camera_angle || 'eye_level'] || sc.camera_angle}
                  </span>
                </div>
                <div style={{ background: '#0f0f1a', height: 60, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: 12, marginBottom: 8 }}>
                  [ Visual Frame ]
                </div>
                {sc.description && <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 4 }}>{sc.description}</div>}
                {sc.dialogue && <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginBottom: 4 }}>"{sc.dialogue}"</div>}
                {sc.visual_notes && <div style={{ fontSize: 11, color: '#6b7280' }}>👁️ {sc.visual_notes}</div>}
                {sc.audio_notes && <div style={{ fontSize: 11, color: '#6b7280' }}>🎵 {sc.audio_notes}</div>}
              </div>
            ))}
            {selectedSb.scenes.length === 0 && (
              <div style={{ ...cardStyle, color: '#6b7280', textAlign: 'center', padding: 40 }}>
                No scenes yet. Add a scene or use AI Generate.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          Select a storyboard
        </div>
      )}

      {showNew && (
        <Modal title="New Storyboard" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Title *</label><input value={newSb.title} onChange={e => setNewSb(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Linked Script</label>
              <select value={newSb.script_id} onChange={e => setNewSb(f => ({ ...f, script_id: e.target.value }))} style={inputStyle}>
                <option value="">— None —</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => void createStoryboard()} disabled={!newSb.title} style={btnPrimary}>Create</button>
            </div>
          </div>
        </Modal>
      )}

      {showAddScene && (
        <Modal title="Add Scene" onClose={() => setShowAddScene(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Shot Type</label>
                <select value={newScene.shot_type} onChange={e => setNewScene(f => ({ ...f, shot_type: e.target.value }))} style={inputStyle}>
                  {Object.entries(SHOT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Camera Angle</label>
                <select value={newScene.camera_angle} onChange={e => setNewScene(f => ({ ...f, camera_angle: e.target.value }))} style={inputStyle}>
                  {Object.entries(CAMERA_ANGLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Duration (seconds)</label><input type="number" value={newScene.duration_seconds} onChange={e => setNewScene(f => ({ ...f, duration_seconds: parseInt(e.target.value) }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Description</label><textarea value={newScene.description} onChange={e => setNewScene(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Dialogue</label><textarea value={newScene.dialogue} onChange={e => setNewScene(f => ({ ...f, dialogue: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Action</label><textarea value={newScene.action} onChange={e => setNewScene(f => ({ ...f, action: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Visual Notes</label><input value={newScene.visual_notes} onChange={e => setNewScene(f => ({ ...f, visual_notes: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Audio Notes</label><input value={newScene.audio_notes} onChange={e => setNewScene(f => ({ ...f, audio_notes: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddScene(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => void addScene()} style={btnPrimary}>Add Scene</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 4: Production Planning ────────────────────────────────────────────────

function ProductionPlanningTab({ plans, scripts, onRefresh }: { plans: ProductionPlan[]; scripts: VideoScript[]; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<ProductionPlan | null>(null);
  const [form, setForm] = useState({
    title: '', script_id: '', shoot_date: '', location: '', director: '',
    budget_cad: '', call_sheet_notes: '',
  });
  const [crew, setCrew] = useState<{ role: string; name: string; contact: string }[]>([]);
  const [equipment, setEquipment] = useState<{ item: string; quantity: number; notes: string }[]>([]);

  async function createPlan() {
    await fetch('/api/admin/video-production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'production_plan',
        ...form,
        crew_json: crew,
        equipment_json: equipment,
        budget_cad: form.budget_cad ? parseFloat(form.budget_cad) : null,
      }),
    });
    setShowNew(false);
    await onRefresh();
  }

  function generateCallSheet(plan: ProductionPlan) {
    const html = `<!DOCTYPE html><html><head><title>Call Sheet</title>
    <style>body{font-family:monospace;padding:32px;max-width:700px;margin:0 auto}
    h2{border-bottom:2px solid #000;padding-bottom:8px}
    .section{margin:16px 0}
    .label{font-weight:bold;min-width:120px;display:inline-block}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    td,th{border:1px solid #333;padding:6px 10px;font-size:13px}
    th{background:#f0f0f0}</style></head><body>
    <pre style="text-align:center;font-size:18px;font-weight:bold">
=============================================
           CALL SHEET
=============================================</pre>
    <div class="section">
      <div><span class="label">Production:</span> ${plan.title}</div>
      <div><span class="label">Date:</span> ${plan.shoot_date ? new Date(plan.shoot_date).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}</div>
      <div><span class="label">Location:</span> ${plan.location || 'TBD'}</div>
      <div><span class="label">Director:</span> ${plan.director || 'TBD'}</div>
      <div><span class="label">Budget:</span> ${plan.budget_cad ? `$${plan.budget_cad.toLocaleString()} CAD` : 'TBD'}</div>
    </div>
    <h2>CREW</h2>
    <table><tr><th>Role</th><th>Name</th><th>Contact</th></tr>
    ${(plan.crew_json || []).map(c => `<tr><td>${c.role}</td><td>${c.name}</td><td>${c.contact}</td></tr>`).join('')}
    </table>
    <h2>EQUIPMENT</h2>
    <table><tr><th>Item</th><th>Qty</th><th>Notes</th></tr>
    ${(plan.equipment_json || []).map(e => `<tr><td>${e.item}</td><td>${e.quantity}</td><td>${e.notes}</td></tr>`).join('')}
    </table>
    <h2>SCHEDULE / NOTES</h2>
    <p>${(plan.call_sheet_notes || 'No notes').replace(/\n/g, '<br>')}</p>
    <pre style="text-align:center">=============================================</pre>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Production Plans ({plans.length})</h3>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New Plan</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }}>
        {plans.map(p => (
          <div key={p.id} style={{ ...cardStyle, cursor: 'pointer', borderColor: selected?.id === p.id ? '#4f46e5' : '#2d2d4e' }}
            onClick={() => setSelected(selected?.id === p.id ? null : p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#e2e8f0' }}>{p.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{p.script_title || 'No script linked'}</div>
              </div>
              {statusBadge(p.status)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div style={{ color: '#9ca3af' }}>📅 {p.shoot_date ? new Date(p.shoot_date).toLocaleDateString() : 'Date TBD'}</div>
              <div style={{ color: '#9ca3af' }}>📍 {p.location || 'Location TBD'}</div>
              <div style={{ color: '#9ca3af' }}>🎬 {p.director || 'Director TBD'}</div>
              <div style={{ color: '#9ca3af' }}>👥 {(p.crew_json || []).length} crew members</div>
            </div>
            {/* Budget */}
            {p.budget_cad !== null && (
              <div style={{ marginTop: 12, background: '#0f0f1a', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Budget Tracker</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#60a5fa' }}>Budget: ${p.budget_cad.toLocaleString()}</span>
                  <span style={{ color: p.actual_cost_cad !== null && p.actual_cost_cad > p.budget_cad ? '#ef4444' : '#34d399' }}>
                    Actual: {p.actual_cost_cad !== null ? `$${p.actual_cost_cad.toLocaleString()}` : '—'}
                  </span>
                </div>
              </div>
            )}
            {selected?.id === p.id && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#9ca3af' }}>Equipment</h4>
                {(p.equipment_json || []).map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#d1d5db', padding: '3px 0' }}>
                    • {e.item} × {e.quantity}{e.notes ? ` — ${e.notes}` : ''}
                  </div>
                ))}
                <button onClick={e => { e.stopPropagation(); generateCallSheet(p); }}
                  style={{ ...btnSecondary, marginTop: 10, fontSize: 12 }}>📄 Generate Call Sheet</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showNew && (
        <Modal title="New Production Plan" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Linked Script</label>
              <select value={form.script_id} onChange={e => setForm(f => ({ ...f, script_id: e.target.value }))} style={inputStyle}>
                <option value="">— None —</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Shoot Date</label><input type="date" value={form.shoot_date} onChange={e => setForm(f => ({ ...f, shoot_date: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Budget (CAD)</label><input type="number" value={form.budget_cad} onChange={e => setForm(f => ({ ...f, budget_cad: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Director</label><input value={form.director} onChange={e => setForm(f => ({ ...f, director: e.target.value }))} style={inputStyle} /></div>

            {/* Crew */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Crew</label>
                <button onClick={() => setCrew(c => [...c, { role: '', name: '', contact: '' }])} style={{ ...btnSecondary, padding: '3px 10px', fontSize: 11 }}>+ Add</button>
              </div>
              {crew.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                  <input placeholder="Role" value={c.role} onChange={e => setCrew(cr => cr.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input placeholder="Name" value={c.name} onChange={e => setCrew(cr => cr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input placeholder="Contact" value={c.contact} onChange={e => setCrew(cr => cr.map((x, j) => j === i ? { ...x, contact: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <button onClick={() => setCrew(cr => cr.filter((_, j) => j !== i))} style={{ ...btnSecondary, padding: '6px 10px', color: '#ef4444' }}>✕</button>
                </div>
              ))}
            </div>

            {/* Equipment */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Equipment</label>
                <button onClick={() => setEquipment(e => [...e, { item: '', quantity: 1, notes: '' }])} style={{ ...btnSecondary, padding: '3px 10px', fontSize: 11 }}>+ Add</button>
              </div>
              {equipment.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 2fr auto', gap: 6, marginBottom: 6 }}>
                  <input placeholder="Item" value={e.item} onChange={ev => setEquipment(eq => eq.map((x, j) => j === i ? { ...x, item: ev.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input type="number" placeholder="Qty" value={e.quantity} onChange={ev => setEquipment(eq => eq.map((x, j) => j === i ? { ...x, quantity: parseInt(ev.target.value) } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input placeholder="Notes" value={e.notes} onChange={ev => setEquipment(eq => eq.map((x, j) => j === i ? { ...x, notes: ev.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <button onClick={() => setEquipment(eq => eq.filter((_, j) => j !== i))} style={{ ...btnSecondary, padding: '6px 10px', color: '#ef4444' }}>✕</button>
                </div>
              ))}
            </div>

            <div><label style={labelStyle}>Call Sheet Notes</label><textarea value={form.call_sheet_notes} onChange={e => setForm(f => ({ ...f, call_sheet_notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => void createPlan()} disabled={!form.title} style={btnPrimary}>Create Plan</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 5: Casting ────────────────────────────────────────────────────────────

interface CastingRole {
  id: string;
  role: string;
  character: string;
  skills: string;
  audition_date: string;
}
interface TalentEntry {
  id: string;
  name: string;
  role: string;
  contact: string;
  portfolio: string;
  status: string;
}

function CastingTab() {
  const [roles, setRoles] = useState<CastingRole[]>([]);
  const [talents, setTalents] = useState<TalentEntry[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [selectedVideoType, setSelectedVideoType] = useState('explainer');
  const [newRole, setNewRole] = useState({ role: '', character: '', skills: '', audition_date: '' });
  const [newTalent, setNewTalent] = useState({ name: '', role: '', contact: '', portfolio: '', status: 'auditioned' });

  async function generateBrief() {
    if (!newRole.role) return;
    setAiLoading(true);
    try {
      const prompt = `Write a professional audition brief for a "${newRole.role}" role in a ${selectedVideoType} video. Include: 1) Character description, 2) Look/feel requirements, 3) Required skills (${newRole.skills || 'acting, on-camera presence'}), 4) Audition instructions. Keep it under 300 words.`;
      const res = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt }),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        setAiResult(data.response || '');
      }
    } finally { setAiLoading(false); }
  }

  function sendAuditionBrief(role: CastingRole) {
    const subject = `Audition Brief: ${role.role}`;
    const body = `Dear Talent,\n\nWe are seeking a ${role.role} for an upcoming video production.\n\nCharacter: ${role.character}\nRequired Skills: ${role.skills}\nAudition Date: ${role.audition_date || 'TBD'}\n\nPlease reply with your showreel/portfolio.\n\nBest regards,\nSoham Yoga Production Team`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const STATUS_OPT = ['auditioned', 'selected', 'backup', 'declined'];
  const STATUS_COLORS_CAST: Record<string, string> = { auditioned: '#d97706', selected: '#059669', backup: '#2563eb', declined: '#dc2626' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Casting Calls */}
      <div>
        <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>Casting Calls</h3>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>New Casting Call</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Role Name</label><input value={newRole.role} onChange={e => setNewRole(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Yoga Instructor" /></div>
              <div><label style={labelStyle}>Video Type</label>
                <select value={selectedVideoType} onChange={e => setSelectedVideoType(e.target.value)} style={inputStyle}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Character Description</label><textarea value={newRole.character} onChange={e => setNewRole(f => ({ ...f, character: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Required Skills</label><input value={newRole.skills} onChange={e => setNewRole(f => ({ ...f, skills: e.target.value }))} style={inputStyle} placeholder="e.g. yoga practice, on-camera experience" /></div>
            <div><label style={labelStyle}>Audition Date</label><input type="date" value={newRole.audition_date} onChange={e => setNewRole(f => ({ ...f, audition_date: e.target.value }))} style={inputStyle} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setRoles(r => [...r, { id: Date.now().toString(), ...newRole }]); setNewRole({ role: '', character: '', skills: '', audition_date: '' }); }} disabled={!newRole.role} style={btnPrimary}>Add Role</button>
              <button onClick={() => void generateBrief()} disabled={!newRole.role || aiLoading} style={{ ...btnSecondary, background: '#312e81' }}>
                {aiLoading ? '⏳...' : '🤖 AI Brief'}
              </button>
            </div>
          </div>
        </div>

        {aiResult && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 8 }}>AI-Generated Audition Brief</div>
            <div style={{ fontSize: 12, color: '#d1d5db', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{aiResult}</div>
          </div>
        )}

        {roles.map(r => (
          <div key={r.id} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.role}</div>
              <button onClick={() => sendAuditionBrief(r)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>📧 Send Brief</button>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{r.character}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Skills: {r.skills} · Audition: {r.audition_date || 'TBD'}</div>
          </div>
        ))}
      </div>

      {/* Talent Tracker */}
      <div>
        <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>Talent Tracker</h3>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>Add Talent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>Name</label><input value={newTalent.name} onChange={e => setNewTalent(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Role</label><input value={newTalent.role} onChange={e => setNewTalent(f => ({ ...f, role: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Contact</label><input value={newTalent.contact} onChange={e => setNewTalent(f => ({ ...f, contact: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Portfolio URL</label><input value={newTalent.portfolio} onChange={e => setNewTalent(f => ({ ...f, portfolio: e.target.value }))} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={newTalent.status} onChange={e => setNewTalent(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {STATUS_OPT.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => { setTalents(t => [...t, { id: Date.now().toString(), ...newTalent }]); setNewTalent({ name: '', role: '', contact: '', portfolio: '', status: 'auditioned' }); }} disabled={!newTalent.name} style={btnPrimary}>Add Talent</button>
          </div>
        </div>

        {talents.map(t => (
          <div key={t.id} style={{ ...cardStyle, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Role: {t.role}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{t.contact}</div>
                {t.portfolio && <a href={t.portfolio} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#60a5fa' }}>Portfolio →</a>}
              </div>
              <div>
                <select value={t.status} onChange={e => setTalents(ta => ta.map(x => x.id === t.id ? { ...x, status: e.target.value } : x))} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', background: STATUS_COLORS_CAST[t.status] + '33', color: STATUS_COLORS_CAST[t.status] }}>
                  {STATUS_OPT.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        {talents.length === 0 && <div style={{ ...cardStyle, color: '#6b7280', textAlign: 'center', padding: 32 }}>No talent added yet</div>}
      </div>
    </div>
  );
}

// ── Tab 6: Webinar Production ─────────────────────────────────────────────────

function WebinarTab({ webinars, onRefresh }: { webinars: Webinar[]; onRefresh: () => void }) {
  const [selected, setSelected] = useState<Webinar | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    'Topic confirmed': false, 'Host briefed': false, 'Tech tested': false,
    'Registration page live': false, 'Reminder emails scheduled': false, 'Recording configured': false,
  });
  const [form, setForm] = useState({
    title: '', description: '', host_name: '', platform: 'zoom',
    scheduled_at: '', duration_minutes: 60, capacity: '',
  });
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  async function createWebinar() {
    await fetch('/api/admin/video-production/webinars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, capacity: form.capacity ? parseInt(form.capacity) : null, agenda_json: agenda }),
    });
    setShowNew(false);
    await onRefresh();
  }

  async function updateWebinar(id: string, updates: Partial<Webinar>) {
    await fetch(`/api/admin/video-production/webinars/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await onRefresh();
  }

  const PLATFORM_LABELS: Record<string, string> = {
    zoom: 'Zoom', google_meet: 'Google Meet', teams: 'Teams',
    youtube_live: 'YouTube Live', linkedin_live: 'LinkedIn Live',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
      {/* Webinar List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Webinars ({webinars.length})</span>
          <button onClick={() => setShowNew(true)} style={btnPrimary}>+</button>
        </div>
        {webinars.map(w => (
          <div key={w.id} onClick={() => setSelected(w)} style={{
            ...cardStyle, cursor: 'pointer', marginBottom: 8,
            borderColor: selected?.id === w.id ? '#4f46e5' : '#2d2d4e',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{w.title}</span>
              {statusBadge(w.status)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {PLATFORM_ICONS[w.platform]} {PLATFORM_LABELS[w.platform]} · {w.scheduled_at ? new Date(w.scheduled_at).toLocaleDateString() : 'TBD'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {w.registration_count} registered · {w.duration_minutes}min
            </div>
          </div>
        ))}
      </div>

      {/* Webinar Detail */}
      {selected ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>{selected.title}</h3>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Host: {selected.host_name} · {PLATFORM_ICONS[selected.platform]} {PLATFORM_LABELS[selected.platform]} · {selected.duration_minutes} min
              </div>
            </div>
            {statusBadge(selected.status)}
          </div>

          {/* Analytics */}
          {selected.status === 'completed' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Registered', value: selected.registration_count, color: '#2563eb' },
                { label: 'Attended', value: selected.attendees_count, color: '#059669' },
                { label: 'Attendance Rate', value: selected.registration_count ? `${Math.round((selected.attendees_count / selected.registration_count) * 100)}%` : '—', color: '#d97706' },
              ].map(m => (
                <div key={m.label} style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Agenda */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 10px', color: '#e2e8f0', fontSize: 14 }}>Agenda</h4>
            {(selected.agenda_json || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #1e1e38', fontSize: 13 }}>
                <span style={{ color: '#4f46e5', minWidth: 70, fontWeight: 600 }}>{item.time}</span>
                <span style={{ color: '#e2e8f0', flex: 1 }}>{item.topic}</span>
                <span style={{ color: '#9ca3af' }}>{item.speaker}</span>
                <span style={{ color: '#6b7280' }}>{item.duration}min</span>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 10px', color: '#e2e8f0', fontSize: 14 }}>Pre-Webinar Checklist</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(checklist).map(([item, done]) => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: done ? '#34d399' : '#9ca3af' }}>
                  <input type="checkbox" checked={done} onChange={e => setChecklist(c => ({ ...c, [item]: e.target.checked }))} />
                  {done ? '✓' : '○'} {item}
                </label>
              ))}
            </div>
          </div>

          {/* Post-webinar */}
          {selected.status === 'completed' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input placeholder="Recording URL" defaultValue={selected.recording_url || ''} style={{ ...inputStyle, flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.follow_up_sent} onChange={e => void updateWebinar(selected.id, { follow_up_sent: e.target.checked })} />
                Follow-up sent
              </label>
            </div>
          )}

          {selected.status === 'planned' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <a href="/admin/event-portals/google-meet" style={{ ...btnSecondary, textDecoration: 'none', fontSize: 12 }}>🔗 Create Meeting Link</a>
              <button onClick={() => void updateWebinar(selected.id, { status: 'live' })} style={{ ...btnPrimary, background: '#dc2626' }}>🔴 Go Live</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          Select a webinar
        </div>
      )}

      {showNew && (
        <Modal title="Create Webinar" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Host Name</label><input value={form.host_name} onChange={e => setForm(f => ({ ...f, host_name: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} style={inputStyle}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Date & Time</label><input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Duration (min)</label><input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Capacity</label><input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} style={inputStyle} /></div>
            </div>

            {/* Agenda builder */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Agenda</label>
                <button onClick={() => setAgenda(a => [...a, { time: '', topic: '', speaker: '', duration: 10 }])} style={{ ...btnSecondary, padding: '3px 10px', fontSize: 11 }}>+ Add Slot</button>
              </div>
              {agenda.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 2fr 1fr 60px auto', gap: 6, marginBottom: 6 }}>
                  <input placeholder="Time" value={item.time} onChange={e => setAgenda(a => a.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input placeholder="Topic" value={item.topic} onChange={e => setAgenda(a => a.map((x, j) => j === i ? { ...x, topic: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input placeholder="Speaker" value={item.speaker} onChange={e => setAgenda(a => a.map((x, j) => j === i ? { ...x, speaker: e.target.value } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input type="number" placeholder="min" value={item.duration} onChange={e => setAgenda(a => a.map((x, j) => j === i ? { ...x, duration: parseInt(e.target.value) } : x))} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <button onClick={() => setAgenda(a => a.filter((_, j) => j !== i))} style={{ ...btnSecondary, padding: '6px 10px', color: '#ef4444' }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => void createWebinar()} disabled={!form.title} style={btnPrimary}>Create Webinar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 7: Livestream Production ──────────────────────────────────────────────

interface StreamEntry {
  id: string;
  platform: string;
  title: string;
  scheduled: string;
  streamKey: string;
  thumbnailReady: boolean;
  status: string;
  vodUrl: string;
  peakViewers: string;
  avgWatch: string;
  duringNotes: string;
}

function LivestreamTab() {
  const STREAM_PLATFORMS = [
    { key: 'youtube', label: 'YouTube Live', icon: '▶️', url: 'https://studio.youtube.com' },
    { key: 'linkedin', label: 'LinkedIn Live', icon: '🔷', url: 'https://www.linkedin.com/video/live' },
    { key: 'instagram', label: 'Instagram Live', icon: '📸', url: 'https://www.instagram.com' },
    { key: 'facebook', label: 'Facebook Live', icon: '📘', url: 'https://www.facebook.com/live/producer' },
    { key: 'twitch', label: 'Twitch', icon: '🟣', url: 'https://dashboard.twitch.tv' },
    { key: 'twitter', label: 'X / Twitter', icon: '🐦', url: 'https://twitter.com' },
  ];

  const CHECKLIST_ITEMS = [
    'Stream key configured',
    'Thumbnail ready',
    'Title + description written',
    'Intro/outro sequences ready',
    'Chat moderation assigned',
    'Backup stream tested',
    'Internet speed tested (>10Mbps upload recommended)',
  ];

  const [streams, setStreams] = useState<StreamEntry[]>([]);
  const [selected, setSelected] = useState<StreamEntry | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map(i => [i, false]))
  );
  const [newStream, setNewStream] = useState({ platform: 'youtube', title: '', scheduled: '' });

  function addStream() {
    const entry: StreamEntry = {
      id: Date.now().toString(),
      platform: newStream.platform,
      title: newStream.title,
      scheduled: newStream.scheduled,
      streamKey: '',
      thumbnailReady: false,
      status: 'scheduled',
      vodUrl: '',
      peakViewers: '',
      avgWatch: '',
      duringNotes: '',
    };
    setStreams(s => [...s, entry]);
    setSelected(entry);
    setNewStream({ platform: 'youtube', title: '', scheduled: '' });
    setChecklist(Object.fromEntries(CHECKLIST_ITEMS.map(i => [i, false])));
  }

  // 7-day calendar view
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
      <div>
        {/* Add stream */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 14px', color: '#e2e8f0', fontSize: 15 }}>Schedule a Livestream</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Platform</label>
              <select value={newStream.platform} onChange={e => setNewStream(f => ({ ...f, platform: e.target.value }))} style={inputStyle}>
                {STREAM_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Stream Title</label><input value={newStream.title} onChange={e => setNewStream(f => ({ ...f, title: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Scheduled</label><input type="datetime-local" value={newStream.scheduled} onChange={e => setNewStream(f => ({ ...f, scheduled: e.target.value }))} style={inputStyle} /></div>
            <button onClick={addStream} disabled={!newStream.title} style={btnPrimary}>Add</button>
          </div>
        </div>

        {/* Selected stream detail */}
        {selected && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#e2e8f0' }}>{selected.title}</h3>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {STREAM_PLATFORMS.find(p => p.key === selected.platform)?.icon} {STREAM_PLATFORMS.find(p => p.key === selected.platform)?.label}
                  {selected.scheduled && ` · ${new Date(selected.scheduled).toLocaleString()}`}
                </div>
              </div>
              <a
                href={STREAM_PLATFORMS.find(p => p.key === selected.platform)?.url}
                target="_blank" rel="noreferrer"
                style={{ ...btnPrimary, background: '#dc2626', textDecoration: 'none', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
              >🔴 Go Live</a>
            </div>

            {/* Pre-live checklist */}
            <h4 style={{ margin: '0 0 10px', color: '#9ca3af', fontSize: 13 }}>Pre-Live Checklist</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {CHECKLIST_ITEMS.map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, color: checklist[item] ? '#34d399' : '#9ca3af' }}>
                  <input type="checkbox" checked={!!checklist[item]} onChange={e => setChecklist(c => ({ ...c, [item]: e.target.checked }))} style={{ marginTop: 2 }} />
                  {checklist[item] ? '✓' : '○'} {item}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} items complete
            </div>

            <h4 style={{ margin: '0 0 8px', color: '#9ca3af', fontSize: 13 }}>During-Live Notes</h4>
            <textarea
              value={selected.duringNotes}
              onChange={e => setSelected(s => s ? { ...s, duringNotes: e.target.value } : s)}
              rows={3} placeholder="Live notes, incidents, timestamps..."
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
            />

            <h4 style={{ margin: '0 0 8px', color: '#9ca3af', fontSize: 13 }}>Post-Live Metrics</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>VOD URL</label><input value={selected.vodUrl} onChange={e => setSelected(s => s ? { ...s, vodUrl: e.target.value } : s)} style={inputStyle} placeholder="https://..." /></div>
              <div><label style={labelStyle}>Peak Viewers</label><input value={selected.peakViewers} onChange={e => setSelected(s => s ? { ...s, peakViewers: e.target.value } : s)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Avg Watch Time</label><input value={selected.avgWatch} onChange={e => setSelected(s => s ? { ...s, avgWatch: e.target.value } : s)} style={inputStyle} placeholder="e.g. 12min" /></div>
            </div>
          </div>
        )}
      </div>

      {/* Right: streams list + 7-day calendar */}
      <div>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', color: '#e2e8f0', fontSize: 14 }}>Streams</h4>
          {streams.length === 0 && <div style={{ color: '#6b7280', fontSize: 13 }}>No streams scheduled</div>}
          {streams.map(s => (
            <div key={s.id} onClick={() => setSelected(s)} style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
              background: selected?.id === s.id ? '#1e1e4a' : '#0f0f1a',
              border: `1px solid ${selected?.id === s.id ? '#4f46e5' : '#2d2d4e'}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                {STREAM_PLATFORMS.find(p => p.key === s.platform)?.icon} {s.title}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{s.scheduled ? new Date(s.scheduled).toLocaleString() : 'TBD'}</div>
            </div>
          ))}
        </div>

        {/* 7-day calendar */}
        <div style={cardStyle}>
          <h4 style={{ margin: '0 0 12px', color: '#e2e8f0', fontSize: 14 }}>7-Day Schedule</h4>
          {days.map(d => {
            const dayStreams = streams.filter(s => s.scheduled && new Date(s.scheduled).toDateString() === d.toDateString());
            return (
              <div key={d.toISOString()} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #1e1e38', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 80, fontSize: 12, color: d.toDateString() === today.toDateString() ? '#4f46e5' : '#6b7280', fontWeight: d.toDateString() === today.toDateString() ? 700 : 400 }}>
                  {d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ flex: 1 }}>
                  {dayStreams.length === 0 && <span style={{ fontSize: 11, color: '#374151' }}>—</span>}
                  {dayStreams.map(s => (
                    <div key={s.id} style={{ fontSize: 11, color: '#a78bfa', background: '#1e1e38', borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginRight: 4 }}>
                      {STREAM_PLATFORMS.find(p => p.key === s.platform)?.icon} {s.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab 8: Explainer & Animation ──────────────────────────────────────────────

function AnimationTab({ scripts }: { scripts: VideoScript[] }) {
  const [brief, setBrief] = useState({
    style: '2d_flat',
    duration: '60',
    voiceover: 'yes',
    music: '',
    brandColors: '#4f46e5,#7c3aed',
    logoUrl: '',
    keyMessage: '',
    scriptId: '',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScript, setAiScript] = useState('');

  const STYLES = [
    { key: '2d_flat', label: '2D Flat', tool: 'Adobe Animate or After Effects', icon: '🎨' },
    { key: '2d_character', label: '2D Character', tool: 'Vyond or Adobe Character Animator', icon: '🧍' },
    { key: 'motion_graphics', label: 'Motion Graphics', tool: 'After Effects + Lottie for web', icon: '✨' },
    { key: 'whiteboard', label: 'Whiteboard', tool: 'VideoScribe or Doodly', icon: '✏️' },
    { key: '3d', label: '3D', tool: 'Blender or Cinema 4D', icon: '📦' },
    { key: 'stop_motion', label: 'Stop Motion', tool: 'Dragonframe or Stop Motion Studio', icon: '📷' },
    { key: 'kinetic_text', label: 'Kinetic Text', tool: 'After Effects or Canva', icon: '💬' },
  ];

  const DURATIONS = ['60', '90', '120', '180', 'custom'];

  async function generateScript() {
    setAiLoading(true);
    try {
      const styleInfo = STYLES.find(s => s.key === brief.style);
      const prompt = `Write an animation script for a ${brief.duration}-second ${styleInfo?.label || brief.style} explainer video for a yoga studio. Key message: "${brief.keyMessage || 'Transform your body and mind through yoga'}". ${brief.voiceover === 'yes' ? 'Include a voiceover script with timing marks.' : 'No voiceover — describe on-screen text instead.'} Format with: [0s-Xs] description of what happens on screen, then voiceover/text. Make it engaging and professional.`;
      const res = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt }),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        setAiScript(data.response || '');
      }
    } finally { setAiLoading(false); }
  }

  function exportBrief() {
    const styleInfo = STYLES.find(s => s.key === brief.style);
    const linkedScript = scripts.find(s => s.id === brief.scriptId);
    const html = `<!DOCTYPE html><html><head><title>Animation Brief</title>
    <style>body{font-family:system-ui;padding:32px;max-width:700px;margin:0 auto}
    h1{font-size:22px;border-bottom:3px solid #4f46e5;padding-bottom:10px}
    h2{font-size:16px;color:#4f46e5;margin-top:24px}
    .field{margin:10px 0;font-size:14px}
    .label{font-weight:bold;display:block;font-size:12px;color:#666;margin-bottom:3px}
    .pill{display:inline-block;background:#e0e7ff;color:#312e81;border-radius:4px;padding:3px 10px;font-size:12px;margin:2px}
    .script-box{background:#f5f5f5;border-left:3px solid #4f46e5;padding:16px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.7;white-space:pre-wrap}
    </style></head><body>
    <h1>${styleInfo?.icon} Animation Brief</h1>
    <p style="color:#666;font-size:13px">Generated: ${new Date().toLocaleDateString()}</p>
    <h2>Production Details</h2>
    <div class="field"><span class="label">Animation Style</span><span class="pill">${styleInfo?.icon} ${styleInfo?.label}</span></div>
    <div class="field"><span class="label">Recommended Tool</span>${styleInfo?.tool}</div>
    <div class="field"><span class="label">Duration</span>${brief.duration}s</div>
    <div class="field"><span class="label">Voiceover</span>${brief.voiceover === 'yes' ? 'Yes — link to ElevenLabs for AI voice' : 'No voiceover'}</div>
    <div class="field"><span class="label">Music</span>${brief.music || 'To be sourced from asset library'}</div>
    <h2>Brand</h2>
    <div class="field"><span class="label">Colors</span>${brief.brandColors}</div>
    <div class="field"><span class="label">Logo URL</span>${brief.logoUrl || 'To be provided'}</div>
    <h2>Message & Script</h2>
    <div class="field"><span class="label">Key Message</span>${brief.keyMessage || '—'}</div>
    ${linkedScript ? `<div class="field"><span class="label">Linked Script</span>${linkedScript.title}</div>` : ''}
    ${aiScript ? `<h2>Animation Script</h2><div class="script-box">${aiScript.replace(/</g, '&lt;')}</div>` : ''}
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const selectedStyle = STYLES.find(s => s.key === brief.style);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
      {/* Brief Builder */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 20px', color: '#e2e8f0' }}>Animation Brief Builder</h3>

        {/* Style picker */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Animation Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
            {STYLES.map(s => (
              <div key={s.key} onClick={() => setBrief(b => ({ ...b, style: s.key }))} style={{
                padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                background: brief.style === s.key ? '#1e1e4a' : '#0f0f1a',
                border: `1px solid ${brief.style === s.key ? '#4f46e5' : '#2d2d4e'}`,
              }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontSize: 12, color: brief.style === s.key ? '#a78bfa' : '#9ca3af', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {selectedStyle && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#60a5fa' }}>
              🛠️ Recommended tool: <strong>{selectedStyle.tool}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Duration</label>
            <select value={brief.duration} onChange={e => setBrief(b => ({ ...b, duration: e.target.value }))} style={inputStyle}>
              {DURATIONS.map(d => <option key={d} value={d}>{d === 'custom' ? 'Custom' : `${d}s`}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Voiceover</label>
            <select value={brief.voiceover} onChange={e => setBrief(b => ({ ...b, voiceover: e.target.value }))} style={inputStyle}>
              <option value="yes">Yes (ElevenLabs)</option>
              <option value="no">No voiceover</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Linked Script</label>
            <select value={brief.scriptId} onChange={e => setBrief(b => ({ ...b, scriptId: e.target.value }))} style={inputStyle}>
              <option value="">— None —</option>
              {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><label style={labelStyle}>Brand Colors (hex, comma-separated)</label><input value={brief.brandColors} onChange={e => setBrief(b => ({ ...b, brandColors: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Logo URL</label><input value={brief.logoUrl} onChange={e => setBrief(b => ({ ...b, logoUrl: e.target.value }))} style={inputStyle} /></div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Key Message (1 sentence)</label>
          <input value={brief.keyMessage} onChange={e => setBrief(b => ({ ...b, keyMessage: e.target.value }))} style={inputStyle} placeholder="e.g. Transform your mind and body through daily yoga practice" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Background Music</label>
          <input value={brief.music} onChange={e => setBrief(b => ({ ...b, music: e.target.value }))} style={inputStyle} placeholder="Track name from asset library, or URL" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => void generateScript()} disabled={aiLoading} style={{ ...btnPrimary, background: '#312e81', flex: 1 }}>
            {aiLoading ? '⏳ Generating...' : '🤖 Generate Animation Script'}
          </button>
          <button onClick={exportBrief} style={{ ...btnSecondary, flex: 1 }}>📄 Export Brief</button>
        </div>
      </div>

      {/* Right side: tool guide + AI output */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <h4 style={{ margin: '0 0 12px', color: '#e2e8f0', fontSize: 14 }}>Tool Recommendations</h4>
          {STYLES.map(s => (
            <div key={s.key} style={{ padding: '8px 0', borderBottom: '1px solid #1e1e38', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: brief.style === s.key ? '#a78bfa' : '#e2e8f0' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{s.tool}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            💡 Budget tip: Canva Presentations for basic, Vyond for character animation
          </div>
        </div>

        {aiScript && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', marginBottom: 10 }}>🤖 AI Animation Script</div>
            <pre style={{ fontSize: 12, color: '#d1d5db', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'inherit', margin: 0 }}>
              {aiScript}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
