'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PpJob {
  id: number;
  project_name: string;
  video_filename: string | null;
  type: string;
  status: string;
  settings: Record<string, unknown>;
  output_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
}

interface SubtitleTrack {
  id: number;
  project_name: string;
  language: string;
  format: string;
  content: string | null;
  auto_generated: boolean;
  status: string;
  word_count: number;
  created_at: string;
}

interface DubbingJob {
  id: number;
  project_name: string;
  source_language: string;
  target_language: string;
  voice_style: string;
  status: string;
  estimated_minutes: number;
  created_at: string;
}

interface ThumbnailAsset {
  id: number;
  project_name: string;
  style: string | null;
  prompt: string | null;
  platform: string;
  ctr_score: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ClipExtraction {
  id: number;
  project_name: string;
  source_file: string | null;
  clips: { clip_no: number; start: string; end: string; duration: number; format: string; title: string; platform: string }[];
  total_clips: number;
  purpose: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  queued: number;
  in_progress: number;
  review: number;
  completed: number;
  subtitle_tracks: number;
  dubbing_jobs: number;
  thumbnail_assets: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const JOB_TYPES = ['color_correction', 'color_grading', 'audio_editing', 'subtitle_creation', 'ai_dubbing', 'thumbnail_generation', 'clip_extraction'];
const STATUS_COLUMNS = ['queued', 'in_progress', 'review', 'completed'];

const STATUS_COLORS: Record<string, string> = {
  queued: '#6b7280', in_progress: '#2563eb', review: '#d97706', completed: '#059669',
};

const TYPE_COLORS: Record<string, string> = {
  color_correction: '#7c3aed', color_grading: '#9333ea', audio_editing: '#0891b2',
  subtitle_creation: '#059669', ai_dubbing: '#2563eb', thumbnail_generation: '#d97706', clip_extraction: '#dc2626',
};

function statusBadge(status: string) {
  return (
    <span style={{ background: STATUS_COLORS[status] || '#6b7280', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function typeBadge(type: string) {
  return (
    <span style={{ background: TYPE_COLORS[type] || '#6b7280', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ label, value, color = '#2563eb' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 22px', minWidth: 110 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const TABS = ['Post-Production Queue', 'Color Suite', 'Audio Suite', 'Subtitles & Captions', 'Translation & Dubbing', 'Thumbnail Studio'];

export default function VideoPostProductionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [jobs, setJobs] = useState<PpJob[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [dubbing, setDubbing] = useState<DubbingJob[]>([]);
  const [thumbnails, setThumbnails] = useState<ThumbnailAsset[]>([]);
  const [clips, setClips] = useState<ClipExtraction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState('');
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [thumbnailTopic, setThumbnailTopic] = useState('');
  const [thumbnailProject, setThumbnailProject] = useState('');
  const [thumbnailPlatform, setThumbnailPlatform] = useState('youtube');
  const [newJobForm, setNewJobForm] = useState({ project_name: '', type: 'color_correction', video_filename: '', assigned_to: '' });
  const [showNewJob, setShowNewJob] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/video-post-production');
      const data = await res.json();
      setJobs(data.jobs || []);
      setSubtitles(data.subtitles || []);
      setDubbing(data.dubbing || []);
      setThumbnails(data.thumbnails || []);
      setClips(data.clips || []);
      setStats(data.stats || null);
      if (data.subtitles?.length > 0 && !selectedSubtitle) setSelectedSubtitle(data.subtitles[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedSubtitle]);

  useEffect(() => { load(); }, []);

  async function updateJobStatus(id: number, status: string) {
    await fetch(`/api/admin/video-post-production/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function completeJob(id: number) {
    await fetch(`/api/admin/video-post-production/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_notes: 'Completed via admin dashboard.' }),
    });
    await load();
  }

  async function generateSubtitles(subtitle: SubtitleTrack) {
    setAiStatus('Generating subtitles with AI...');
    try {
      const res = await fetch('/api/admin/video-post-production/subtitles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: subtitle.project_name, video_description: subtitle.project_name, language: subtitle.language }),
      });
      if (res.ok) { setAiStatus('Subtitles generated.'); await load(); }
    } catch { setAiStatus('Generation failed.'); }
    setTimeout(() => setAiStatus(''), 4000);
  }

  async function translateDubbing(dub: DubbingJob) {
    setAiStatus(`Translating to ${dub.target_language}...`);
    const srcTrack = subtitles.find(s => s.project_name === dub.project_name && s.language === dub.source_language);
    try {
      const res = await fetch(`/api/admin/video-post-production/dubbing/${dub.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_content: srcTrack?.content || '' }),
      });
      if (res.ok) { setAiStatus('Translation complete. Subtitle track created.'); await load(); }
    } catch { setAiStatus('Translation failed.'); }
    setTimeout(() => setAiStatus(''), 4000);
  }

  async function generateThumbnails() {
    if (!thumbnailProject || !thumbnailTopic) { setAiStatus('Please fill project name and video topic.'); return; }
    setAiStatus('Generating 3 thumbnail concepts with AI...');
    try {
      const res = await fetch('/api/admin/video-post-production/thumbnails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: thumbnailProject, video_topic: thumbnailTopic, platform: thumbnailPlatform }),
      });
      if (res.ok) { setAiStatus('3 thumbnail concepts generated.'); await load(); }
    } catch { setAiStatus('Thumbnail generation failed.'); }
    setTimeout(() => setAiStatus(''), 5000);
  }

  async function createJob() {
    const res = await fetch('/api/admin/video-post-production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJobForm),
    });
    if (res.ok) { setShowNewJob(false); setNewJobForm({ project_name: '', type: 'color_correction', video_filename: '', assigned_to: '' }); await load(); }
  }

  const colorJobs = jobs.filter(j => ['color_correction', 'color_grading'].includes(j.type));
  const audioJobs = jobs.filter(j => j.type === 'audio_editing');

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Video Post-Production</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Color · Audio · Subtitles · AI Captioning · Translation & Dubbing · Thumbnail Studio · Clip Extraction</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0, padding: '0 32px', overflowX: 'auto' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontWeight: activeTab === i ? 700 : 500, fontSize: 14,
            color: activeTab === i ? '#0f172a' : '#6b7280',
            borderBottom: activeTab === i ? '3px solid #0f172a' : '3px solid transparent',
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

        {/* ── TAB 0: Post-Production Queue (Kanban) ── */}
        {!loading && activeTab === 0 && (
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
              <StatCard label="Total Jobs" value={stats?.total || 0} color="#0f172a" />
              <StatCard label="Queued" value={stats?.queued || 0} color="#6b7280" />
              <StatCard label="In Progress" value={stats?.in_progress || 0} color="#2563eb" />
              <StatCard label="In Review" value={stats?.review || 0} color="#d97706" />
              <StatCard label="Completed" value={stats?.completed || 0} color="#059669" />
              <StatCard label="Subtitle Tracks" value={stats?.subtitle_tracks || 0} color="#7c3aed" />
              <StatCard label="Thumbnails" value={stats?.thumbnail_assets || 0} color="#d97706" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Job Board</h3>
              <button onClick={() => setShowNewJob(true)} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
                + New Job
              </button>
            </div>

            {showNewJob && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Create Post-Production Job</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input placeholder="Project Name *" value={newJobForm.project_name} onChange={e => setNewJobForm(p => ({ ...p, project_name: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <select value={newJobForm.type} onChange={e => setNewJobForm(p => ({ ...p, type: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input placeholder="Video Filename" value={newJobForm.video_filename} onChange={e => setNewJobForm(p => ({ ...p, video_filename: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                  <input placeholder="Assigned To" value={newJobForm.assigned_to} onChange={e => setNewJobForm(p => ({ ...p, assigned_to: e.target.value }))}
                    style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={createJob} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Create</button>
                  <button onClick={() => setShowNewJob(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {STATUS_COLUMNS.map(col => (
                <div key={col}>
                  <div style={{ background: STATUS_COLORS[col], color: '#fff', borderRadius: '8px 8px 0 0', padding: '10px 14px', fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>
                    {col.replace(/_/g, ' ')} ({jobs.filter(j => j.status === col).length})
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '0 0 8px 8px', minHeight: 200, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {jobs.filter(j => j.status === col).map(job => (
                      <div key={job.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>{job.project_name}</div>
                        <div style={{ marginBottom: 8 }}>{typeBadge(job.type)}</div>
                        {job.assigned_to && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Assigned: {job.assigned_to}</div>}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {col !== 'completed' && (
                            <button onClick={() => completeJob(job.id)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                              Complete
                            </button>
                          )}
                          {col === 'queued' && (
                            <button onClick={() => updateJobStatus(job.id, 'in_progress')} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Start
                            </button>
                          )}
                          {col === 'in_progress' && (
                            <button onClick={() => updateJobStatus(job.id, 'review')} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Send to Review
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 1: Color Suite ── */}
        {!loading && activeTab === 1 && (
          <div>
            <h3 style={{ color: '#0f172a', marginBottom: 20 }}>Color Correction & Grading</h3>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Project', 'File', 'Type', 'Status', 'Settings', 'Assigned', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colorJobs.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No color jobs yet</td></tr>
                  )}
                  {colorJobs.map(job => (
                    <tr key={job.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>{job.project_name}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280' }}>{job.video_filename || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>{typeBadge(job.type)}</td>
                      <td style={{ padding: '14px 16px' }}>{statusBadge(job.status)}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280' }}>
                        {Object.entries(job.settings || {}).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#374151', fontSize: 13 }}>{job.assigned_to || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {job.status !== 'completed' && (
                          <button onClick={() => completeJob(job.id)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                            Mark Done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 20, marginTop: 24 }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: 12 }}>Color Grade Reference</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { name: 'Cinematic Warm', desc: 'Orange/teal contrast, raised shadows, reduced highlights', use: 'Hero brand videos' },
                  { name: 'Corporate Clean', desc: 'Neutral balance, natural skin tones, slight cool cast', use: 'B2B/pitch videos' },
                  { name: 'Wellness Natural', desc: 'Warm golden tones, lifted blacks, soft contrast', use: 'Yoga/wellness content' },
                  { name: 'High Energy', desc: 'High contrast, vibrant saturation, crushed blacks', use: 'Promos/challenge ads' },
                ].map(preset => (
                  <div key={preset.name} style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginBottom: 4 }}>{preset.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{preset.desc}</div>
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Best for: {preset.use}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Audio Suite ── */}
        {!loading && activeTab === 2 && (
          <div>
            <h3 style={{ color: '#0f172a', marginBottom: 20 }}>Audio Editing Suite</h3>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Project', 'Status', 'Settings', 'Assigned', 'Completed', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audioJobs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No audio jobs yet</td></tr>
                  )}
                  {audioJobs.map(job => (
                    <tr key={job.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>{job.project_name}</td>
                      <td style={{ padding: '14px 16px' }}>{statusBadge(job.status)}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280' }}>
                        {Object.entries(job.settings || {}).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#374151', fontSize: 13 }}>{job.assigned_to || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 12 }}>{job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {job.status !== 'completed' && (
                          <button onClick={() => completeJob(job.id)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                            Mark Done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 12 }}>Audio Processing Presets</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { name: 'Voice Warmth', settings: 'EQ: boost 2-4kHz, cut 300Hz, roll off below 80Hz', use: 'Instructor voiceover' },
                  { name: 'Noise Reduction', settings: 'Spectral denoise -15dB, room tone removal, wind filter', use: 'Outdoor shoots' },
                  { name: 'Podcast Clean', settings: 'Normalize -14 LUFS, de-ess, gentle compression 4:1', use: 'Talking-head videos' },
                ].map(preset => (
                  <div key={preset.name} style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginBottom: 4 }}>{preset.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{preset.settings}</div>
                    <div style={{ fontSize: 11, color: '#0891b2', fontWeight: 600 }}>Use: {preset.use}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Subtitles & Captions ── */}
        {!loading && activeTab === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 12, fontSize: 14 }}>Subtitle Tracks</div>
              {subtitles.map(s => (
                <div key={s.id} onClick={() => setSelectedSubtitle(s)} style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                  background: selectedSubtitle?.id === s.id ? '#ede9fe' : '#fff',
                  border: `1px solid ${selectedSubtitle?.id === s.id ? '#7c3aed' : '#e5e7eb'}`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{s.project_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {s.language.toUpperCase()} · {s.format} · {s.word_count} words
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    {statusBadge(s.status)}
                    {s.auto_generated && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>AI</span>}
                  </div>
                </div>
              ))}

              <button onClick={() => generateSubtitles(selectedSubtitle || subtitles[0])} style={{ width: '100%', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 700, marginTop: 8 }}>
                + AI Generate Track
              </button>
            </div>

            {selectedSubtitle && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', color: '#0f172a' }}>{selectedSubtitle.project_name}</h3>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {selectedSubtitle.language.toUpperCase()} · {selectedSubtitle.format} · {selectedSubtitle.word_count} words
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {statusBadge(selectedSubtitle.status)}
                    {selectedSubtitle.auto_generated && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>AI Generated</span>}
                  </div>
                </div>
                <textarea
                  value={selectedSubtitle.content || ''}
                  onChange={e => setSelectedSubtitle(prev => prev ? { ...prev, content: e.target.value } : null)}
                  style={{ width: '100%', minHeight: 500, padding: 16, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: Translation & Dubbing ── */}
        {!loading && activeTab === 4 && (
          <div>
            <h3 style={{ color: '#0f172a', marginBottom: 20 }}>Translation & Dubbing Jobs</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {dubbing.map(dub => (
                <div key={dub.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{dub.project_name}</div>
                    {statusBadge(dub.status)}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ background: '#f3f4f6', padding: '4px 12px', borderRadius: 6, fontWeight: 700, color: '#374151' }}>{dub.source_language.toUpperCase()}</span>
                    <span style={{ color: '#6b7280', fontSize: 20 }}>→</span>
                    <span style={{ background: '#ede9fe', padding: '4px 12px', borderRadius: 6, fontWeight: 700, color: '#7c3aed' }}>{dub.target_language.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                    Voice: {dub.voice_style} · Est. {dub.estimated_minutes}min
                  </div>
                  {dub.status !== 'completed' && (
                    <button onClick={() => translateDubbing(dub)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, width: '100%' }}>
                      AI Translate & Create Subtitle
                    </button>
                  )}
                  {dub.status === 'completed' && (
                    <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 8, padding: '8px 16px', fontWeight: 700, textAlign: 'center' }}>
                      Translation complete — subtitle track created
                    </div>
                  )}
                </div>
              ))}
            </div>

            {dubbing.length === 0 && (
              <div style={{ background: '#fff', border: '2px dashed #d1d5db', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                No dubbing jobs. Create one via the Post-Production Queue.
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Thumbnail Studio ── */}
        {!loading && activeTab === 5 && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 28 }}>
              <h4 style={{ margin: '0 0 16px', color: '#0f172a', fontWeight: 700 }}>AI Thumbnail Concept Generator</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Project Name</label>
                  <input placeholder="e.g. Pranayama Tutorial" value={thumbnailProject} onChange={e => setThumbnailProject(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Video Topic</label>
                  <input placeholder="e.g. 4 Breathing Techniques for Stress" value={thumbnailTopic} onChange={e => setThumbnailTopic(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Platform</label>
                  <select value={thumbnailPlatform} onChange={e => setThumbnailPlatform(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    {['youtube', 'instagram', 'linkedin', 'tiktok', 'facebook'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <button onClick={generateThumbnails} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, height: 44 }}>
                  Generate 3 Concepts
                </button>
              </div>
            </div>

            <h3 style={{ color: '#0f172a', marginBottom: 16 }}>Thumbnail Concepts</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {thumbnails.map(thumb => (
                <div key={thumb.id} style={{ background: '#fff', border: `2px solid ${thumb.status === 'approved' ? '#86efac' : '#e5e7eb'}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ background: TYPE_COLORS['thumbnail_generation'], color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {thumb.style || 'concept'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: '#d97706', fontSize: 20 }}>{thumb.ctr_score.toFixed(1)}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>CTR</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Project: {thumb.project_name}</div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 12 }}>
                    {thumb.prompt}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#374151' }}>{thumb.platform}</span>
                    {statusBadge(thumb.status)}
                  </div>
                  {thumb.notes && <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{thumb.notes}</div>}
                </div>
              ))}
            </div>

            {/* Clip Extractions */}
            <h3 style={{ color: '#0f172a', margin: '32px 0 16px' }}>Clip Extractions</h3>
            {clips.map(c => (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.project_name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{c.source_file} · {c.total_clips} clips · Purpose: {c.purpose}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(c.clips || []).map((clip, i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>#{clip.clip_no} {clip.title}</div>
                      <div style={{ color: '#6b7280' }}>{clip.start} → {clip.end} ({clip.duration}s) · {clip.format} · {clip.platform}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
