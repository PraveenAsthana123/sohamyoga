'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reel {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platform: string;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  duration_seconds: number | null;
  audio_name: string | null;
  is_trending_audio: boolean;
  created_at: string;
}

interface AnalyticsData {
  totals: {
    total_views: string;
    total_likes: string;
    avg_engagement_rate: string;
    posted_count: number;
    posted_this_month: number;
  };
  by_platform: Array<{
    platform: string;
    reel_count: number;
    total_views: string;
    avg_likes: string;
    avg_comments: string;
    avg_engagement: string;
  }>;
  best_reels: Array<{ id: string; title: string; platform: string; views: number; likes: number; engagement_rate: number }>;
  best_platform: string;
  best_times: Record<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ['instagram','youtube_shorts','tiktok','facebook','linkedin'];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  youtube_shorts: 'bg-red-500',
  tiktok: 'bg-gray-900',
  facebook: 'bg-blue-600',
  linkedin: 'bg-sky-600',
};

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  youtube_shorts: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-100 text-gray-800',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube_shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  posted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const TRENDING_HASHTAGS: Record<string, string[]> = {
  instagram: ['#reels','#fyp','#viral','#trending','#smallbusiness','#digitalmarketing','#yoga','#wellness'],
  tiktok: ['#fyp','#foryoupage','#viral','#trending','#howto','#tips','#yoga','#mindfulness'],
  linkedin: ['#businesstips','#marketing','#growth','#leadership','#entrepreneurship','#wellness'],
  youtube_shorts: ['#shorts','#youtubeshorts','#viral','#yoga','#tutorial','#wellness','#howto'],
  facebook: ['#reels','#community','#yoga','#wellness','#motivation','#health'],
};

const TRENDING_AUDIO = [
  { name: 'Levitating - Dua Lipa (Sped Up)', platform: 'tiktok', uses: '2.3M' },
  { name: 'As It Was - Harry Styles', platform: 'instagram', uses: '1.8M' },
  { name: 'Flowers - Miley Cyrus (Remix)', platform: 'tiktok', uses: '4.1M' },
  { name: 'Calm Meditation Background', platform: 'youtube_shorts', uses: '890K' },
  { name: 'Upbeat Corporate Background', platform: 'linkedin', uses: '340K' },
];

const REEL_IDEAS_PROMPT_EXAMPLES = [
  'Can you do this yoga pose? 🧘 [Challenge format]',
  'Day in my life at a yoga studio 🌅 [Vlog BTS]',
  '3 poses to fix your posture at your desk 💻 [Tips]',
  'I tried hot yoga for 30 days — here\'s what happened [Transformation]',
  'Yoga pose that\'ll change your morning routine ✨ [Educational]',
];

function fmt(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function fmtEng(r: number | string): string {
  const n = typeof r === 'string' ? parseFloat(r) : r;
  return `${(n * 100).toFixed(2)}%`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReelsManagerPage() {
  const [tab, setTab] = useState(0);
  const [reels, setReels] = useState<Reel[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [platformFilter, setPlatformFilter] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null);

  // New reel form
  const [newForm, setNewForm] = useState({
    title: '', caption: '', hashtags: '', platform: 'instagram',
    video_url: '', scheduled_at: '',
  });

  const fetchReels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platformFilter) params.set('platform', platformFilter);
      const r = await fetch(`/api/admin/reels?${params}`);
      const d = await r.json() as { reels?: Reel[] };
      setReels(d.reels ?? []);
    } catch {}
    setLoading(false);
  }, [platformFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/reels/analytics');
      const d = await r.json() as AnalyticsData;
      setAnalytics(d);
    } catch {}
  }, []);

  useEffect(() => { void fetchReels(); }, [fetchReels]);
  useEffect(() => { void fetchAnalytics(); }, [fetchAnalytics]);

  async function createReel() {
    if (!newForm.title.trim()) return;
    await fetch('/api/admin/reels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        hashtags: newForm.hashtags.split(',').map(h => h.trim()).filter(Boolean),
        scheduled_at: newForm.scheduled_at || undefined,
      }),
    });
    setShowNewModal(false);
    setNewForm({ title: '', caption: '', hashtags: '', platform: 'instagram', video_url: '', scheduled_at: '' });
    void fetchReels();
  }

  async function postNow(id: string) {
    const r = await fetch('/api/admin/reels/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reel_id: id, action: 'post_now' }),
    });
    const d = await r.json() as { warning?: string };
    if (d.warning) alert(d.warning);
    void fetchReels();
    void fetchAnalytics();
  }

  async function deleteReel(id: string) {
    if (!confirm('Delete this reel?')) return;
    await fetch(`/api/admin/reels/${id}`, { method: 'DELETE' });
    void fetchReels();
  }

  async function generateIdeas() {
    setIdeasLoading(true);
    setAiIdeas([]);
    try {
      const r = await fetch('/api/admin/reels/analytics'); // reuse analytics endpoint to show ideas section
      // Actually call the video editor script endpoint for idea generation
      const res = await fetch('/api/admin/video-editor/none/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'instagram',
          type: 'reel',
          topic: 'trending yoga and wellness reel ideas',
          duration_seconds: 30,
          tone: 'energetic',
          target_audience: 'health-conscious millennials',
        }),
      });
      const d = await res.json() as { script?: string };
      if (d.script) {
        // Parse ideas from script response — split by numbered lines or newlines
        const lines = d.script.split('\n').filter(l => l.trim().length > 10);
        setAiIdeas(lines.slice(0, 10));
      } else {
        setAiIdeas(REEL_IDEAS_PROMPT_EXAMPLES);
      }
    } catch {
      setAiIdeas(REEL_IDEAS_PROMPT_EXAMPLES);
    }
    setIdeasLoading(false);
  }

  // Calendar helpers
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function reelsForDay(day: Date): Reel[] {
    return reels.filter(r => {
      if (!r.scheduled_at && !r.posted_at) return false;
      const date = new Date(r.scheduled_at ?? r.posted_at ?? '');
      return date.toDateString() === day.toDateString();
    });
  }

  const tabs = ['All Reels', 'Content Calendar', 'Analytics', 'Trending & Ideas', 'Posting Settings'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reels Manager</h1>
            <p className="text-sm text-gray-500 mt-0.5">Plan, schedule, and analyze short-form video content</p>
          </div>
          <button onClick={() => setShowNewModal(true)} className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
            + New Reel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Tab 0: All Reels ─────────────────────────────────────────────── */}
        {tab === 0 && (
          <div>
            {/* Platform filter tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {['', ...PLATFORMS].map(p => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${platformFilter === p ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {p ? PLATFORM_LABELS[p] : 'All Platforms'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading reels...</div>
            ) : reels.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No reels found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {reels.map(reel => (
                  <div key={reel.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    <div className={`h-28 ${PLATFORM_COLORS[reel.platform] ?? 'bg-gray-400'} flex flex-col items-center justify-center relative`}>
                      <div className="text-white text-3xl opacity-60">▶</div>
                      {reel.is_trending_audio && (
                        <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-bold">🔥 Trending</span>
                      )}
                      {reel.duration_seconds && (
                        <span className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">{reel.duration_seconds}s</span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <h3 className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{reel.title}</h3>
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[reel.status] ?? 'bg-gray-100 text-gray-600'}`}>{reel.status}</span>
                      </div>
                      <span className={`inline-flex text-xs px-1.5 py-0.5 rounded font-medium mb-2 ${PLATFORM_BADGE_COLORS[reel.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PLATFORM_LABELS[reel.platform] ?? reel.platform}
                      </span>
                      {reel.status === 'posted' && (
                        <div className="flex gap-2 text-xs text-gray-500 mb-2">
                          <span>👁 {fmt(reel.views)}</span>
                          <span>👍 {fmt(reel.likes)}</span>
                          <span>💬 {reel.comments}</span>
                        </div>
                      )}
                      {(reel.scheduled_at || reel.posted_at) && (
                        <div className="text-xs text-gray-400 mb-2">
                          {reel.status === 'scheduled' ? `⏰ ${new Date(reel.scheduled_at!).toLocaleDateString()}` : `Posted ${new Date(reel.posted_at!).toLocaleDateString()}`}
                        </div>
                      )}
                      <div className="flex gap-1 flex-wrap">
                        {reel.status !== 'posted' && (
                          <button onClick={() => postNow(reel.id)}
                            className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Post Now</button>
                        )}
                        <button onClick={() => deleteReel(reel.id)}
                          className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600">Delete</button>
                        <button onClick={async () => {
                          await fetch('/api/admin/reels', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: `${reel.title} (Copy)`, caption: reel.caption, hashtags: reel.hashtags, platform: reel.platform }),
                          });
                          void fetchReels();
                        }} className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Duplicate</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 1: Content Calendar ──────────────────────────────────────── */}
        {tab === 1 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Content Calendar</h2>
              <div className="flex gap-2">
                <button onClick={() => setWeekOffset(w => w - 1)} className="border border-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">← Prev</button>
                <span className="border border-gray-200 px-4 py-1.5 rounded-lg text-sm bg-white text-gray-700">
                  Week of {weekDays[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
                <button onClick={() => setWeekOffset(w => w + 1)} className="border border-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Next →</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => {
                const dayReels = reelsForDay(day);
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} className={`bg-white rounded-xl border-2 min-h-36 p-2 ${isToday ? 'border-pink-300' : 'border-gray-200'}`}>
                    <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-pink-600' : 'text-gray-500'}`}>
                      {day.toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                    </div>
                    <div className="space-y-1">
                      {dayReels.map(r => (
                        <div key={r.id} className={`text-xs p-1 rounded flex items-center gap-1 ${PLATFORM_COLORS[r.platform] ?? 'bg-gray-400'} text-white`}>
                          <span className="font-bold text-xs">{r.platform.slice(0, 2).toUpperCase()}</span>
                          <span className="truncate">{r.title.slice(0, 14)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setNewForm(f => ({ ...f, scheduled_at: day.toISOString().slice(0, 16) })); setShowNewModal(true); }}
                      className="mt-1 w-full text-xs text-gray-400 hover:text-pink-500 py-1">+ Schedule</button>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(PLATFORM_COLORS).map(([p, color]) => (
                <div key={p} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  {PLATFORM_LABELS[p] ?? p}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: Analytics ─────────────────────────────────────────────── */}
        {tab === 2 && analytics && (
          <div>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total Views', value: fmt(analytics.totals.total_views) },
                { label: 'Total Likes', value: fmt(analytics.totals.total_likes) },
                { label: 'Avg Engagement', value: fmtEng(analytics.totals.avg_engagement_rate) },
                { label: 'Best Platform', value: PLATFORM_LABELS[analytics.best_platform] ?? analytics.best_platform },
                { label: 'Reels This Month', value: String(analytics.totals.posted_this_month) },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Per-platform table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="border-b border-gray-200 px-5 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Platform Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Platform','Reels','Total Views','Avg Likes','Avg Comments','Avg Engagement'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.by_platform.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_BADGE_COLORS[row.platform] ?? 'bg-gray-100 text-gray-700'}`}>
                            {PLATFORM_LABELS[row.platform] ?? row.platform}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{row.reel_count}</td>
                        <td className="px-4 py-2.5 text-gray-700">{fmt(row.total_views)}</td>
                        <td className="px-4 py-2.5 text-gray-700">{fmt(parseFloat(row.avg_likes))}</td>
                        <td className="px-4 py-2.5 text-gray-700">{fmt(parseFloat(row.avg_comments))}</td>
                        <td className="px-4 py-2.5 font-medium text-green-700">{fmtEng(row.avg_engagement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best performing reels */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Performing Reels</h3>
                <div className="space-y-2">
                  {analytics.best_reels.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                        <div className="text-xs text-gray-500">{PLATFORM_LABELS[r.platform]} · {fmtEng(r.engagement_rate)} engagement</div>
                      </div>
                      <div className="text-xs text-gray-500">{fmt(r.views)} views</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Posting frequency + best times */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Posting Frequency</h3>
                <div className="space-y-1.5 mb-5">
                  {[
                    { day: 'Mon', bars: '▓▓▓▓' },
                    { day: 'Tue', bars: '▓▓' },
                    { day: 'Wed', bars: '▓▓▓▓▓' },
                    { day: 'Thu', bars: '▓' },
                    { day: 'Fri', bars: '▓▓▓▓▓▓' },
                    { day: 'Sat', bars: '▓▓▓' },
                    { day: 'Sun', bars: '▓' },
                  ].map(r => (
                    <div key={r.day} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-gray-500">{r.day}</span>
                      <span className="text-pink-500 font-mono">{r.bars}</span>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Best Time to Post</h3>
                <div className="space-y-1">
                  {Object.entries(analytics.best_times).map(([plat, time]) => (
                    <div key={plat} className="flex items-center justify-between text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${PLATFORM_BADGE_COLORS[plat] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PLATFORM_LABELS[plat] ?? plat}
                      </span>
                      <span className="text-gray-700 font-medium">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Trending & Ideas ──────────────────────────────────────── */}
        {tab === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Ideas */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">AI Reel Ideas</h2>
                  <button onClick={generateIdeas} disabled={ideasLoading}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2">
                    {ideasLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</> : '✨ Generate Reel Ideas'}
                  </button>
                </div>
                {aiIdeas.length === 0 && !ideasLoading && (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-4xl mb-2">💡</div>
                    <p className="text-sm">Click &quot;Generate Reel Ideas&quot; to get AI-powered content ideas via Ollama</p>
                  </div>
                )}
                {aiIdeas.length > 0 && (
                  <div className="space-y-2">
                    {aiIdeas.map((idea, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedIdea(expandedIdea === i ? null : i)}>
                        <div className="flex items-start gap-2">
                          <span className="text-pink-500 font-bold text-sm">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{idea}</p>
                            {expandedIdea === i && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <button onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch('/api/admin/reels', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ title: idea.slice(0, 80), caption: idea, platform: 'instagram', hashtags: ['#yoga','#reels','#wellness'] }),
                                  });
                                  void fetchReels();
                                  alert('Reel idea saved as draft!');
                                }} className="text-xs bg-pink-50 text-pink-700 px-3 py-1 rounded hover:bg-pink-100">
                                  Save as Draft Reel →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trending audio */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Trending Audio</h3>
                <div className="space-y-2">
                  {TRENDING_AUDIO.map((audio, i) => (
                    <div key={i} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">🎵 {audio.name}</div>
                        <div className="text-xs text-gray-500">
                          {PLATFORM_LABELS[audio.platform] ?? audio.platform} · {audio.uses} uses
                        </div>
                      </div>
                      <button onClick={() => {
                        setNewForm(f => ({ ...f, platform: audio.platform }));
                        setShowNewModal(true);
                      }} className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded hover:bg-pink-100">
                        Use in Reel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hashtag sidepanel */}
            <div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Trending Hashtags</h3>
                {Object.entries(TRENDING_HASHTAGS).map(([platform, tags]) => (
                  <div key={platform} className="mb-4">
                    <div className={`inline-flex text-xs px-2 py-0.5 rounded font-medium mb-2 ${PLATFORM_BADGE_COLORS[platform] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map(tag => (
                        <button key={tag} onClick={() => setNewForm(f => ({
                          ...f,
                          hashtags: f.hashtags ? `${f.hashtags}, ${tag}` : tag,
                          platform,
                        }))}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded hover:bg-pink-100 hover:text-pink-700">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-2">Click a hashtag to add it to your next reel.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 4: Posting Settings ──────────────────────────────────────── */}
        {tab === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Configuration</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                {
                  platform: 'Instagram / Facebook Reels',
                  icon: '📸',
                  color: 'bg-pink-50 border-pink-200',
                  vars: ['FACEBOOK_APP_ID','FACEBOOK_PAGE_TOKEN'],
                  note: 'Requires Meta for Developers app with instagram_basic and pages_manage_posts permissions.',
                  setupLink: '/admin/setup',
                },
                {
                  platform: 'YouTube Shorts',
                  icon: '▶',
                  color: 'bg-red-50 border-red-200',
                  vars: ['YOUTUBE_API_KEY','YOUTUBE_CLIENT_ID'],
                  note: 'Requires Google Cloud Project with YouTube Data API v3 and OAuth 2.0.',
                  setupLink: '/admin/setup',
                },
                {
                  platform: 'TikTok',
                  icon: '🎵',
                  color: 'bg-gray-50 border-gray-300',
                  vars: ['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET'],
                  note: 'Requires TikTok for Developers account and video.upload scope approval.',
                  setupLink: '/admin/setup',
                },
                {
                  platform: 'LinkedIn',
                  icon: '💼',
                  color: 'bg-sky-50 border-sky-200',
                  vars: ['LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET'],
                  note: 'Requires LinkedIn Developer App with w_member_social and r_basicprofile permissions.',
                  setupLink: '/admin/setup',
                },
              ].map((card, i) => (
                <div key={i} className={`rounded-xl border-2 ${card.color} p-5`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <h3 className="font-semibold text-gray-900">{card.platform}</h3>
                  </div>
                  <div className="space-y-2 mb-3">
                    {card.vars.map(v => (
                      <div key={v} className="flex items-center justify-between text-xs">
                        <code className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">{v}</code>
                        <span className="text-gray-400">Not configured</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{card.note}</p>
                  <a href={card.setupLink} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Set Up → Platform Setup</a>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> When platform APIs are not configured, clicking &quot;Post Now&quot; will mark reels as posted manually. Connect platforms above to enable auto-publishing to each network.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── New Reel Modal ─────────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-5">New Reel</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Reel title" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Caption</label>
                <textarea value={newForm.caption} onChange={e => setNewForm(f => ({ ...f, caption: e.target.value }))}
                  rows={2} placeholder="Caption text..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hashtags (comma-separated)</label>
                <input value={newForm.hashtags} onChange={e => setNewForm(f => ({ ...f, hashtags: e.target.value }))}
                  placeholder="#yoga, #reels, #wellness" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <select value={newForm.platform} onChange={e => setNewForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Video URL (optional)</label>
                <input value={newForm.video_url} onChange={e => setNewForm(f => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Schedule for (optional)</label>
                <input type="datetime-local" value={newForm.scheduled_at} onChange={e => setNewForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={createReel}
                className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700">Create Reel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
