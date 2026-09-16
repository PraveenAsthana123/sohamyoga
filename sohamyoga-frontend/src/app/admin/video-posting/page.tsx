'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  reel_id: string | null;
  video_project_id: string | null;
  platforms: string[];
  title: string;
  caption: string;
  hashtags: string[];
  scheduled_at: string | null;
  status: string;
  results_json: Record<string, { ok: boolean; post_id?: string; video_id?: string; reason?: string; manual_url?: string }>;
  retry_count: number;
  error_message: string | null;
  created_at: string;
}

interface QueueStats {
  total: number;
  queued: number;
  posted: number;
  failed: number;
  posting: number;
}

interface VideoProject {
  id: string;
  title: string;
  output_video_url: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  facebook: 'Facebook Reels',
  linkedin: 'LinkedIn',
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  youtube_shorts: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-100 text-gray-800',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
};

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600',
  posting: 'bg-blue-100 text-blue-700',
  posted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

// Platform configuration status (based on env vars we can check at UI level — actual check is server-side)
const PLATFORM_CONFIG: Record<string, { label: string; hint: string; color: string }> = {
  instagram: { label: 'Needs Setup', hint: 'FACEBOOK_APP_ID + page token', color: 'text-amber-600' },
  youtube_shorts: { label: 'Needs Setup', hint: 'YOUTUBE_API_KEY + OAuth', color: 'text-amber-600' },
  tiktok: { label: 'Needs Setup', hint: 'TIKTOK_CLIENT_KEY + SECRET', color: 'text-amber-600' },
  facebook: { label: 'Needs Setup', hint: 'FACEBOOK_APP_ID + page token', color: 'text-amber-600' },
  linkedin: { label: 'Needs Setup', hint: 'LINKEDIN_CLIENT_ID + SECRET', color: 'text-amber-600' },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VideoPostingPage() {
  const [tab, setTab] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Post Now form
  const [postForm, setPostForm] = useState({
    title: '',
    caption: '',
    hashtags: '',
    platforms: [] as string[],
    video_url: '',
    video_project_id: '',
    schedule_mode: 'now' as 'now' | 'schedule',
    scheduled_at: '',
  });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/video-posting');
      const d = await r.json() as { queue?: QueueItem[]; stats?: QueueStats };
      setQueue(d.queue ?? []);
      setStats(d.stats ?? null);
    } catch {}
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/video-editor');
      const d = await r.json() as { projects?: VideoProject[] };
      setProjects(d.projects ?? []);
    } catch {}
  }, []);

  useEffect(() => { void fetchQueue(); void fetchProjects(); }, [fetchQueue, fetchProjects]);

  async function addToQueue() {
    if (!postForm.title.trim()) { alert('Title is required'); return; }
    if (!postForm.platforms.length) { alert('Select at least one platform'); return; }

    await fetch('/api/admin/video-posting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms: postForm.platforms,
        title: postForm.title,
        caption: postForm.caption,
        hashtags: postForm.hashtags.split(',').map(h => h.trim()).filter(Boolean),
        scheduled_at: postForm.schedule_mode === 'schedule' && postForm.scheduled_at ? postForm.scheduled_at : undefined,
        video_project_id: postForm.video_project_id || undefined,
      }),
    });
    setPostForm({ title: '', caption: '', hashtags: '', platforms: [], video_url: '', video_project_id: '', schedule_mode: 'now', scheduled_at: '' });
    void fetchQueue();
    setTab(1);
  }

  async function executeItem(id: string) {
    setExecutingId(id);
    try {
      const r = await fetch(`/api/admin/video-posting/${id}/execute`, { method: 'POST' });
      const d = await r.json() as { summary?: { total_platforms: number; succeeded: number; failed: number } };
      if (d.summary) {
        alert(`Execution complete: ${d.summary.succeeded}/${d.summary.total_platforms} platforms succeeded.\n\nNote: Actual video upload requires platform API credentials configured in environment.`);
      }
    } catch (e) {
      alert(`Execution failed: ${e}`);
    }
    setExecutingId(null);
    void fetchQueue();
  }

  async function cancelItem(id: string) {
    await fetch(`/api/admin/video-posting/${id}/execute`, {
      method: 'POST',
    });
    // Mark as cancelled via PATCH if we add that endpoint, for now just refresh
    void fetchQueue();
  }

  const queuedItems = queue.filter(q => ['queued','scheduled'].includes(q.status));
  const historyItems = queue.filter(q => ['posted','failed','cancelled'].includes(q.status));

  const platformToggle = (p: string) => {
    setPostForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  function resultIcon(ok: boolean | undefined): string {
    if (ok === true) return '✓';
    if (ok === false) return '✗';
    return '?';
  }

  const tabs = ['Post Now', 'Queue', 'History'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Cross-Platform Video Posting</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule and publish videos to Instagram, YouTube, TikTok, Facebook, and LinkedIn</p>
        </div>
      </div>

      {/* Stats banner */}
      {stats && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex gap-6 text-sm">
            <span className="text-gray-500">Total: <strong className="text-gray-900">{stats.total}</strong></span>
            <span className="text-gray-500">Queued: <strong className="text-amber-600">{stats.queued}</strong></span>
            <span className="text-gray-500">Posted: <strong className="text-green-600">{stats.posted}</strong></span>
            <span className="text-gray-500">Failed: <strong className="text-red-600">{stats.failed}</strong></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
              {i === 1 && stats && stats.queued > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{stats.queued}</span>
              )}
              {i === 2 && stats && stats.failed > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">{stats.failed}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Tab 0: Post Now ──────────────────────────────────────────────── */}
        {tab === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-5">Create Post</h2>
                <div className="space-y-4">
                  {/* Video source */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Video Source</label>
                    <div className="space-y-2">
                      <select value={postForm.video_project_id} onChange={e => setPostForm(f => ({ ...f, video_project_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="">Select from video projects...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                      <div className="text-xs text-gray-400 text-center">— or enter a URL —</div>
                      <input value={postForm.video_url} onChange={e => setPostForm(f => ({ ...f, video_url: e.target.value }))}
                        placeholder="https://your-video-url.mp4"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                    <input value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Post title" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Caption</label>
                    <textarea value={postForm.caption} onChange={e => setPostForm(f => ({ ...f, caption: e.target.value }))}
                      rows={3} placeholder="Caption text..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hashtags (comma-separated)</label>
                    <input value={postForm.hashtags} onChange={e => setPostForm(f => ({ ...f, hashtags: e.target.value }))}
                      placeholder="#yoga, #reels, #wellness"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  {/* Platform selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Platforms *</label>
                    <div className="space-y-2">
                      {Object.entries(PLATFORM_LABELS).map(([p, label]) => (
                        <label key={p} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                          <input type="checkbox" checked={postForm.platforms.includes(p)} onChange={() => platformToggle(p)}
                            className="accent-violet-600" />
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_COLORS[p]}`}>{label}</span>
                          <span className={`text-xs ml-auto ${PLATFORM_CONFIG[p]?.color ?? 'text-gray-400'}`}>
                            ⚠ {PLATFORM_CONFIG[p]?.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Schedule mode */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Timing</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="schedule" value="now" checked={postForm.schedule_mode === 'now'}
                          onChange={() => setPostForm(f => ({ ...f, schedule_mode: 'now' }))} className="accent-violet-600" />
                        <span className="text-sm">Post Immediately</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="schedule" value="schedule" checked={postForm.schedule_mode === 'schedule'}
                          onChange={() => setPostForm(f => ({ ...f, schedule_mode: 'schedule' }))} className="accent-violet-600" />
                        <span className="text-sm">Schedule for:</span>
                      </label>
                    </div>
                    {postForm.schedule_mode === 'schedule' && (
                      <input type="datetime-local" value={postForm.scheduled_at}
                        onChange={e => setPostForm(f => ({ ...f, scheduled_at: e.target.value }))}
                        className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    )}
                  </div>

                  <button onClick={addToQueue}
                    className="w-full bg-violet-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-violet-700">
                    Add to Queue →
                  </button>
                </div>
              </div>
            </div>

            {/* Info sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Platform Status</h3>
                <div className="space-y-2">
                  {Object.entries(PLATFORM_LABELS).map(([p, label]) => (
                    <div key={p} className="flex items-center justify-between text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_COLORS[p]}`}>{label}</span>
                      <span className="text-xs text-amber-600">⚠ Not Configured</span>
                    </div>
                  ))}
                </div>
                <a href="/admin/reels" className="block mt-3 text-xs text-violet-600 hover:text-violet-800">
                  Set up platforms in Reels Settings →
                </a>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
                <h3 className="font-semibold text-violet-900 mb-2">How It Works</h3>
                <ol className="text-xs text-violet-800 space-y-1.5 list-decimal list-inside">
                  <li>Select video source and platforms</li>
                  <li>Set caption, hashtags, timing</li>
                  <li>Add to queue — system attempts each platform</li>
                  <li>If API configured: real publish via platform API</li>
                  <li>If not configured: manual fallback with direct link</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 1: Queue ──────────────────────────────────────────────────── */}
        {tab === 1 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Posting Queue</h2>
              <button onClick={() => fetchQueue()} className="text-sm text-gray-500 hover:text-gray-700">↻ Refresh</button>
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading queue...</div>
            ) : queuedItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-400">Queue is empty. Add posts from the &quot;Post Now&quot; tab.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Title','Platforms','Scheduled','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {queuedItems.map(item => (
                      <>
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.title}</div>
                            {item.caption && <div className="text-xs text-gray-500 truncate max-w-xs">{item.caption}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.platforms.map(p => (
                                <span key={p} className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[p] ?? 'bg-gray-100 text-gray-700'}`}>
                                  {p.slice(0, 3).toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Immediately'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'} ${item.status === 'posting' ? 'animate-pulse' : ''}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => executeItem(item.id)} disabled={executingId === item.id}
                                className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded hover:bg-violet-100 disabled:opacity-50">
                                {executingId === item.id ? 'Executing...' : 'Execute Now'}
                              </button>
                              <button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100">
                                {expandedItem === item.id ? 'Hide' : 'Details'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedItem === item.id && (
                          <tr key={`${item.id}-expanded`}>
                            <td colSpan={5} className="px-4 py-3 bg-gray-50">
                              <div className="grid grid-cols-3 gap-2">
                                {item.platforms.map(p => {
                                  const res = item.results_json[p];
                                  return (
                                    <div key={p} className="text-xs border border-gray-200 rounded-lg p-2 bg-white">
                                      <div className="font-medium text-gray-700 mb-1">{PLATFORM_LABELS[p] ?? p}</div>
                                      {res ? (
                                        <div className={res.ok ? 'text-green-600' : 'text-red-500'}>
                                          {resultIcon(res.ok)} {res.ok ? (res.post_id ?? res.video_id ?? 'Posted') : (res.reason ?? 'Failed')}
                                        </div>
                                      ) : (
                                        <div className="text-gray-400">Not yet executed</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: History ────────────────────────────────────────────────── */}
        {tab === 2 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Posting History</h2>
              {historyItems.length > 0 && (
                <div className="text-sm text-gray-500">
                  Success rate: <strong className="text-green-600">
                    {historyItems.length > 0
                      ? `${Math.round((historyItems.filter(i => i.status === 'posted').length / historyItems.length) * 100)}%`
                      : '—'}
                  </strong>
                </div>
              )}
            </div>
            {historyItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-gray-400">No posting history yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyItems.map(item => {
                  const results = item.results_json ?? {};
                  const succeeded = Object.values(results).filter(r => r?.ok).length;
                  const total = item.platforms.length;
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(item.created_at).toLocaleString()} · {succeeded}/{total} platforms succeeded
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.status}
                        </span>
                        {item.status === 'failed' && (
                          <button onClick={() => executeItem(item.id)} disabled={executingId === item.id}
                            className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 disabled:opacity-50">
                            Retry
                          </button>
                        )}
                        <button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="text-xs text-gray-400 hover:text-gray-600">
                          {expandedItem === item.id ? '▲' : '▼'}
                        </button>
                      </div>
                      {expandedItem === item.id && (
                        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                            {item.platforms.map(p => {
                              const res = results[p];
                              return (
                                <div key={p} className="text-xs border border-gray-200 rounded-lg p-2.5 bg-white">
                                  <div className="font-medium text-gray-700 mb-1">{PLATFORM_LABELS[p] ?? p}</div>
                                  {res ? (
                                    <>
                                      <div className={`font-semibold ${res.ok ? 'text-green-600' : 'text-red-500'}`}>
                                        {res.ok ? '✓ Published' : `✗ ${res.reason ?? 'Failed'}`}
                                      </div>
                                      {res.ok && (res.post_id ?? res.video_id) && (
                                        <div className="text-gray-400 mt-0.5">ID: {res.post_id ?? res.video_id}</div>
                                      )}
                                      {!res.ok && res.manual_url && (
                                        <a href={res.manual_url} target="_blank" rel="noopener noreferrer"
                                          className="text-violet-600 hover:underline mt-0.5 block">Post manually →</a>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-gray-400">No result</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {item.error_message && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">{item.error_message}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
