'use client';
// /customer/social — Customer Social Self-Service Portal
// Extended from the original "Follow Us" status page to include:
//   feed | schedule | analytics | content-ideas | hashtags
// The original connected-account status is preserved in the feed tab.

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformStatus {
  platform: string;
  businessUse: string | null;
  connected: boolean;
  accountName: string | null;
  profileUrl: string | null;
}

interface Post {
  id: string; platform: string; status: string; scheduled_at: string;
  caption_preview: string; impressions: number; likes: number;
  comments: number; shares: number;
}

interface AnalyticsRow {
  platform: string; period: string; total_posts: number;
  total_impressions: number; total_reach: number; total_likes: number;
  avg_engagement_rate: number; follower_count: number; follower_delta: number;
}

interface ContentIdea {
  platform: string; content_type: string; hook: string;
  caption_idea: string; suggested_hashtags: string[]; best_time: string;
}

interface HashtagPerf {
  id: string; platform: string; hashtag: string; niche: string;
  avg_reach: number; avg_engagement: number; trending_score: number;
  competition_level: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube',
  telegram: 'Telegram', x_twitter: 'X', tiktok: 'TikTok', discord: 'Discord', bluesky: 'Bluesky',
  reddit: 'Reddit', pinterest: 'Pinterest', threads: 'Threads', whatsapp_business: 'WhatsApp Business',
  snapchat: 'Snapchat', twitch: 'Twitch', medium: 'Medium', substack: 'Substack', quora_manual: 'Quora',
  tumblr: 'Tumblr', mastodon: 'Mastodon', github: 'GitHub', gitlab: 'GitLab',
  google_business: 'Google Business Profile', yelp: 'Yelp', tripadvisor: 'Tripadvisor',
  vimeo: 'Vimeo', spotify: 'Spotify', apple_podcasts: 'Apple Podcasts', patreon: 'Patreon',
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook: '📘', instagram: '📸', linkedin: '💼', youtube: '▶️',
  x_twitter: '🐦', tiktok: '🎵', telegram: '✈️', discord: '💜',
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-red-100 text-red-700', facebook: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700', x_twitter: 'bg-gray-100 text-gray-700',
  linkedin: 'bg-blue-100 text-blue-800', tiktok: 'bg-slate-900 text-white',
};

const MAIN_PLATFORMS = ['youtube', 'facebook', 'instagram', 'x_twitter', 'linkedin', 'tiktok'];

const TABS = [
  { key: 'feed', label: '📰 Feed' },
  { key: 'schedule', label: '📅 Schedule' },
  { key: 'analytics', label: '📊 Analytics' },
  { key: 'content-ideas', label: '💡 Content Ideas' },
  { key: 'hashtags', label: '#️⃣ Hashtags' },
];

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLORS[platform] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium px-2 py-0.5 text-xs ${cls}`}>
      {PLATFORM_ICONS[platform] ?? '📣'} {LABELS[platform] ?? platform}
    </span>
  );
}

// ── Tab: Feed ─────────────────────────────────────────────────────────────────

function FeedTab() {
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[] | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    fetch('/api/customer/social/status', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setPlatformStatuses(d.platforms ?? []); })
      .catch(e => { setStatusError(e.message); setPlatformStatuses([]); });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    fetch(`/api/customer/social/posts?${params}`)
      .then(r => r.json()).then(d => setPosts(d.posts ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [platform]);

  const connected = platformStatuses?.filter(p => p.connected) ?? [];
  const notYet = platformStatuses?.filter(p => !p.connected) ?? [];

  return (
    <div className="space-y-6">
      {statusError && <p className="text-sm text-red-600">{statusError}</p>}

      {platformStatuses !== null && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">Connected Accounts</h3>
          {connected.length === 0 && notYet.length === 0 ? (
            <p className="text-sm text-white/40">No channels configured yet.</p>
          ) : connected.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mb-4">
              No social accounts connected yet. Connecting channels is handled by our team via the admin provisioning workflow.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 mb-4">
              {connected.map(p => (
                <a key={p.platform} href={p.profileUrl ?? '#'} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white border border-green-200 rounded-xl p-3 hover:shadow-sm">
                  <span className="text-lg">{PLATFORM_ICONS[p.platform] ?? '📣'}</span>
                  <div>
                    <div className="font-medium text-sm">{LABELS[p.platform] ?? p.platform}</div>
                    <div className="text-xs text-white/40">{p.accountName ?? 'Connected'}</div>
                  </div>
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                </a>
              ))}
            </div>
          )}

          {notYet.length > 0 && (
            <details className="text-sm text-gray-400 mb-4">
              <summary className="cursor-pointer font-medium text-white/60">Not connected yet ({notYet.length})</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {notYet.map(p => (
                  <span key={p.platform} className="bg-gray-100 rounded-full px-3 py-1 text-xs">{LABELS[p.platform] ?? p.platform}</span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">Published Posts</h3>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Platforms</option>
            {MAIN_PLATFORMS.map(p => <option key={p} value={p}>{LABELS[p]}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">No published posts found.</div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlatformBadge platform={post.platform} />
                    <span className="text-xs text-white/40">{new Date(post.scheduled_at).toLocaleDateString()}</span>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">{post.status}</span>
                </div>
                <p className="mt-2 text-sm text-gray-700 line-clamp-2">{post.caption_preview}</p>
                <div className="mt-3 flex gap-4 text-xs text-white/60">
                  <span>👁️ {Number(post.impressions).toLocaleString()}</span>
                  <span>❤️ {Number(post.likes).toLocaleString()}</span>
                  <span>💬 {Number(post.comments).toLocaleString()}</span>
                  <span>🔄 {Number(post.shares).toLocaleString()}</span>
                </div>
                <button className="mt-2 text-xs text-blue-600 hover:underline">Boost Post →</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Schedule ─────────────────────────────────────────────────────────────

function ScheduleTab() {
  const [form, setForm] = useState({ platform: 'instagram', content_type: 'reel', caption: '', scheduled_at: '', hashtags: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [permStatus, setPermStatus] = useState<{ allowed: boolean; requires_approval: boolean } | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  const CONTENT_TYPES: Record<string, string[]> = {
    instagram: ['reel', 'image_post', 'carousel', 'story'],
    facebook: ['image_post', 'text_post', 'reel', 'story'],
    youtube: ['video_post', 'short'],
    x_twitter: ['tweet', 'thread'],
    linkedin: ['text_post', 'article', 'document_post'],
    tiktok: ['video_post'],
  };

  // Map content_type to feature_type for permission check
  const toFeatureType = (ct: string): string => {
    if (['tweet','thread','short'].includes(ct)) return 'text_post';
    return ct;
  };

  // Check permissions when platform or content_type changes
  useEffect(() => {
    const ft = toFeatureType(form.content_type);
    setPermLoading(true);
    fetch('/api/admin/platform-scenarios/check-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: form.platform, feature_type: ft, actor_type: 'customer' }),
    })
      .then(r => r.json())
      .then((d: { allowed: boolean; requires_approval: boolean }) => { setPermStatus(d); setPermLoading(false); })
      .catch(() => setPermLoading(false));
  }, [form.platform, form.content_type]);

  const submit = async () => {
    if (!form.caption || !form.scheduled_at) { setError('Caption and scheduled time are required'); return; }
    setSubmitting(true); setSuccess(''); setError('');
    // Use the new gated endpoint
    type PostResp = { status?: string; message?: string; error?: string };
    const resp: PostResp = await fetch('/api/customer/social/post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: form.platform,
        feature_type: toFeatureType(form.content_type),
        input_data: {
          caption: form.caption,
          schedule_at: form.scheduled_at,
          hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean),
        },
      }),
    }).then(r => r.json() as Promise<PostResp>).catch(() => ({ error: 'Request failed' }));
    setSubmitting(false);
    if (resp.error) setError(resp.error);
    else {
      setSuccess(resp.message ?? 'Post submitted successfully!');
      setForm(f => ({ ...f, caption: '', scheduled_at: '', hashtags: '' }));
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <h3 className="text-base font-semibold text-gray-800">Schedule a New Post</h3>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Platform</label>
        <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value, content_type: CONTENT_TYPES[e.target.value]?.[0] ?? 'text_post' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MAIN_PLATFORMS.map(p => <option key={p} value={p}>{LABELS[p]}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Content Type</label>
        <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {(CONTENT_TYPES[form.platform] ?? ['text_post']).map(ct => <option key={ct} value={ct}>{ct}</option>)}
        </select>
      </div>

      {/* Permission status notice */}
      {!permLoading && permStatus && (
        permStatus.allowed ? (
          permStatus.requires_approval ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm flex items-start gap-2">
              <span>⏳</span>
              <span>Your posts require <strong>admin approval</strong> before publishing. Submit and an admin will review your post.</span>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-start gap-2">
              <span>✅</span>
              <span>Posting is enabled. Your post will be scheduled immediately.</span>
            </div>
          )
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
            <span>🔒</span>
            <span>This feature is not available for your account. Contact your admin.</span>
          </div>
        )
      )}

      <div>
        <label className="block text-sm text-gray-600 mb-1">Caption *</label>
        <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-32 resize-none" placeholder="Write your post caption..." />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Hashtags (space or comma separated)</label>
        <input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="yoga wellness mindfulness" />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Schedule At *</label>
        <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}

      <button
        onClick={() => void submit()}
        disabled={submitting || permLoading || (permStatus !== null && !permStatus.allowed)}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : permStatus?.requires_approval ? 'Submit for Approval' : 'Schedule Post'}
      </button>
    </div>
  );
}

// ── Tab: Analytics ────────────────────────────────────────────────────────────

function CustomerAnalyticsTab() {
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const period = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetch('/api/customer/social/analytics')
      .then(r => r.json()).then(d => setAnalytics(d.analytics ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Your Analytics — {period}</h3>
        <button className="text-sm text-blue-600 hover:underline">Request Full Report →</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading analytics...</div>
      ) : analytics.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 text-center text-gray-400 text-sm">
          No analytics data yet. Analytics populate as posts are published and synced by the scheduled jobs.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="pb-2 pr-4">Platform</th>
              <th className="pb-2 pr-4">Posts</th>
              <th className="pb-2 pr-4">Impressions</th>
              <th className="pb-2 pr-4">Reach</th>
              <th className="pb-2 pr-4">Likes</th>
              <th className="pb-2 pr-4">Engagement</th>
              <th className="pb-2">Follower Δ</th>
            </tr></thead>
            <tbody>
              {analytics.map(row => (
                <tr key={row.platform} className="border-b border-gray-100">
                  <td className="py-2 pr-4"><PlatformBadge platform={row.platform} /></td>
                  <td className="py-2 pr-4">{row.total_posts}</td>
                  <td className="py-2 pr-4">{Number(row.total_impressions).toLocaleString()}</td>
                  <td className="py-2 pr-4">{Number(row.total_reach).toLocaleString()}</td>
                  <td className="py-2 pr-4">{Number(row.total_likes).toLocaleString()}</td>
                  <td className="py-2 pr-4">{Number(row.avg_engagement_rate).toFixed(2)}%</td>
                  <td className={`py-2 font-medium ${Number(row.follower_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(row.follower_delta) >= 0 ? '+' : ''}{row.follower_delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Content Ideas ────────────────────────────────────────────────────────

function ContentIdeasTab() {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState('yoga');
  const [platform, setPlatform] = useState('instagram');
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/customer/social/content-ideas?niche=${niche}&platform=${platform}`)
      .then(r => r.json()).catch(() => ({ ideas: [] }));
    setIdeas(data.ideas ?? []);
    setLoading(false);
  }, [niche, platform]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={niche} onChange={e => setNiche(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {['yoga', 'fitness', 'wellness', 'marketing'].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MAIN_PLATFORMS.map(p => <option key={p} value={p}>{LABELS[p]}</option>)}
        </select>
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
          {loading ? 'Generating...' : '✨ Refresh Ideas'}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Generating ideas with Ollama AI...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ideas.map((idea, i) => (
            <div key={i}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition-all ${selectedIdea === idea ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
              onClick={() => setSelectedIdea(idea === selectedIdea ? null : idea)}>
              <div className="flex items-center gap-2 mb-2">
                <PlatformBadge platform={idea.platform} />
                <span className="text-xs text-white/40">{idea.content_type}</span>
              </div>
              <div className="font-semibold text-gray-800 text-sm mb-1">💡 {idea.hook}</div>
              <div className="text-xs text-gray-600 mb-2">{idea.caption_idea}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(idea.suggested_hashtags ?? []).map(h => (
                  <span key={h} className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">#{h}</span>
                ))}
              </div>
              {idea.best_time && <div className="text-xs text-white/40">⏰ {idea.best_time}</div>}
              {selectedIdea === idea && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    alert(`Use idea: "${idea.hook}"\n\nCaption idea: ${idea.caption_idea}\n\nCopy the caption and go to the Schedule tab to post it.`);
                  }}
                  className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Use This Idea →
                </button>
              )}
            </div>
          ))}
          {ideas.length === 0 && !loading && (
            <div className="col-span-2 text-center text-gray-400 py-8">No ideas generated. Click "Refresh Ideas" above.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Hashtags ─────────────────────────────────────────────────────────────

function CustomerHashtagsTab() {
  const [hashtags, setHashtags] = useState<HashtagPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('instagram');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/social-intelligence/hashtags?platform=${platform}&niche=yoga`)
      .then(r => r.json()).then(d => setHashtags(d.hashtags ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [platform]);

  const toggle = (hashtag: string) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(hashtag)) next.delete(hashtag);
      else if (next.size < 30) next.add(hashtag);
      return next;
    });
  };

  const copyAll = () => {
    const text = [...selected].map(h => `#${h}`).join(' ');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MAIN_PLATFORMS.map(p => <option key={p} value={p}>{LABELS[p]}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={copyAll} className={`px-4 py-2 rounded-lg text-sm font-medium ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {copied ? '✓ Copied!' : `Copy ${selected.size} Hashtags`}
          </button>
        )}
        <span className="text-xs text-white/40">Click to select up to 30</span>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="text-xs font-medium text-blue-700 mb-1">Selected ({selected.size}/30):</div>
          <div className="flex flex-wrap gap-1">
            {[...selected].map(h => (
              <span key={h} onClick={() => toggle(h)} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 cursor-pointer hover:bg-blue-700">
                #{h} ×
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading hashtags...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {hashtags.map(ht => (
            <div
              key={ht.id}
              onClick={() => toggle(ht.hashtag)}
              className={`p-3 rounded-xl border cursor-pointer transition-all text-sm ${selected.has(ht.hashtag) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="font-semibold text-blue-600">#{ht.hashtag}</div>
              <div className="text-xs text-gray-400 mt-0.5">{Number(ht.avg_reach).toLocaleString()} avg reach</div>
              <div className={`text-xs mt-0.5 font-medium ${ht.competition_level === 'low' ? 'text-green-600' : ht.competition_level === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                {ht.competition_level} competition
              </div>
            </div>
          ))}
          {hashtags.length === 0 && (
            <div className="col-span-4 text-center text-gray-400 py-8 text-sm">
              No hashtags yet. Ask your admin to seed platform configs.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerSocialPage() {
  const [activeTab, setActiveTab] = useState('feed');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-white">Social Media</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your social presence — posts, schedule, analytics, content ideas</p>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl">
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'analytics' && <CustomerAnalyticsTab />}
        {activeTab === 'content-ideas' && <ContentIdeasTab />}
        {activeTab === 'hashtags' && <CustomerHashtagsTab />}
      </div>
    </div>
  );
}
