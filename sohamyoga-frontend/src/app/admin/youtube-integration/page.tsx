'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface YTVideo {
  id: string; video_id: string; title: string; description: string;
  channel_id: string; channel_title: string; thumbnail_url: string;
  published_at: string; duration_iso: string; duration_seconds: number;
  view_count: number; like_count: number; comment_count: number;
  status: string; video_type: string; transcript_fetched: boolean;
  synced_at: string; engagementRate?: string;
}
interface YTComment {
  id: string; comment_id: string; video_id: string; author_name: string;
  text: string; like_count: number; reply_count: number;
  is_top_comment: boolean; published_at: string; sentiment: string;
  is_responded: boolean; response_text: string | null;
  video_title?: string; scraped_at: string;
}
interface YTChannel {
  channel_id?: string; subscriber_count: number; view_count: number; video_count: number;
}
interface YTKpi {
  totalVideos: number; totalViews: number; totalSubscribers: number;
  totalLikes: number; avgEngagementRate: string; shorts: number;
}
interface YTData {
  demo: boolean; apiKeySet: boolean; oauthSet: boolean;
  channel: YTChannel; videos: YTVideo[]; comments: YTComment[];
  topVideos: YTVideo[]; kpi: YTKpi;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

function sentimentColor(s: string) {
  if (s === 'positive') return 'bg-green-100 text-green-700';
  if (s === 'negative') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', red: 'border-l-4 border-red-500 bg-red-50',
    green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// ─── Tab: Channel Dashboard ───────────────────────────────────────────────────
function ChannelDashboardTab({ data, onSync }: { data: YTData; onSync: () => void }) {
  const { kpi, channel, topVideos, demo, apiKeySet } = data;
  return (
    <div className="space-y-6">
      {demo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Demo mode — showing seeded data. Set YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID to load live data.
        </div>
      )}

      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {channel.channel_id ? channel.channel_id.slice(0, 2) : 'SY'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Soham Yoga Studio</h2>
                <p className="text-sm text-gray-500">{channel.subscriber_count?.toLocaleString() || '0'} subscribers · {channel.video_count || 0} videos</p>
                <p className="text-sm text-gray-500">{channel.view_count?.toLocaleString() || '0'} total views</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`text-xs px-2 py-1 rounded ${apiKeySet ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {apiKeySet ? '✓ API Key Set' : '✗ No API Key'}
            </span>
            <button onClick={onSync} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Sync Channel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Videos" value={kpi.totalVideos} color="red" />
        <KpiCard label="Total Views" value={kpi.totalViews.toLocaleString()} color="blue" />
        <KpiCard label="Subscribers" value={kpi.totalSubscribers.toLocaleString()} color="green" />
        <KpiCard label="Total Likes" value={kpi.totalLikes.toLocaleString()} color="amber" />
        <KpiCard label="Avg Engagement" value={`${kpi.avgEngagementRate}%`} color="purple" />
        <KpiCard label="Shorts" value={kpi.shorts} color="teal" />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Top 3 Videos by Views</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topVideos.slice(0, 3).map((v, i) => (
            <div key={v.id} className="border rounded-lg overflow-hidden">
              <div className="relative">
                <img src={v.thumbnail_url || `https://picsum.photos/seed/yt_${i}/320/180`} alt={v.title}
                  className="w-full h-36 object-cover bg-gray-100" />
                <span className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {fmtDuration(v.duration_iso)}
                </span>
                <span className={`absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded font-bold ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-300' : 'bg-orange-300'}`}>
                  #{i + 1}
                </span>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-800 line-clamp-2">{v.title}</p>
                <div className="flex gap-2 mt-1 text-xs text-gray-500">
                  <span>👁 {Number(v.view_count).toLocaleString()}</span>
                  <span>👍 {Number(v.like_count).toLocaleString()}</span>
                  <span>💬 {Number(v.comment_count).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Videos ──────────────────────────────────────────────────────────────
function VideosTab({ videos }: { videos: YTVideo[] }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState('views');

  const filtered = videos
    .filter(v => typeFilter === 'all' || v.video_type === typeFilter)
    .sort((a, b) => {
      if (sort === 'views') return b.view_count - a.view_count;
      if (sort === 'likes') return b.like_count - a.like_count;
      if (sort === 'comments') return b.comment_count - a.comment_count;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

  const typeColors: Record<string, string> = {
    video: 'bg-blue-100 text-blue-700', short: 'bg-red-100 text-red-700', live: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'video', 'short', 'live'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-sm font-medium ${typeFilter === t ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + (t === 'short' ? 's' : t === 'video' ? 's' : 's')}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-600">
            <option value="newest">Newest</option>
            <option value="views">Most Views</option>
            <option value="likes">Most Liked</option>
            <option value="comments">Most Comments</option>
          </select>
        </div>
        <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          Upload Video (YouTube Studio)
        </a>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Thumbnail', 'Title', 'Type', 'Duration', 'Published', 'Views', 'Likes', 'Comments', 'Engagement', 'Actions'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <img src={v.thumbnail_url || `https://picsum.photos/seed/${v.video_id}/80/45`} alt={v.title}
                    className="w-20 h-11 object-cover rounded bg-gray-100" />
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <p className="font-medium text-gray-800 line-clamp-2 text-xs">{v.title}</p>
                </td>
                <td className="px-3 py-2"><Badge label={v.video_type} colorClass={typeColors[v.video_type] || 'bg-gray-100 text-gray-600'} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtDuration(v.duration_iso)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-400">{new Date(v.published_at || v.synced_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-medium">{Number(v.view_count).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(v.like_count).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(v.comment_count).toLocaleString()}</td>
                <td className="px-3 py-2 text-green-600">{v.engagementRate || '0.00'}%</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 whitespace-nowrap">
                    <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-red-600 hover:underline">Watch</a>
                    <span className="text-gray-300">|</span>
                    <a href={`/admin/youtube-transcript?v=${v.video_id}`} className="text-xs text-blue-600 hover:underline">Transcript</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Comments ────────────────────────────────────────────────────────────
function CommentsTab({ comments }: { comments: YTComment[] }) {
  const [filter, setFilter] = useState('all');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const filtered = comments.filter(c => {
    if (filter === 'unresponded') return !c.is_responded;
    if (filter === 'positive') return c.sentiment === 'positive';
    if (filter === 'negative') return c.sentiment === 'negative';
    return true;
  });

  const stats = {
    total: comments.length,
    pos: comments.filter(c => c.sentiment === 'positive').length,
    neg: comments.filter(c => c.sentiment === 'negative').length,
    neu: comments.filter(c => c.sentiment === 'neutral').length,
    unresponded: comments.filter(c => !c.is_responded).length,
  };
  const posPct = stats.total > 0 ? Math.round((stats.pos / stats.total) * 100) : 0;
  const negPct = stats.total > 0 ? Math.round((stats.neg / stats.total) * 100) : 0;
  const neuPct = stats.total > 0 ? Math.round((stats.neu / stats.total) * 100) : 0;

  async function postReply(commentId: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/youtube-integration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, reply_text: replyText }),
      });
      const data = await res.json() as { warning?: string };
      if (data.warning) setMsg(data.warning);
      else setMsg('Reply posted successfully.');
      setReplyId(null); setReplyText('');
    } catch { setMsg('Failed to post reply.'); }
    finally { setSubmitting(false); }
  }

  async function generateAiReply(commentText: string, cid: string) {
    setAiLoading(cid); setReplyId(cid);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Write a friendly YouTube reply to this comment on a yoga/wellness channel: "${commentText}"` }),
      });
      const data = await res.json() as { text?: string };
      if (data.text) setReplyText(data.text);
    } catch { setReplyText('Thank you for your comment! We really appreciate your support and feedback.'); }
    finally { setAiLoading(null); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm">
        <div><p className="text-xl font-bold">{stats.total}</p><p className="text-gray-500 text-xs">Total</p></div>
        <div><p className="text-xl font-bold text-green-600">{posPct}%</p><p className="text-gray-500 text-xs">Positive</p></div>
        <div><p className="text-xl font-bold text-gray-500">{neuPct}%</p><p className="text-gray-500 text-xs">Neutral</p></div>
        <div><p className="text-xl font-bold text-red-600">{negPct}%</p><p className="text-gray-500 text-xs">Negative</p></div>
        <div><p className="text-xl font-bold text-amber-600">{stats.unresponded}</p><p className="text-gray-500 text-xs">Unresponded</p></div>
      </div>

      {msg && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 flex items-center justify-between">
          {msg}
          <button onClick={() => setMsg('')} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['all', 'unresponded', 'positive', 'negative'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm font-medium ${filter === f ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {c.author_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.author_name}</p>
                  {c.video_title && <p className="text-xs text-gray-400 line-clamp-1">on: {c.video_title}</p>}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Badge label={c.sentiment} colorClass={sentimentColor(c.sentiment)} />
                {c.is_responded && <Badge label="Replied" colorClass="bg-blue-100 text-blue-700" />}
              </div>
            </div>
            <p className="text-sm text-gray-700">{c.text}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>👍 {c.like_count}</span>
              {c.reply_count > 0 && <span>💬 {c.reply_count} replies</span>}
              <span>{new Date(c.published_at || c.scraped_at).toLocaleDateString()}</span>
            </div>
            {c.response_text && (
              <div className="bg-red-50 rounded p-2 text-xs text-red-800">
                <span className="font-medium">Your reply: </span>{c.response_text}
              </div>
            )}
            {!c.is_responded && (
              <div className="flex gap-2">
                <button onClick={() => { setReplyId(c.comment_id); setReplyText(''); }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                  Reply
                </button>
                <button onClick={() => generateAiReply(c.text, c.comment_id)} disabled={aiLoading === c.comment_id}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 disabled:opacity-50">
                  {aiLoading === c.comment_id ? 'Generating...' : 'AI Reply'}
                </button>
                <button className="px-3 py-1 bg-gray-100 text-gray-500 rounded text-xs hover:bg-gray-200" title="Pin to top (coming soon)">
                  Pin to Top
                </button>
              </div>
            )}
            {replyId === c.comment_id && (
              <div className="space-y-2">
                <textarea rows={2} value={replyText} onChange={e => setReplyText(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Write your reply..." />
                <div className="flex gap-2">
                  <button onClick={() => postReply(c.comment_id)} disabled={submitting || !replyText}
                    className="px-4 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                    {submitting ? 'Posting...' : 'Post Reply'}
                  </button>
                  <button onClick={() => setReplyId(null)} className="px-4 py-1 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
            No comments match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────
function AnalyticsTab({ videos }: { videos: YTVideo[] }) {
  // Seeded 12-week view data
  const weeklyViews = [2100, 3400, 2800, 4200, 5100, 3800, 6200, 7400, 8100, 9200, 11000, 14200];
  const maxWeekly = Math.max(...weeklyViews);

  const byEngagement = [...videos].sort((a, b) => Number(b.engagementRate || 0) - Number(a.engagementRate || 0));

  const trafficSources = [
    { label: 'YouTube Search', pct: 45 },
    { label: 'Suggested Videos', pct: 30 },
    { label: 'Direct / Browse', pct: 15 },
    { label: 'Other', pct: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Views — Last 12 Weeks</h3>
        <div className="flex items-end gap-1 h-32">
          {weeklyViews.map((v, i) => {
            const h = Math.round((v / maxWeekly) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400" style={{ fontSize: '9px' }}>{(v / 1000).toFixed(1)}k</span>
                <div className="w-full bg-red-500 rounded-t" style={{ height: `${h}%` }} />
                <span className="text-xs text-gray-400" style={{ fontSize: '9px' }}>W{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Top Videos by Engagement Rate</h3>
          <div className="space-y-3">
            {byEngagement.slice(0, 6).map((v, i) => (
              <div key={v.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700 line-clamp-1">{v.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-red-500 rounded-full" style={{ width: `${Math.min(Number(v.engagementRate || 0) * 20, 100)}%` }} />
                    </div>
                    <span className="text-xs text-green-600 font-medium">{v.engagementRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Traffic Sources</h3>
          <div className="space-y-3">
            {trafficSources.map(s => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{s.label}</span>
                  <span className="font-medium">{s.pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-red-500 rounded-full" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500">CTR: <span className="font-medium text-green-600">4.2%</span> <span className="text-gray-400">(Industry avg: 2–5%)</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Audience Retention</h3>
        <div className="space-y-3">
          {videos.slice(0, 4).map(v => {
            const retentionPct = Math.round(40 + Math.random() * 35);
            return (
              <div key={v.id} className="flex items-center gap-3 text-xs">
                <span className="w-40 text-gray-600 line-clamp-1 flex-shrink-0">{v.title}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${retentionPct}%` }} />
                </div>
                <span className="text-gray-500 w-10 text-right">{retentionPct}%</span>
                <span className="text-gray-400">{fmtDuration(v.duration_iso)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">Retention percentages are seeded — sync YouTube Analytics API for real data.</p>
      </div>
    </div>
  );
}

// ─── Tab: Content Strategy ────────────────────────────────────────────────────
function ContentStrategyTab() {
  const [ideas, setIdeas] = useState('');
  const [keywords, setKeywords] = useState('');
  const [keywordTopic, setKeywordTopic] = useState('');
  const [optimizedTitle, setOptimizedTitle] = useState('');
  const [rawTitle, setRawTitle] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  async function callOllama(prompt: string): Promise<string> {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json() as { text?: string; response?: string };
    return data.text || data.response || 'No response generated.';
  }

  async function generateIdeas() {
    setLoading('ideas');
    try {
      const text = await callOllama('Generate 10 YouTube video ideas for a yoga and wellness business. For each include: title (optimized for search), hook, thumbnail concept, target keyword.');
      setIdeas(text);
    } catch { setIdeas('Failed to generate ideas — check AI service.'); }
    finally { setLoading(null); }
  }

  async function researchKeywords() {
    if (!keywordTopic) return;
    setLoading('keywords');
    try {
      const text = await callOllama(`List 15 YouTube search keywords for "${keywordTopic}" sorted by estimated search volume. Include long-tail variations. Format as a numbered list.`);
      setKeywords(text);
    } catch { setKeywords('Failed to research keywords.'); }
    finally { setLoading(null); }
  }

  async function optimizeTitle() {
    if (!rawTitle) return;
    setLoading('title');
    try {
      const text = await callOllama(`Optimize this YouTube title for CTR and SEO: "${rawTitle}". Keep under 60 characters. Give 3 variations, each on a new line.`);
      setOptimizedTitle(text);
    } catch { setOptimizedTitle('Failed to optimize title.'); }
    finally { setLoading(null); }
  }

  const bestTimes = [
    { day: 'Tuesday', time: '2–4 PM', score: 'Best' },
    { day: 'Thursday', time: '2–4 PM', score: 'Best' },
    { day: 'Saturday', time: '10 AM–1 PM', score: 'Good' },
    { day: 'Sunday', time: '3–6 PM', score: 'Good' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">Video Idea Generator</h3>
          <button onClick={generateIdeas} disabled={loading === 'ideas'}
            className="w-full py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {loading === 'ideas' ? 'Generating...' : 'Generate 10 Video Ideas'}
          </button>
          {ideas && (
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {ideas}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">Keyword Research</h3>
          <div className="flex gap-2">
            <input value={keywordTopic} onChange={e => setKeywordTopic(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm" placeholder="e.g. beginner yoga morning" />
            <button onClick={researchKeywords} disabled={loading === 'keywords' || !keywordTopic}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {loading === 'keywords' ? '...' : 'Research'}
            </button>
          </div>
          {keywords && (
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {keywords}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5 space-y-3">
        <h3 className="font-semibold text-gray-700">Title Optimizer</h3>
        <div className="flex gap-2">
          <input value={rawTitle} onChange={e => setRawTitle(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm" placeholder="e.g. Morning yoga for beginners" />
          <button onClick={optimizeTitle} disabled={loading === 'title' || !rawTitle}
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {loading === 'title' ? 'Optimizing...' : 'Optimize'}
          </button>
        </div>
        {optimizedTitle && (
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
            {optimizedTitle}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Best Time to Post</h3>
          <div className="space-y-2">
            {bestTimes.map(t => (
              <div key={t.day} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <span className="font-medium text-gray-700">{t.day}</span>
                <span className="text-gray-500">{t.time}</span>
                <Badge label={t.score} colorClass={t.score === 'Best' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Seeded defaults — sync YouTube Analytics for audience-specific times.</p>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Thumbnail A/B Tracker</h3>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-1 border rounded p-2 text-center">
                <div className="h-16 bg-red-100 rounded mb-1 flex items-center justify-center text-xs text-red-600">Face + Text</div>
                <p className="text-xs font-medium">Style A</p>
                <p className="text-xs text-green-600">CTR: 6.2% ↑</p>
              </div>
              <div className="flex-1 border rounded p-2 text-center">
                <div className="h-16 bg-blue-100 rounded mb-1 flex items-center justify-center text-xs text-blue-600">Action Shot</div>
                <p className="text-xs font-medium">Style B</p>
                <p className="text-xs text-gray-500">CTR: 3.8%</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Style A (face + large text) outperforms by +2.4%. Seeded — update with real test data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Setup ───────────────────────────────────────────────────────────────
function SetupTab({ data }: { data: YTData }) {
  const steps = [
    { done: data.apiKeySet, label: 'YouTube API Key', detail: 'Set YOUTUBE_API_KEY in .env.local. Get it from console.cloud.google.com → Enable YouTube Data API v3.', link: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com' },
    { done: data.oauthSet, label: 'OAuth for Uploads & Comments', detail: 'Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN. Scopes needed: youtube.readonly, youtube.upload, youtube.force-ssl.' },
    { done: Boolean(process.env.YOUTUBE_CHANNEL_ID), label: 'YouTube Channel ID', detail: 'Set YOUTUBE_CHANNEL_ID — find in YouTube Studio → Customization → Basic Info.', link: 'https://studio.youtube.com' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-700 mb-4">YouTube Setup Guide</h3>
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s.done ? '✓' : i + 1}
              </div>
              <div>
                <p className={`font-medium ${s.done ? 'text-green-700' : 'text-gray-700'}`}>{s.label}</p>
                <p className="text-sm text-gray-500">{s.detail}</p>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{s.link}</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-700 mb-4">PubSubHubbub Webhook (New Video Notifications)</h3>
        <p className="text-sm text-gray-600 mb-3">
          YouTube Data API does not support webhooks directly. Use PubSubHubbub to get notified when new videos are published:
        </p>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Go to <a href="https://pubsubhubbub.appspot.com/subscribe" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">pubsubhubbub.appspot.com/subscribe</a></li>
          <li>Topic URL: <code className="bg-gray-100 px-1 rounded text-xs">https://www.youtube.com/xml/feeds/videos.xml?channel_id=YOUR_CHANNEL_ID</code></li>
          <li>Callback URL: <code className="bg-gray-100 px-1 rounded text-xs">{'{domain}'}/api/admin/youtube-integration/webhook</code></li>
        </ol>
        <p className="text-xs text-gray-400 mt-3">Subscribe mode: Subscribe · Verify token: any secret string · Lease seconds: 432000 (5 days, then re-subscribe)</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-700 mb-2">OAuth Setup Steps</h3>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Google Cloud Console → APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID</li>
          <li>Application type: Web application. Add redirect URI: <code className="bg-gray-100 px-1 rounded text-xs">https://developers.google.com/oauthplayground</code></li>
          <li>Go to <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OAuth 2.0 Playground</a> → Settings → use your own OAuth credentials</li>
          <li>Select scopes: YouTube Data API v3 → authorize and exchange for tokens</li>
          <li>Copy the refresh token → set as YOUTUBE_REFRESH_TOKEN in .env.local</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['channel', 'videos', 'comments', 'analytics', 'strategy', 'setup'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  channel: 'Channel Dashboard', videos: 'Videos', comments: 'Comments & Reviews',
  analytics: 'Analytics', strategy: 'Content Strategy', setup: 'Setup',
};

export default function YouTubeIntegrationPage() {
  const [tab, setTab] = useState<Tab>('channel');
  const [data, setData] = useState<YTData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/youtube-integration', { cache: 'no-store' });
      if (res.ok) setData(await res.json() as YTData);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/admin/youtube-integration/sync', { method: 'POST' });
      const result = await res.json() as { synced: Record<string, number>; warnings: string[] };
      setSyncMsg(`Synced: ${result.synced.videos || 0} videos, ${result.synced.comments || 0} comments.${result.warnings?.length ? ' Warnings: ' + result.warnings.join('; ') : ''}`);
      await load();
    } catch { setSyncMsg('Sync failed — check console.'); }
    finally { setSyncing(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading YouTube Integration Hub...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Failed to load YouTube data. Check your database connection.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">YouTube Integration Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">Channel · Videos · Comments · Analytics · Content Strategy</p>
          </div>
          {syncing && <div className="text-sm text-red-600">Syncing...</div>}
        </div>
        {syncMsg && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">{syncMsg}</div>
        )}
      </div>

      <div className="flex">
        {/* Left Nav */}
        <div className="w-52 min-h-screen bg-white border-r flex-shrink-0">
          <nav className="p-3 space-y-1">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {tab === 'channel' && <ChannelDashboardTab data={data} onSync={handleSync} />}
          {tab === 'videos' && <VideosTab videos={data.videos} />}
          {tab === 'comments' && <CommentsTab comments={data.comments} />}
          {tab === 'analytics' && <AnalyticsTab videos={data.videos} />}
          {tab === 'strategy' && <ContentStrategyTab />}
          {tab === 'setup' && <SetupTab data={data} />}
        </div>
      </div>
    </div>
  );
}
