'use client';
// /admin/social-intelligence — Social Media Platform Intelligence System
// 12-tab hub for YouTube, Facebook, Instagram, Twitter/X, LinkedIn, TikTok
// Covers: content composer, calendar, analytics, agentic generation,
//         hashtags, testing, alerts, tenant scenarios, reports.
// Does NOT overwrite /admin/social — this is a separate dedicated page.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContentTypeConfig {
  id: string; platform: string; content_type: string; display_name: string;
  max_chars: number | null; max_images: number; max_duration_seconds: number | null;
  supported_aspect_ratios: string[]; required_fields: string[]; optional_fields: string[];
  best_posting_times: string[]; avg_engagement_rate: number; tips: string[];
}

interface PlatformAnalytics {
  id: string; platform: string; period: string; total_posts: number;
  total_impressions: number; total_reach: number; total_likes: number;
  total_comments: number; total_shares: number; avg_engagement_rate: number;
  follower_count: number; follower_delta: number;
  yt_watch_time_hours?: number; yt_avg_view_duration?: number; yt_ctr?: number;
  yt_revenue?: number; yt_subscribers_gained?: number;
  tt_play_count?: number; tt_completion_rate?: number; tt_profile_visits?: number;
  ig_story_views?: number; ig_reel_plays?: number; ig_profile_visits?: number;
  li_article_views?: number; li_connection_requests?: number; li_company_page_views?: number;
  tw_retweets?: number; tw_quote_tweets?: number; tw_link_clicks?: number; tw_profile_visits?: number;
}

interface CalendarEntry {
  id: string; platform: string; content_type: string; title: string | null;
  caption_preview: string | null; color_tag: string; scheduled_at: string; status: string;
}

interface ContentVariant {
  id: string; platform: string; content_type: string; caption: string;
  title: string | null; hashtags: string[]; status: string; char_count: number;
  ai_generated: boolean; created_at: string;
}

interface HashtagPerf {
  id: string; platform: string; hashtag: string; niche: string;
  avg_reach: number; avg_engagement: number; post_count_this_week: number;
  trending_score: number; competition_level: string; recommended_for: string[];
}

interface TestScenario {
  id: string; platform: string; content_type: string; scenario_name: string;
  polarity: string; test_level: string; status: string; last_run_at: string | null;
  steps: Array<{ step: number; action: string; detail?: string }>;
  expected_result: string; api_endpoint: string | null; http_method: string | null;
  test_payload: Record<string, unknown>;
}

interface AlertRule {
  id: string; platform: string | null; alert_type: string; metric: string;
  threshold_value: number; comparison: string; window_minutes: number;
  severity: string; notification_channels: string[]; is_active: boolean;
  last_triggered_at: string | null;
}

interface TenantConfig {
  id: string; tenant_type: string; platform: string; posting_frequency: string;
  primary_content_types: string[]; tone: string; top_hashtags: string[];
  best_times: string[]; kpi_focus: string; notes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ['youtube', 'facebook', 'instagram', 'x_twitter', 'linkedin', 'tiktok'];
const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram',
  x_twitter: 'Twitter/X', linkedin: 'LinkedIn', tiktok: 'TikTok',
};
const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-red-100 text-red-700', facebook: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700', x_twitter: 'bg-gray-100 text-gray-700',
  linkedin: 'bg-blue-100 text-blue-800', tiktok: 'bg-black text-white',
};
const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶️', facebook: '📘', instagram: '📸', x_twitter: '🐦',
  linkedin: '💼', tiktok: '🎵',
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'content-composer', label: 'Content Composer' },
  { key: 'content-calendar', label: 'Calendar' },
  { key: 'per-platform', label: 'Per Platform' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'agentic-content', label: 'Agentic AI' },
  { key: 'hashtags', label: 'Hashtags' },
  { key: 'testing', label: 'Testing' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'tenant-scenarios', label: 'Tenant Scenarios' },
  { key: 'scenarios', label: 'Scenarios' },
  { key: 'reports', label: 'Reports' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function PlatformBadge({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'xs' }) {
  const cls = PLATFORM_COLORS[platform] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium px-2 py-0.5 ${size === 'xs' ? 'text-xs' : 'text-xs'} ${cls}`}>
      {PLATFORM_ICONS[platform] ?? '📣'} {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function PolarityBadge({ polarity }: { polarity: string }) {
  const colors: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    negative: 'bg-red-100 text-red-700',
    boundary: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${colors[polarity] ?? 'bg-gray-100 text-gray-600'}`}>
      {polarity}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${colors[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', ready: 'bg-blue-100 text-blue-600',
    scheduled: 'bg-indigo-100 text-indigo-600', published: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700', pass: 'bg-green-100 text-green-700',
    fail: 'bg-red-100 text-red-700', pending: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50', green: 'border-green-500 bg-green-50',
    purple: 'border-purple-500 bg-purple-50', orange: 'border-orange-500 bg-orange-50',
    red: 'border-red-500 bg-red-50', gray: 'border-gray-300 bg-gray-50',
  };
  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-800 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ analytics, configs }: { analytics: PlatformAnalytics[]; configs: ContentTypeConfig[] }) {
  const totalPosts = analytics.reduce((s, r) => s + Number(r.total_posts), 0);
  const totalReach = analytics.reduce((s, r) => s + Number(r.total_reach), 0);
  const avgEng = analytics.length
    ? (analytics.reduce((s, r) => s + Number(r.avg_engagement_rate), 0) / analytics.length).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Posts (Month)" value={totalPosts} color="blue" />
        <KpiCard label="Total Reach" value={totalReach.toLocaleString()} color="green" />
        <KpiCard label="Avg Engagement Rate" value={`${avgEng}%`} color="purple" />
        <KpiCard label="Platforms Active" value={analytics.length} color="orange" />
        <KpiCard label="Config Types" value={configs.length} color="gray" />
        <KpiCard label="Analytics Rows" value={analytics.length} color="blue" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Platform Status Grid</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PLATFORMS.map(platform => {
            const pa = analytics.find(a => a.platform === platform);
            return (
              <div key={platform} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{PLATFORM_ICONS[platform]}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{PLATFORM_LABELS[platform]}</div>
                    <div className="text-xs text-gray-400">{platform}</div>
                  </div>
                </div>
                {pa ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Followers</span><span className="font-medium">{Number(pa.follower_count).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Posts (Month)</span><span className="font-medium">{pa.total_posts}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Avg Engagement</span><span className="font-medium">{Number(pa.avg_engagement_rate).toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Reach</span><span className="font-medium">{Number(pa.total_reach).toLocaleString()}</span></div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic">No analytics data yet</div>
                )}
                <Link href={`/admin/social/${platform}`} className="mt-3 text-xs text-blue-600 hover:underline block">
                  View Details →
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-medium text-blue-800 mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={async () => { await fetch('/api/admin/social-intelligence/seed-configs', { method: 'POST' }); alert('Configs seeded!'); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Seed Platform Configs
          </button>
          <button onClick={async () => { await fetch('/api/admin/social-intelligence/seed-tests', { method: 'POST' }); alert('Test scenarios seeded!'); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            Seed Test Scenarios
          </button>
          <button onClick={async () => { await fetch('/api/admin/social-intelligence/analytics-sync', { method: 'POST' }); alert('Analytics synced!'); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            Sync Analytics Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Content Composer ─────────────────────────────────────────────────────

const PLATFORM_CONTENT_TYPE_OPTIONS: Record<string, string[]> = {
  youtube: ['video_post', 'short', 'live', 'community_post'],
  facebook: ['text_post', 'image_post', 'video_post', 'carousel', 'story', 'reel', 'poll'],
  instagram: ['image_post', 'carousel', 'reel', 'story', 'shopping_post'],
  x_twitter: ['tweet', 'thread', 'poll', 'image_tweet'],
  linkedin: ['text_post', 'article', 'document_post', 'video_post', 'newsletter'],
  tiktok: ['video_post', 'live', 'photo_post'],
};

const CHAR_LIMITS: Record<string, Record<string, number>> = {
  youtube: { video_post: 5000, short: 100, live: 500, community_post: 5000 },
  facebook: { text_post: 63206, image_post: 63206, carousel: 63206, story: 15, reel: 2200, poll: 500 },
  instagram: { image_post: 2200, carousel: 2200, reel: 2200, story: 150, shopping_post: 2200 },
  x_twitter: { tweet: 280, thread: 280, poll: 280, image_tweet: 280 },
  linkedin: { text_post: 3000, article: 120000, document_post: 3000, video_post: 3000, newsletter: 120000 },
  tiktok: { video_post: 2200, live: 500, photo_post: 2200 },
};

function ContentComposerTab({ configs }: { configs: ContentTypeConfig[] }) {
  const [masterCaption, setMasterCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram']);
  const [contentTypes, setContentTypes] = useState<Record<string, string>>({ instagram: 'reel' });
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saved, setSaved] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(p => p.filter(x => x !== platform));
    } else {
      setSelectedPlatforms(p => [...p, platform]);
      if (!contentTypes[platform]) {
        setContentTypes(ct => ({ ...ct, [platform]: PLATFORM_CONTENT_TYPE_OPTIONS[platform]?.[0] ?? 'text_post' }));
      }
    }
  };

  const saveVariants = async () => {
    setSaving(true); setSaved('');
    for (const platform of selectedPlatforms) {
      const ct = contentTypes[platform] ?? 'text_post';
      await fetch('/api/admin/social-intelligence/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content_type: ct, caption: masterCaption, status: 'draft' }),
      });
    }
    setSaving(false); setSaved(`Saved ${selectedPlatforms.length} variants as drafts`);
  };

  const scheduleAll = async () => {
    if (!scheduledAt) { alert('Pick a scheduled date/time first'); return; }
    setScheduling(true);
    for (const platform of selectedPlatforms) {
      const ct = contentTypes[platform] ?? 'text_post';
      await fetch('/api/admin/social-intelligence/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content_type: ct, caption_preview: masterCaption.slice(0, 120), scheduled_at: scheduledAt }),
      });
    }
    setScheduling(false); setSaved(`Scheduled ${selectedPlatforms.length} posts`);
  };

  const generateAI = async () => {
    setAiLoading(true);
    for (const platform of selectedPlatforms) {
      const ct = contentTypes[platform] ?? 'text_post';
      const resp = await fetch('/api/admin/social-intelligence/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content_type: ct, topic: masterCaption || 'morning yoga', tone: 'inspirational', niche: 'yoga' }),
      }).then(r => r.json()).catch(() => null);
      if (resp?.caption && !masterCaption) setMasterCaption(resp.caption);
    }
    setAiLoading(false);
  };

  return (
    <div className="flex gap-6">
      {/* Left panel */}
      <div className="w-2/5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Master Caption / Text</label>
          <textarea
            value={masterCaption}
            onChange={e => setMasterCaption(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm h-40 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Write your main content here. Platform previews will adapt it..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(platform => (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedPlatforms.includes(platform) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {PLATFORM_ICONS[platform]} {PLATFORM_LABELS[platform]}
              </button>
            ))}
          </div>
        </div>

        {selectedPlatforms.map(platform => (
          <div key={platform}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{PLATFORM_LABELS[platform]} Content Type</label>
            <select
              value={contentTypes[platform] ?? ''}
              onChange={e => setContentTypes(ct => ({ ...ct, [platform]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            >
              {(PLATFORM_CONTENT_TYPE_OPTIONS[platform] ?? []).map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule At</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{saved}</div>}

        <div className="flex flex-col gap-2">
          <button onClick={generateAI} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 font-medium">
            {aiLoading ? 'Generating...' : '✨ Generate with AI (Ollama)'}
          </button>
          <button onClick={saveVariants} disabled={saving} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : '💾 Save as Variant'}
          </button>
          <button onClick={scheduleAll} disabled={scheduling} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 font-medium">
            {scheduling ? 'Scheduling...' : '📅 Schedule All'}
          </button>
        </div>
      </div>

      {/* Right panel: platform previews */}
      <div className="w-3/5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Platform Previews</h3>
        {selectedPlatforms.length === 0 && (
          <div className="text-gray-400 text-sm italic">Select platforms on the left to see previews</div>
        )}
        {selectedPlatforms.map(platform => {
          const ct = contentTypes[platform] ?? 'text_post';
          const limit = CHAR_LIMITS[platform]?.[ct] ?? 2200;
          const overLimit = masterCaption.length > limit;
          const preview = masterCaption.slice(0, limit);

          return (
            <div key={platform} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <PlatformBadge platform={platform} />
                <span className="text-xs text-gray-400">{ct}</span>
              </div>

              {platform === 'youtube' && (
                <div className="space-y-2">
                  <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-gray-400 text-sm">Thumbnail Preview</div>
                  <div className="font-semibold text-gray-800 text-sm">{preview.slice(0, 80) || 'Video Title'}</div>
                  <div className="text-xs text-gray-500 line-clamp-3">{preview || 'Video description will appear here...'}</div>
                </div>
              )}
              {platform === 'instagram' && (
                <div className="space-y-2">
                  <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center text-gray-400 text-sm">📸 Image/Reel</div>
                  <div className="text-xs text-gray-700 line-clamp-3">{preview || 'Caption with #hashtags will appear here...'}</div>
                </div>
              )}
              {platform === 'x_twitter' && (
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-800">Your Account <span className="text-gray-400 font-normal">@handle · now</span></div>
                      <div className="text-sm text-gray-700 mt-1">{preview || 'Your tweet will appear here...'}</div>
                    </div>
                  </div>
                </div>
              )}
              {platform === 'linkedin' && (
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-10 h-10 bg-blue-200 rounded-full shrink-0" />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">Your Name</div>
                      <div className="text-xs text-gray-400">Your Title • Now</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 line-clamp-5">{preview || 'Your LinkedIn post will appear here...'}</div>
                </div>
              )}
              {platform === 'tiktok' && (
                <div className="bg-black rounded-xl" style={{ aspectRatio: '9/16', maxHeight: 220 }}>
                  <div className="h-full flex items-end p-3">
                    <div className="text-white text-xs line-clamp-3">{preview || 'TikTok caption here...'}</div>
                  </div>
                </div>
              )}
              {platform === 'facebook' && (
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-blue-100 rounded-full" />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">Your Page</div>
                      <div className="text-xs text-gray-400">Just now · 🌎</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 line-clamp-4">{preview || 'Your Facebook post...'}</div>
                </div>
              )}

              <div className={`mt-2 text-right text-xs font-medium ${overLimit ? 'text-red-600' : 'text-gray-400'}`}>
                {masterCaption.length} / {limit} chars {overLimit && '⚠️ OVER LIMIT'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Content Calendar ─────────────────────────────────────────────────────

function ContentCalendarTab() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('');
  const [newEntry, setNewEntry] = useState({ platform: 'instagram', content_type: 'reel', caption_preview: '', scheduled_at: '' });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/admin/social-intelligence/calendar${platformFilter ? `?platform=${platformFilter}` : ''}`;
    const data = await fetch(url).then(r => r.json()).catch(() => ({ entries: [] }));
    setEntries(data.entries ?? []);
    setLoading(false);
  }, [platformFilter]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newEntry.scheduled_at) { alert('Scheduled time required'); return; }
    setAdding(true);
    await fetch('/api/admin/social-intelligence/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newEntry),
    });
    setAdding(false); setShowForm(false); load();
  };

  const cancel = async (id: string) => {
    await fetch(`/api/admin/social-intelligence/calendar/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }),
    });
    load();
  };

  // Group by week for calendar view
  const upcomingDays: Record<string, CalendarEntry[]> = {};
  entries.forEach(e => {
    const day = new Date(e.scheduled_at).toISOString().slice(0, 10);
    if (!upcomingDays[day]) upcomingDays[day] = [];
    upcomingDays[day].push(e);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 items-center">
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(f => !f)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add to Calendar
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-blue-800">New Calendar Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <select value={newEntry.platform} onChange={e => setNewEntry(n => ({ ...n, platform: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
            </select>
            <input value={newEntry.content_type} onChange={e => setNewEntry(n => ({ ...n, content_type: e.target.value }))} placeholder="content_type (reel, tweet, etc)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input value={newEntry.caption_preview} onChange={e => setNewEntry(n => ({ ...n, caption_preview: e.target.value }))} placeholder="Caption preview" className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2" />
            <input type="datetime-local" value={newEntry.scheduled_at} onChange={e => setNewEntry(n => ({ ...n, scheduled_at: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={adding} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {adding ? 'Adding...' : 'Add Entry'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading calendar...</div>
      ) : (
        <>
          {Object.keys(upcomingDays).length === 0 && (
            <div className="text-center text-gray-400 py-8">No upcoming scheduled posts. Add entries above.</div>
          )}
          <div className="space-y-4">
            {Object.entries(upcomingDays).sort().map(([day, dayEntries]) => (
              <div key={day}>
                <div className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">
                  {new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-2">
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: entry.color_tag }} />
                      <PlatformBadge platform={entry.platform} />
                      <span className="text-xs text-gray-500">{entry.content_type}</span>
                      <span className="text-sm text-gray-700 flex-1">{entry.caption_preview ?? entry.title ?? '(no preview)'}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      <StatusBadge status={entry.status} />
                      {entry.status === 'scheduled' && (
                        <button onClick={() => cancel(entry.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Per Platform ─────────────────────────────────────────────────────────

function PerPlatformTab({ configs, analytics }: { configs: ContentTypeConfig[]; analytics: PlatformAnalytics[] }) {
  const [activePlatform, setActivePlatform] = useState('youtube');
  const [section, setSection] = useState('content-types');
  const [tenantConfigs, setTenantConfigs] = useState<TenantConfig[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);

  useEffect(() => {
    fetch(`/api/admin/social-intelligence/tenant-config?platform=${activePlatform}`)
      .then(r => r.json()).then(d => setTenantConfigs(d.configs ?? [])).catch(() => {});
    fetch(`/api/admin/social-intelligence/test-scenarios?platform=${activePlatform}&limit=20`)
      .then(r => r.json()).then(d => setScenarios(d.scenarios ?? [])).catch(() => {});
  }, [activePlatform]);

  const platformConfigs = configs.filter(c => c.platform === activePlatform);
  const platformAnalytics = analytics.find(a => a.platform === activePlatform);

  const SECTIONS = ['content-types', 'analytics', 'scenarios', 'tenant-usage'];

  return (
    <div>
      {/* Platform selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setActivePlatform(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activePlatform === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Section selector */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${section === s ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {s.replace(/-/g, ' ')}
          </button>
        ))}
      </div>

      {section === 'content-types' && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">{PLATFORM_LABELS[activePlatform]} Content Types</h3>
          {platformConfigs.length === 0 ? (
            <div className="text-gray-400 text-sm italic">No configs yet. Click "Seed Platform Configs" on the Overview tab.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-4">Content Type</th>
                  <th className="pb-2 pr-4">Max Chars</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Aspect Ratios</th>
                  <th className="pb-2 pr-4">Best Times</th>
                  <th className="pb-2 pr-4">Engagement</th>
                  <th className="pb-2">Tips</th>
                </tr></thead>
                <tbody>
                  {platformConfigs.map(cfg => (
                    <tr key={cfg.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{cfg.display_name}</td>
                      <td className="py-2 pr-4">{cfg.max_chars?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4">{cfg.max_duration_seconds ? `${cfg.max_duration_seconds}s` : '—'}</td>
                      <td className="py-2 pr-4">{cfg.supported_aspect_ratios.join(', ') || '—'}</td>
                      <td className="py-2 pr-4 text-xs">{cfg.best_posting_times.slice(0, 2).join(' · ')}</td>
                      <td className="py-2 pr-4">{Number(cfg.avg_engagement_rate).toFixed(1)}%</td>
                      <td className="py-2 text-xs text-gray-500 max-w-xs">
                        {cfg.tips.slice(0, 1).join(' · ')}
                        {cfg.tips.length > 1 && <span className="text-blue-500"> +{cfg.tips.length - 1} more</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {section === 'analytics' && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">{PLATFORM_LABELS[activePlatform]} Analytics</h3>
          {!platformAnalytics ? (
            <div className="text-gray-400 text-sm italic">No analytics data yet. Run "Sync Analytics Now" on Overview.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Posts" value={platformAnalytics.total_posts} color="blue" />
                <KpiCard label="Total Impressions" value={Number(platformAnalytics.total_impressions).toLocaleString()} color="green" />
                <KpiCard label="Avg Engagement" value={`${Number(platformAnalytics.avg_engagement_rate).toFixed(2)}%`} color="purple" />
                <KpiCard label="Reach" value={Number(platformAnalytics.total_reach).toLocaleString()} color="orange" />
              </div>
              {activePlatform === 'youtube' && platformAnalytics.yt_watch_time_hours !== undefined && (
                <div className="grid grid-cols-3 gap-4">
                  <KpiCard label="Watch Time (hrs)" value={Number(platformAnalytics.yt_watch_time_hours).toFixed(1)} color="red" />
                  <KpiCard label="CTR" value={`${Number(platformAnalytics.yt_ctr).toFixed(2)}%`} color="orange" />
                  <KpiCard label="Subscribers Gained" value={platformAnalytics.yt_subscribers_gained ?? 0} color="green" />
                </div>
              )}
              {activePlatform === 'tiktok' && (
                <div className="grid grid-cols-3 gap-4">
                  <KpiCard label="Play Count" value={Number(platformAnalytics.tt_play_count ?? 0).toLocaleString()} color="blue" />
                  <KpiCard label="Completion Rate" value={`${Number(platformAnalytics.tt_completion_rate ?? 0).toFixed(1)}%`} color="green" />
                  <KpiCard label="Profile Visits" value={Number(platformAnalytics.tt_profile_visits ?? 0).toLocaleString()} color="purple" />
                </div>
              )}
              {activePlatform === 'linkedin' && (
                <div className="grid grid-cols-3 gap-4">
                  <KpiCard label="Article Views" value={Number(platformAnalytics.li_article_views ?? 0).toLocaleString()} color="blue" />
                  <KpiCard label="Connection Requests" value={platformAnalytics.li_connection_requests ?? 0} color="green" />
                  <KpiCard label="Company Page Views" value={Number(platformAnalytics.li_company_page_views ?? 0).toLocaleString()} color="purple" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {section === 'scenarios' && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">{PLATFORM_LABELS[activePlatform]} Test Scenarios</h3>
          {scenarios.length === 0 ? (
            <div className="text-gray-400 text-sm italic">No test scenarios yet. Click "Seed Test Scenarios" on Overview.</div>
          ) : (
            <div className="space-y-2">
              {scenarios.slice(0, 15).map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PolarityBadge polarity={s.polarity} />
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{s.test_level}</span>
                    <span className="text-gray-700 font-medium">{s.scenario_name.replace(/^TC-[A-Z]+-\d+:\s*/, '')}</span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'tenant-usage' && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">{PLATFORM_LABELS[activePlatform]} Tenant Usage</h3>
          {tenantConfigs.length === 0 ? (
            <div className="text-gray-400 text-sm italic">No tenant configs. Click "Seed Platform Configs" first.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-4">Tenant Type</th>
                  <th className="pb-2 pr-4">Frequency</th>
                  <th className="pb-2 pr-4">Primary Types</th>
                  <th className="pb-2 pr-4">Tone</th>
                  <th className="pb-2 pr-4">Top Hashtags</th>
                  <th className="pb-2 pr-4">Best Times</th>
                  <th className="pb-2">KPI Focus</th>
                </tr></thead>
                <tbody>
                  {tenantConfigs.map(tc => (
                    <tr key={tc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium capitalize">{tc.tenant_type.replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-4">{tc.posting_frequency}</td>
                      <td className="py-2 pr-4 text-xs">{tc.primary_content_types.slice(0, 2).join(', ')}</td>
                      <td className="py-2 pr-4">{tc.tone}</td>
                      <td className="py-2 pr-4 text-xs">{tc.top_hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}</td>
                      <td className="py-2 pr-4 text-xs">{tc.best_times.slice(0, 2).join(' · ')}</td>
                      <td className="py-2 font-medium text-blue-600">{tc.kpi_focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Analytics ────────────────────────────────────────────────────────────

function AnalyticsTab({ analytics }: { analytics: PlatformAnalytics[] }) {
  const maxReach = analytics.reduce((m, r) => Math.max(m, Number(r.total_reach)), 0);
  const maxEng = analytics.reduce((m, r) => Math.max(m, Number(r.avg_engagement_rate)), 0);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-800">Cross-Platform Analytics Comparison</h3>
      {analytics.length === 0 ? (
        <div className="text-gray-400 text-sm italic">No analytics data. Run "Sync Analytics Now" on Overview tab first.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="pb-2 pr-4">Platform</th>
              <th className="pb-2 pr-4">Posts</th>
              <th className="pb-2 pr-4">Impressions</th>
              <th className="pb-2 pr-4">Reach</th>
              <th className="pb-2 pr-4">Likes</th>
              <th className="pb-2 pr-4">Comments</th>
              <th className="pb-2 pr-4">Shares</th>
              <th className="pb-2 pr-4">Engagement</th>
              <th className="pb-2">Follower Δ</th>
            </tr></thead>
            <tbody>
              {analytics.map(row => {
                const isBestReach = Number(row.total_reach) === maxReach;
                const isBestEng = Number(row.avg_engagement_rate) === maxEng;
                return (
                  <tr key={row.platform} className={`border-b border-gray-100 ${isBestReach || isBestEng ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <td className="py-2 pr-4"><PlatformBadge platform={row.platform} /></td>
                    <td className="py-2 pr-4">{row.total_posts}</td>
                    <td className="py-2 pr-4">{Number(row.total_impressions).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      {Number(row.total_reach).toLocaleString()}
                      {isBestReach && <span className="ml-1 text-xs text-green-600 font-bold">★ Best</span>}
                    </td>
                    <td className="py-2 pr-4">{Number(row.total_likes).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(row.total_comments).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(row.total_shares).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      {Number(row.avg_engagement_rate).toFixed(2)}%
                      {isBestEng && <span className="ml-1 text-xs text-green-600 font-bold">★ Best</span>}
                    </td>
                    <td className={`py-2 font-medium ${Number(row.follower_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(row.follower_delta) >= 0 ? '+' : ''}{row.follower_delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Agentic Content ──────────────────────────────────────────────────────

interface GeneratedContent { platform: string; content_type: string; caption: string; hashtags: string[]; suggested_time: string; char_count: number; max_chars: number; }

function AgenticContentTab() {
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('yoga');
  const [tone, setTone] = useState('inspirational');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'linkedin']);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedContent[]>([]);
  const [editedCaptions, setEditedCaptions] = useState<Record<string, string>>({});

  const togglePlatform = (p: string) => setSelectedPlatforms(sp => sp.includes(p) ? sp.filter(x => x !== p) : [...sp, p]);

  const BEST_CONTENT_TYPES: Record<string, string> = {
    youtube: 'video_post', facebook: 'reel', instagram: 'reel',
    x_twitter: 'thread', linkedin: 'text_post', tiktok: 'video_post',
  };

  const generate = async () => {
    if (!topic) { alert('Enter a topic first'); return; }
    setGenerating(true); setResults([]);
    const generated: GeneratedContent[] = [];
    await Promise.all(selectedPlatforms.map(async platform => {
      const ct = BEST_CONTENT_TYPES[platform] ?? 'text_post';
      const resp = await fetch('/api/admin/social-intelligence/ai-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content_type: ct, topic, tone, niche }),
      }).then(r => r.json()).catch(() => null);
      if (resp) generated.push(resp);
    }));
    setResults(generated);
    const captions: Record<string, string> = {};
    generated.forEach(r => { captions[r.platform] = r.caption; });
    setEditedCaptions(captions);
    setGenerating(false);
  };

  const saveVariant = async (result: GeneratedContent) => {
    await fetch('/api/admin/social-intelligence/variants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: result.platform, content_type: result.content_type, caption: editedCaptions[result.platform] ?? result.caption, hashtags: result.hashtags, ai_generated: true, ai_model: 'llama3.2', status: 'draft' }),
    });
    alert(`Saved ${result.platform} variant`);
  };

  const regenerate = async (result: GeneratedContent) => {
    const resp = await fetch('/api/admin/social-intelligence/ai-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: result.platform, content_type: result.content_type, topic, tone, niche }),
    }).then(r => r.json()).catch(() => null);
    if (resp) {
      setResults(prev => prev.map(r => r.platform === result.platform ? resp : r));
      setEditedCaptions(prev => ({ ...prev, [result.platform]: resp.caption }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Ollama-Powered Multi-Platform Content Generator</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Topic *</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. morning yoga routine, mindfulness meditation" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Niche</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['yoga', 'fitness', 'wellness', 'marketing', 'ecommerce'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tone</label>
            <select value={tone} onChange={e => setTone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['inspirational', 'educational', 'promotional', 'conversational', 'humorous'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedPlatforms.includes(p) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={generate} disabled={generating} className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
          {generating ? `Generating for ${selectedPlatforms.length} platforms via Ollama...` : `✨ Generate All (${selectedPlatforms.length} platforms)`}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Generated Content</h3>
          {results.map(result => {
            const caption = editedCaptions[result.platform] ?? result.caption;
            const overLimit = caption.length > result.max_chars;
            return (
              <div key={result.platform} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <PlatformBadge platform={result.platform} />
                  <span className="text-xs text-gray-400">{result.content_type}</span>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setEditedCaptions(prev => ({ ...prev, [result.platform]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:ring-2 focus:ring-purple-400"
                />
                <div className={`text-xs font-medium ${overLimit ? 'text-red-600' : 'text-gray-400'}`}>
                  {caption.length} / {result.max_chars} chars
                </div>
                {result.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags.map(h => (
                      <span key={h} className="text-xs bg-blue-50 text-blue-600 rounded px-2 py-0.5">#{h}</span>
                    ))}
                  </div>
                )}
                {result.suggested_time && (
                  <div className="text-xs text-gray-500">⏰ Best time: <strong>{result.suggested_time}</strong></div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => saveVariant(result)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Variant</button>
                  <button onClick={() => regenerate(result)} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Regenerate</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Hashtags ─────────────────────────────────────────────────────────────

function HashtagsTab() {
  const [hashtags, setHashtags] = useState<HashtagPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [niche, setNiche] = useState('');
  const [research, setResearch] = useState({ hashtag: '', platform: 'instagram', niche: 'yoga' });
  const [researching, setResearching] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (niche) params.set('niche', niche);
    fetch(`/api/admin/social-intelligence/hashtags?${params}`)
      .then(r => r.json()).then(d => setHashtags(d.hashtags ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [platform, niche]);

  const doResearch = async () => {
    if (!research.hashtag) { alert('Enter a hashtag'); return; }
    setResearching(true);
    await fetch('/api/admin/social-intelligence/hashtag-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(research),
    });
    setResearching(false);
    // Reload
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (niche) params.set('niche', niche);
    fetch(`/api/admin/social-intelligence/hashtags?${params}`)
      .then(r => r.json()).then(d => setHashtags(d.hashtags ?? [])).catch(() => {});
  };

  const competitionColor = (level: string) => {
    if (level === 'low') return 'text-green-600';
    if (level === 'medium') return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>
        <select value={niche} onChange={e => setNiche(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Niches</option>
          {['yoga', 'fitness', 'wellness', 'marketing', 'ecommerce'].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-blue-800">Research a Hashtag</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={research.hashtag} onChange={e => setResearch(r => ({ ...r, hashtag: e.target.value }))} placeholder="Enter hashtag (without #)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" />
          <select value={research.platform} onChange={e => setResearch(r => ({ ...r, platform: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
          <select value={research.niche} onChange={e => setResearch(r => ({ ...r, niche: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {['yoga', 'fitness', 'wellness', 'marketing'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={doResearch} disabled={researching} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {researching ? 'Researching...' : 'Research'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading hashtags...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="pb-2 pr-4">Hashtag</th>
              <th className="pb-2 pr-4">Platform</th>
              <th className="pb-2 pr-4">Niche</th>
              <th className="pb-2 pr-4">Avg Reach</th>
              <th className="pb-2 pr-4">Engagement</th>
              <th className="pb-2 pr-4">Posts/Week</th>
              <th className="pb-2 pr-4">Trending</th>
              <th className="pb-2">Competition</th>
            </tr></thead>
            <tbody>
              {hashtags.map(ht => (
                <tr key={ht.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-blue-600">#{ht.hashtag}</td>
                  <td className="py-2 pr-4"><PlatformBadge platform={ht.platform} size="xs" /></td>
                  <td className="py-2 pr-4 text-gray-500">{ht.niche}</td>
                  <td className="py-2 pr-4">{Number(ht.avg_reach).toLocaleString()}</td>
                  <td className="py-2 pr-4">{Number(ht.avg_engagement).toFixed(1)}%</td>
                  <td className="py-2 pr-4">{ht.post_count_this_week}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${ht.trending_score}%` }} />
                      </div>
                      <span className="text-xs">{Number(ht.trending_score).toFixed(0)}</span>
                    </div>
                  </td>
                  <td className={`py-2 font-medium capitalize text-xs ${competitionColor(ht.competition_level)}`}>{ht.competition_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hashtags.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No hashtags found. Seed configs first or research specific hashtags above.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab: Testing ──────────────────────────────────────────────────────────────

function TestingTab() {
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ platform: '', polarity: '', status: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.polarity) params.set('polarity', filters.polarity);
    if (filters.status) params.set('status', filters.status);
    const data = await fetch(`/api/admin/social-intelligence/test-scenarios?${params}`)
      .then(r => r.json()).catch(() => ({ scenarios: [], summary: { total: 0, passed: 0, failed: 0, pending: 0 } }));
    setScenarios(data.scenarios ?? []);
    setSummary(data.summary ?? { total: 0, passed: 0, failed: 0, pending: 0 });
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const runTest = async (scenario: TestScenario) => {
    setRunning(scenario.id);
    await fetch('/api/admin/social-intelligence/run-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario_id: scenario.id }),
    });
    setRunning(null);
    load();
  };

  const seedTests = async () => {
    setSeeding(true);
    const resp = await fetch('/api/admin/social-intelligence/seed-tests', { method: 'POST' }).then(r => r.json()).catch(() => ({ inserted: 0 }));
    setSeeding(false);
    alert(`Seeded ${resp.inserted} new test scenarios (${resp.skipped} already existed)`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-wrap">
          <select value={filters.platform} onChange={e => setFilters(f => ({ ...f, platform: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
            <option value="all">All (API tests)</option>
          </select>
          <select value={filters.polarity} onChange={e => setFilters(f => ({ ...f, polarity: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Polarities</option>
            {['positive', 'negative', 'boundary'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {['pending', 'pass', 'fail'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={seedTests} disabled={seeding} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
          {seeding ? 'Seeding...' : 'Seed Tests'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Scenarios" value={summary.total} color="blue" />
        <KpiCard label="Passed" value={summary.passed} color="green" />
        <KpiCard label="Failed" value={summary.failed} color="red" />
        <KpiCard label="Pending" value={summary.pending} color="gray" />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading scenarios...</div>
      ) : (
        <div className="space-y-2">
          {scenarios.slice(0, 50).map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <PolarityBadge polarity={s.polarity} />
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{s.test_level}</span>
                <PlatformBadge platform={s.platform} size="xs" />
                <span className="text-xs text-gray-500">{s.content_type}</span>
                <span className="text-sm text-gray-700 flex-1 font-medium">{s.scenario_name.replace(/^TC-[A-Z]+-\d+:\s*/, '')}</span>
                <StatusBadge status={s.status} />
                {s.test_level === 'api' && (
                  <button onClick={e => { e.stopPropagation(); runTest(s); }} disabled={running === s.id} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                    {running === s.id ? '...' : 'Run'}
                  </button>
                )}
              </div>
              {expandedId === s.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                  <div><span className="text-xs font-semibold text-gray-500">Expected Result: </span><span className="text-sm text-gray-700">{s.expected_result}</span></div>
                  {s.api_endpoint && <div><span className="text-xs font-semibold text-gray-500">API: </span><code className="text-xs bg-gray-200 px-2 py-0.5 rounded">{s.http_method} {s.api_endpoint}</code></div>}
                  {s.steps?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">Steps:</div>
                      <ol className="space-y-1">
                        {s.steps.map((step, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-2">
                            <span className="font-medium text-gray-400">{step.step}.</span>
                            <span>{step.action} {step.detail ? `— ${step.detail}` : ''}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {s.api_endpoint && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">Test Payload:</div>
                      <pre className="text-xs bg-gray-100 rounded p-2 overflow-auto">{JSON.stringify(s.test_payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {scenarios.length === 0 && <div className="text-center text-gray-400 py-8">No test scenarios. Click "Seed Tests" to generate {200}+ scenarios.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab: Alerts ───────────────────────────────────────────────────────────────

function AlertsTab() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; platform: string; alert_type: string; severity: string; message: string; triggered_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState({ alert_type: 'viral_spike', platform: '', metric: 'impressions', threshold_value: 10000, comparison: 'gt', window_minutes: 60, severity: 'info' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch('/api/admin/social-intelligence/alerts').then(r => r.json()).catch(() => ({ rules: [], recent_events: [] }));
    setRules(data.rules ?? []); setEvents(data.recent_events ?? []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (rule: AlertRule) => {
    await fetch(`/api/admin/social-intelligence/alerts/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    load();
  };

  const addRule = async () => {
    setSaving(true);
    await fetch('/api/admin/social-intelligence/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRule),
    });
    setSaving(false); setShowForm(false); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Alert Rules ({rules.length})</h3>
        <button onClick={() => setShowForm(f => !f)} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">+ Add Rule</button>
      </div>

      {showForm && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <h4 className="font-medium text-orange-800">New Alert Rule</h4>
          <div className="grid grid-cols-2 gap-3">
            <input value={newRule.alert_type} onChange={e => setNewRule(n => ({ ...n, alert_type: e.target.value }))} placeholder="Alert type" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={newRule.platform} onChange={e => setNewRule(n => ({ ...n, platform: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All Platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
            </select>
            <input value={newRule.metric} onChange={e => setNewRule(n => ({ ...n, metric: e.target.value }))} placeholder="Metric" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={newRule.threshold_value} onChange={e => setNewRule(n => ({ ...n, threshold_value: Number(e.target.value) }))} placeholder="Threshold" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={newRule.comparison} onChange={e => setNewRule(n => ({ ...n, comparison: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['gt', 'lt', 'pct_change'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newRule.severity} onChange={e => setNewRule(n => ({ ...n, severity: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['info', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addRule} disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Rule'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-gray-400 py-8">Loading alerts...</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-gray-200 text-left text-xs text-gray-500 uppercase">
                <th className="pb-2 pr-4">Platform</th>
                <th className="pb-2 pr-4">Alert Type</th>
                <th className="pb-2 pr-4">Metric</th>
                <th className="pb-2 pr-4">Threshold</th>
                <th className="pb-2 pr-4">Window</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4">Active</th>
                <th className="pb-2">Last Triggered</th>
              </tr></thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4">{rule.platform ? <PlatformBadge platform={rule.platform} size="xs" /> : <span className="text-xs text-gray-400">All</span>}</td>
                    <td className="py-2 pr-4 font-medium">{rule.alert_type}</td>
                    <td className="py-2 pr-4 text-gray-500">{rule.metric}</td>
                    <td className="py-2 pr-4">{rule.comparison} {rule.threshold_value}</td>
                    <td className="py-2 pr-4">{rule.window_minutes}m</td>
                    <td className="py-2 pr-4"><SeverityBadge severity={rule.severity} /></td>
                    <td className="py-2 pr-4">
                      <button onClick={() => toggleActive(rule)} className={`w-10 h-5 rounded-full transition-colors ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${rule.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    <td className="py-2 text-xs text-gray-400">
                      {rule.last_triggered_at ? new Date(rule.last_triggered_at).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {events.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Recent Alert Events (Last 20)</h3>
              <div className="space-y-2">
                {events.map(event => (
                  <div key={event.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                    <SeverityBadge severity={event.severity} />
                    {event.platform && <PlatformBadge platform={event.platform} size="xs" />}
                    <span className="text-sm text-gray-700 flex-1">{event.message}</span>
                    <span className="text-xs text-gray-400">{new Date(event.triggered_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Tenant Scenarios ─────────────────────────────────────────────────────

function TenantScenariosTab() {
  const [configs, setConfigs] = useState<TenantConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantFilter, setTenantFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tenantFilter) params.set('tenant_type', tenantFilter);
    if (platformFilter) params.set('platform', platformFilter);
    fetch(`/api/admin/social-intelligence/tenant-config?${params}`)
      .then(r => r.json()).then(d => setConfigs(d.configs ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [tenantFilter, platformFilter]);

  const TENANT_TYPES = ['yoga_studio', 'fitness_center', 'wellness_brand', 'b2b_agency', 'corporate'];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Tenant Types</option>
          {TENANT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center text-gray-400 py-8">Loading...</div> : (
        <div className="space-y-2">
          {configs.map(tc => (
            <div key={tc.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}>
                <span className="text-xs font-medium bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 capitalize">{tc.tenant_type.replace(/_/g, ' ')}</span>
                <PlatformBadge platform={tc.platform} size="xs" />
                <span className="text-xs text-gray-500">{tc.posting_frequency}</span>
                <span className="text-xs text-gray-500">{tc.tone}</span>
                <span className="text-xs text-gray-400 flex-1">{tc.primary_content_types.join(', ')}</span>
                <span className="text-xs font-medium text-blue-600">{tc.kpi_focus}</span>
              </div>
              {expandedId === tc.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 grid grid-cols-2 gap-4 text-sm">
                  <div><div className="font-semibold text-gray-600 text-xs mb-1">Top Hashtags</div>{tc.top_hashtags.map(h => `#${h}`).join(' ')}</div>
                  <div><div className="font-semibold text-gray-600 text-xs mb-1">Best Times</div>{tc.best_times.join(' · ')}</div>
                  <div className="col-span-2"><div className="font-semibold text-gray-600 text-xs mb-1">Notes</div>{tc.notes}</div>
                </div>
              )}
            </div>
          ))}
          {configs.length === 0 && <div className="text-center text-gray-400 py-8">No tenant configs. Click "Seed Platform Configs" on Overview tab.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab: Reports ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [reportType, setReportType] = useState('platform-performance');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true); setData(null);
    const url = `/api/admin/social-intelligence/reports/${reportType === 'content-type-roi' ? 'content-type-roi' : 'platform-performance'}`;
    const result = await fetch(url).then(r => r.json()).catch(() => null);
    setData(result);
    setLoading(false);
  }, [reportType]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const exportCsv = () => {
    if (!data) return;
    const rows = (data.platforms as Array<Record<string, unknown>> ?? []);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map((r: Record<string, unknown>) => Object.values(r).join(','));
    const csv = [headers, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportType}.csv`; a.click();
  };

  const REPORT_TYPES = [
    { key: 'platform-performance', label: 'Platform Performance' },
    { key: 'content-type-roi', label: 'Content Type ROI' },
    { key: 'hashtag-impact', label: 'Hashtag Impact' },
    { key: 'posting-frequency', label: 'Posting Frequency' },
    { key: 'engagement-heatmap', label: 'Engagement Heatmap' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {REPORT_TYPES.map(rt => (
            <button key={rt.key} onClick={() => setReportType(rt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === rt.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {rt.label}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">Export CSV</button>
      </div>

      {loading ? <div className="text-center text-gray-400 py-8">Loading report...</div> : (
        <>
          {reportType === 'platform-performance' && data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-4">Platform</th>
                  <th className="pb-2 pr-4">Posts</th>
                  <th className="pb-2 pr-4">Impressions</th>
                  <th className="pb-2 pr-4">Reach</th>
                  <th className="pb-2 pr-4">Avg Engagement</th>
                  <th className="pb-2 pr-4">Follower Δ</th>
                  <th className="pb-2">Recommended Actions</th>
                </tr></thead>
                <tbody>
                  {((data as { platforms: Array<{
                    platform: string; total_posts: number; total_impressions: number;
                    total_reach: number; avg_engagement_rate: number; follower_delta: number;
                    best_for_reach?: boolean; best_for_engagement?: boolean;
                    recommended_actions?: string[];
                  }> }).platforms ?? []).map((row) => (
                    <tr key={row.platform} className={`border-b border-gray-100 ${row.best_for_reach || row.best_for_engagement ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <td className="py-2 pr-4"><PlatformBadge platform={row.platform} /></td>
                      <td className="py-2 pr-4">{row.total_posts}</td>
                      <td className="py-2 pr-4">{Number(row.total_impressions).toLocaleString()}</td>
                      <td className="py-2 pr-4">{Number(row.total_reach).toLocaleString()} {row.best_for_reach && <span className="text-xs text-green-600">★</span>}</td>
                      <td className="py-2 pr-4">{Number(row.avg_engagement_rate).toFixed(2)}% {row.best_for_engagement && <span className="text-xs text-green-600">★</span>}</td>
                      <td className={`py-2 pr-4 font-medium ${Number(row.follower_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(row.follower_delta) >= 0 ? '+' : ''}{row.follower_delta}</td>
                      <td className="py-2 text-xs text-gray-500">{(row.recommended_actions ?? []).slice(0, 1).join('')}</td>
                    </tr>
                  ))}
                  {(data as { platforms: unknown[] }).platforms?.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400">No data yet. Sync analytics first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'content-type-roi' && data && (
            <div className="space-y-6">
              {((data as { roi_by_platform: Array<{ platform: string; content_types: Array<{ content_type: string; display_name: string; avg_engagement_rate: number; best_posting_times: string[]; top_tip: string }> }> }).roi_by_platform ?? []).map((platformData) => (
                <div key={platformData.platform}>
                  <div className="flex items-center gap-2 mb-2"><PlatformBadge platform={platformData.platform} /></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="pb-1 pr-4 text-left">Content Type</th>
                        <th className="pb-1 pr-4 text-left">Avg Engagement</th>
                        <th className="pb-1 pr-4 text-left">Best Time</th>
                        <th className="pb-1 text-left">Top Tip</th>
                      </tr></thead>
                      <tbody>
                        {platformData.content_types.slice(0, 5).map((ct) => (
                          <tr key={ct.content_type} className="border-b border-gray-50">
                            <td className="py-1.5 pr-4 font-medium">{ct.display_name}</td>
                            <td className="py-1.5 pr-4">{Number(ct.avg_engagement_rate).toFixed(1)}%</td>
                            <td className="py-1.5 pr-4 text-xs text-gray-500">{ct.best_posting_times[0] ?? '—'}</td>
                            <td className="py-1.5 text-xs text-gray-500">{ct.top_tip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {['hashtag-impact', 'posting-frequency', 'engagement-heatmap'].includes(reportType) && (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
              <div className="text-lg mb-2">📊 {REPORT_TYPES.find(r => r.key === reportType)?.label}</div>
              <div className="text-sm">Data populates as posts are published and analytics are synced.</div>
              <div className="text-xs mt-1">Use "Sync Analytics Now" on the Overview tab to pull latest data.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialIntelligencePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [configs, setConfigs] = useState<ContentTypeConfig[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalytics[]>([]);

  useEffect(() => {
    fetch('/api/admin/social-intelligence/configs').then(r => r.json()).then(d => setConfigs(d.configs ?? [])).catch(() => {});
    fetch('/api/admin/social-intelligence/analytics').then(r => r.json()).then(d => setAnalytics(d.analytics ?? [])).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Social Media Intelligence Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">YouTube · Facebook · Instagram · Twitter/X · LinkedIn · TikTok — all content types, analytics, AI generation</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/social" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Social Portal →</Link>
            <Link href="/admin/social-intelligence?tab=agentic-content" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">✨ AI Generate</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab analytics={analytics} configs={configs} />}
        {activeTab === 'content-composer' && <ContentComposerTab configs={configs} />}
        {activeTab === 'content-calendar' && <ContentCalendarTab />}
        {activeTab === 'per-platform' && <PerPlatformTab configs={configs} analytics={analytics} />}
        {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} />}
        {activeTab === 'agentic-content' && <AgenticContentTab />}
        {activeTab === 'hashtags' && <HashtagsTab />}
        {activeTab === 'testing' && <TestingTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'tenant-scenarios' && <TenantScenariosTab />}
        {activeTab === 'scenarios' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Full Scenario Registry</h3>
            <p className="text-sm text-gray-500 mb-4">All social intelligence test scenarios are managed in the <strong>Testing</strong> tab. Use the filters there to browse by platform, polarity, test level, and status.</p>
            <div className="flex gap-3">
              <button onClick={() => setActiveTab('testing')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Go to Testing Tab →</button>
            </div>
          </div>
        )}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
