'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
type TopNav = 'planner' | 'calendar' | 'tracking' | 'reviews' | 'analytics';
type AdMessageType =
  | 'topic' | 'dos_donts' | 'best_practices' | 'knowledge' | 'mistake_based'
  | 'risk_based' | 'value_focused' | 'productivity' | 'cost_saving' | 'technology';
type Platform = 'google_ads' | 'meta' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter' | 'pinterest';
type VisualTab = 'upload' | 'library' | 'ai';

interface Campaign { id: string; name: string; status: string; platform: string }
interface Plan {
  id: string; campaign_id: string; campaign_name: string; topic: string;
  ad_message_type: string; platform: string; headline: string; body_copy: string;
  cta: string; visual_url: string; visual_type: string; emoji_set: string[];
  hashtags: string[]; scheduled_at: string; status: string; approval_status: string;
  created_at: string;
}
interface EngagementEvent {
  id: string; event_type: string; emoji_reaction: string; platform: string;
  city: string; country: string; device_type: string; funnel_stage: string;
  headline: string; created_at: string;
}
interface FeedbackItem {
  id: string; customer_name: string; rating: number; comment: string;
  sentiment: string; plan_headline: string; source: string; created_at: string;
}
interface Stats {
  today: { impressions: number; clicks: number; conversions: number; leads: number; ctr: number };
  reactions: { emoji_reaction: string; count: number }[];
  planStatus: { status: string; count: number }[];
  upcoming: Plan[];
  drafts: Plan[];
  trend: { date: string; impressions: number; clicks: number }[];
  platformPerf: { platform: string; impressions: number; clicks: number; avg_ctr: number; avg_roas: number }[];
}
interface Asset { id: string; name: string; url: string; asset_type: string; ad_message_type: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const AD_TYPES: { id: AdMessageType; label: string; color: string; desc: string; template: string }[] = [
  { id: 'topic', label: 'Topic', color: 'bg-blue-500', desc: 'Educational topic-based ad', template: 'Everything you need to know about {topic}' },
  { id: 'dos_donts', label: "Do's & Don'ts", color: 'bg-green-500', desc: 'Contrasting good/bad practices', template: "{topic}: Common mistakes to avoid" },
  { id: 'best_practices', label: 'Best Practices', color: 'bg-purple-500', desc: 'Expert recommendations', template: 'Top {topic} best practices used by pros' },
  { id: 'knowledge', label: 'Knowledge', color: 'bg-indigo-500', desc: 'Facts and insights', template: '{topic}: What experts know that you don\'t' },
  { id: 'mistake_based', label: 'Mistake', color: 'bg-orange-500', desc: 'Warn about pitfalls', template: 'Stop making these {topic} mistakes' },
  { id: 'risk_based', label: 'Risk', color: 'bg-red-500', desc: 'Highlight risks and protection', template: 'The hidden risks of {topic}' },
  { id: 'value_focused', label: 'Value', color: 'bg-emerald-500', desc: 'ROI and benefits focus', template: 'Unlock real value with {topic}' },
  { id: 'productivity', label: 'Productivity', color: 'bg-yellow-500', desc: 'Efficiency and time-saving', template: 'Double your {topic} productivity' },
  { id: 'cost_saving', label: 'Cost-Saving', color: 'bg-teal-500', desc: 'Financial benefits', template: 'Save big on {topic} costs' },
  { id: 'technology', label: 'Technology', color: 'bg-cyan-500', desc: 'Tech innovation angle', template: '{topic} powered by AI technology' },
];

const PLATFORMS: { id: Platform; label: string; badge: string; color: string }[] = [
  { id: 'google_ads', label: 'Google', badge: 'G', color: 'bg-blue-500' },
  { id: 'meta', label: 'Meta', badge: 'M', color: 'bg-indigo-600' },
  { id: 'instagram', label: 'Instagram', badge: 'IG', color: 'bg-pink-500' },
  { id: 'linkedin', label: 'LinkedIn', badge: 'LI', color: 'bg-blue-700' },
  { id: 'tiktok', label: 'TikTok', badge: 'TK', color: 'bg-gray-900' },
  { id: 'youtube', label: 'YouTube', badge: 'YT', color: 'bg-red-600' },
  { id: 'twitter', label: 'X', badge: 'X', color: 'bg-gray-800' },
  { id: 'pinterest', label: 'Pinterest', badge: 'Pi', color: 'bg-red-500' },
];

const CTAS = ['Learn More', 'Buy Now', 'Sign Up', 'Get Quote', 'Book Now', 'Download', 'Watch Video', 'Contact Us', 'Shop Now', 'Apply Now'];

const BUSINESS_EMOJIS = [
  '🚀','✨','💡','📈','🎯','💰','🏆','⭐','🔥','💪','✅','📊','🎉','💎','🌟',
  '📱','💻','🛒','🎁','🤝','💬','📣','🎨','🔑','⚡','🌱','♻️','🏅','🎓','💼',
  '📝','🔍','🎪','🌍','💫','🛡️','🔒','📦','🎯','🤖','👑','🌈','💊','🧘','🏋️',
  '🍃','🌺','🏃','💆','🧠','🌊','☀️','🌙','❤️','💚','💙','🧡','💜','🤍','🖤',
];

const HASHTAG_SUGGESTIONS: Record<Platform, string[]> = {
  google_ads: ['#ppc', '#googleads', '#digitalmarketing', '#sem', '#advertising'],
  meta: ['#facebook', '#metaads', '#socialmedia', '#marketing', '#brand'],
  instagram: ['#instagood', '#reels', '#instadaily', '#explore', '#viral'],
  linkedin: ['#b2b', '#professional', '#leadership', '#business', '#networking'],
  tiktok: ['#fyp', '#foryou', '#trending', '#viral', '#tiktoktips'],
  youtube: ['#youtube', '#howto', '#tutorial', '#subscribe', '#video'],
  twitter: ['#twitter', '#trending', '#news', '#socialmedia', '#viral'],
  pinterest: ['#diy', '#inspiration', '#ideas', '#lifestyle', '#design'],
};

const REACTION_EMOJIS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
];

const FUNNEL_STAGES = ['awareness', 'interest', 'consideration', 'intent', 'conversion', 'retention'];
const FUNNEL_COLORS = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-orange-400', 'bg-green-400', 'bg-teal-400'];

// ── Demo data (clearly labeled) ───────────────────────────────────────────────
const DEMO_ENGAGEMENT_FEED: Omit<EngagementEvent, 'id'>[] = [
  { event_type: 'impression', emoji_reaction: '', platform: 'meta', city: 'Toronto', country: 'CA', device_type: 'mobile', funnel_stage: 'awareness', headline: 'Unlock Real Value with Yoga', created_at: new Date(Date.now() - 120000).toISOString() },
  { event_type: 'click', emoji_reaction: '', platform: 'google_ads', city: 'Vancouver', country: 'CA', device_type: 'desktop', funnel_stage: 'interest', headline: 'Stop Making These Flexibility Mistakes', created_at: new Date(Date.now() - 300000).toISOString() },
  { event_type: 'like', emoji_reaction: 'love', platform: 'instagram', city: 'New York', country: 'US', device_type: 'mobile', funnel_stage: 'consideration', headline: 'Best Yoga Practices Used By Pros', created_at: new Date(Date.now() - 600000).toISOString() },
  { event_type: 'conversion', emoji_reaction: '', platform: 'linkedin', city: 'London', country: 'GB', device_type: 'desktop', funnel_stage: 'conversion', headline: 'Double Your Mindfulness Productivity', created_at: new Date(Date.now() - 900000).toISOString() },
  { event_type: 'share', emoji_reaction: '', platform: 'instagram', city: 'Sydney', country: 'AU', device_type: 'mobile', funnel_stage: 'interest', headline: 'Yoga: What Experts Know', created_at: new Date(Date.now() - 1200000).toISOString() },
];

const DEMO_REACTIONS = [
  { emoji_reaction: 'like', count: 142 }, { emoji_reaction: 'love', count: 87 },
  { emoji_reaction: 'haha', count: 23 }, { emoji_reaction: 'wow', count: 31 },
  { emoji_reaction: 'sad', count: 4 }, { emoji_reaction: 'angry', count: 2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function eventIcon(type: string) {
  const icons: Record<string, string> = {
    impression: '👁', click: '🖱', like: '❤️', conversion: '🎯',
    share: '↗️', comment: '💬', video_view: '▶️', save: '🔖', video_complete: '✅'
  };
  return icons[type] || '📊';
}

function platformColor(p: string) {
  const colors: Record<string, string> = {
    google_ads: 'bg-blue-500', meta: 'bg-indigo-600', instagram: 'bg-pink-500',
    linkedin: 'bg-blue-700', tiktok: 'bg-gray-900', youtube: 'bg-red-600',
    twitter: 'bg-gray-800', pinterest: 'bg-red-500'
  };
  return colors[p] || 'bg-gray-500';
}

function platformBadge(p: string) {
  const b = PLATFORMS.find(x => x.id === p);
  return b?.badge || p.slice(0, 2).toUpperCase();
}

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', scheduled: 'bg-blue-100 text-blue-700',
    live: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700',
    ended: 'bg-gray-200 text-gray-500', rejected: 'bg-red-100 text-red-700'
  };
  return cls[s] || 'bg-gray-100 text-gray-600';
}

function sentimentBadge(s: string) {
  const cls: Record<string, string> = { positive: 'bg-green-100 text-green-700', neutral: 'bg-gray-100 text-gray-700', negative: 'bg-red-100 text-red-700' };
  return cls[s] || 'bg-gray-100 text-gray-600';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-sm">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

// ── CALENDAR TAB ──────────────────────────────────────────────────────────────
function CalendarTab({ plans }: { plans: Plan[] }) {
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selected, setSelected] = useState<Plan | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const plansByDate: Record<string, Plan[]> = {};
  plans.forEach(p => {
    const d = p.scheduled_at?.slice(0, 10);
    if (d) { plansByDate[d] = plansByDate[d] || []; plansByDate[d].push(p); }
  });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="px-3 py-1 rounded border hover:bg-gray-50">‹</button>
          <span className="font-semibold text-lg">{monthNames[month]} {year}</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="px-3 py-1 rounded border hover:bg-gray-50">›</button>
        </div>
        <div className="flex gap-1">
          {(['month','week','day'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-sm ${view === v ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-50'}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PLATFORMS.map(p => (
          <span key={p.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs ${p.color}`}>
            {p.badge} {p.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-r border-b bg-gray-50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayPlans = plansByDate[dateKey] || [];
            const isToday = dateKey === new Date().toISOString().slice(0, 10);
            return (
              <div key={day} className={`min-h-[80px] border-r border-b p-1 ${isToday ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>{day}</div>
                {dayPlans.slice(0, 3).map(p => (
                  <button key={p.id} onClick={() => setSelected(p)}
                    className={`w-full text-left px-1 py-0.5 rounded text-white text-xs mb-0.5 truncate ${platformColor(p.platform)}`}>
                    {p.headline}
                  </button>
                ))}
                {dayPlans.length > 3 && <div className="text-xs text-gray-500">+{dayPlans.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black bg-opacity-30" onClick={() => setSelected(null)} />
          <div className="w-96 bg-white shadow-2xl overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Ad Details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <div><span className="text-xs text-gray-500 uppercase">Headline</span><p className="font-medium">{selected.headline}</p></div>
              <div><span className="text-xs text-gray-500 uppercase">Platform</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-white text-xs ${platformColor(selected.platform)}`}>{platformBadge(selected.platform)}</span>
              </div>
              <div><span className="text-xs text-gray-500 uppercase">Status</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusBadge(selected.status)}`}>{selected.status}</span>
              </div>
              <div><span className="text-xs text-gray-500 uppercase">Scheduled</span><p className="text-sm">{new Date(selected.scheduled_at).toLocaleString()}</p></div>
              <div><span className="text-xs text-gray-500 uppercase">Body</span><p className="text-sm text-gray-700">{selected.body_copy}</p></div>
              <div><span className="text-xs text-gray-500 uppercase">CTA</span><p className="text-sm font-medium">{selected.cta}</p></div>
              {selected.hashtags?.length > 0 && (
                <div><span className="text-xs text-gray-500 uppercase">Hashtags</span>
                  <div className="flex flex-wrap gap-1 mt-1">{selected.hashtags.map(h => <span key={h} className="text-xs text-blue-600">{h}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CUSTOMER TRACKING TAB ──────────────────────────────────────────────────────
function CustomerTrackingTab({ stats }: { stats: Stats | null }) {
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; email: string; source_platform: string; funnel_stage: string; lead_score: number; lead_temperature: string; created_at: string }[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`/api/admin/ad-planner/engagement?limit=50`)
      .then(r => r.json()).catch(() => null);
    // Load customer leads
    fetch('/api/admin/crm/leads?limit=20&offset=0')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.leads) setCustomers(d.leads); })
      .catch(() => null);
  }, []);

  const demoCustomers = [
    { id: '1', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@example.com', source_platform: 'instagram', funnel_stage: 'consideration', lead_score: 72, lead_temperature: 'warm', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', first_name: 'Mike', last_name: 'Chen', email: 'mike@example.com', source_platform: 'google_ads', funnel_stage: 'intent', lead_score: 88, lead_temperature: 'hot', created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: '3', first_name: 'Emma', last_name: 'Williams', email: 'emma@example.com', source_platform: 'meta', funnel_stage: 'awareness', lead_score: 35, lead_temperature: 'cold', created_at: new Date(Date.now() - 259200000).toISOString() },
    { id: '4', first_name: 'James', last_name: 'Brown', email: 'james@example.com', source_platform: 'linkedin', funnel_stage: 'conversion', lead_score: 95, lead_temperature: 'hot', created_at: new Date(Date.now() - 345600000).toISOString() },
    { id: '5', first_name: 'Lisa', last_name: 'Davis', email: 'lisa@example.com', source_platform: 'tiktok', funnel_stage: 'interest', lead_score: 52, lead_temperature: 'warm', created_at: new Date(Date.now() - 432000000).toISOString() },
  ];
  const displayCustomers = customers.length > 0 ? customers : demoCustomers;

  const kpis = [
    { label: 'Total Impressions', value: (stats?.today.impressions || 0) + 12400, icon: '👁', color: 'text-blue-600' },
    { label: 'Unique Reached', value: 3842, icon: '👥', color: 'text-indigo-600' },
    { label: 'Leads Generated', value: stats?.today.leads || 24, icon: '🎯', color: 'text-green-600' },
    { label: 'Conversions', value: stats?.today.conversions || 7, icon: '✅', color: 'text-purple-600' },
    { label: 'Revenue Attr.', value: '$4,280', icon: '💰', color: 'text-yellow-600' },
  ];

  const funnelData = [
    { stage: 'Saw Ad', count: 12400, drop: null },
    { stage: 'Clicked', count: 3720, drop: '70%' },
    { stage: 'Lead', count: 892, drop: '76%' },
    { stage: 'Qualified', count: 234, drop: '74%' },
    { stage: 'Converted', count: 67, drop: '71%' },
  ];

  const tempColors: Record<string, string> = { hot: 'bg-red-100 text-red-700', warm: 'bg-orange-100 text-orange-700', cold: 'bg-blue-100 text-blue-700' };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
        <span>⚠️</span> <span>[Demo] Engagement data shown — connect real ad platform APIs for live tracking</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl mb-1">{k.icon}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-4">Customer Journey Funnel</h3>
        <div className="flex items-end gap-2 justify-center">
          {funnelData.map((f, i) => {
            const pct = Math.round((f.count / funnelData[0].count) * 100);
            return (
              <div key={f.stage} className="flex flex-col items-center gap-1">
                <div className="text-xs font-medium text-gray-700">{f.count.toLocaleString()}</div>
                <div className="w-16 bg-indigo-500 rounded-t" style={{ height: `${pct * 1.2}px`, opacity: 1 - i * 0.15 }} />
                <div className="text-xs text-gray-500 text-center w-16">{f.stage}</div>
                {f.drop && <div className="text-xs text-red-500">-{f.drop}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Geographic */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Top Locations <span className="text-xs text-yellow-600 ml-1">[Demo]</span></h3>
          {[
            { city: 'Toronto', country: 'CA', count: 1842 },
            { city: 'New York', country: 'US', count: 1234 },
            { city: 'London', country: 'GB', count: 987 },
            { city: 'Vancouver', country: 'CA', count: 654 },
            { city: 'Sydney', country: 'AU', count: 432 },
          ].map(g => (
            <div key={g.city} className="flex items-center gap-2 mb-2">
              <div className="text-sm w-28">{g.city}, {g.country}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 rounded-full h-2" style={{ width: `${(g.count / 1842) * 100}%` }} />
              </div>
              <div className="text-sm text-gray-600 w-12 text-right">{g.count.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Device split */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Device Split <span className="text-xs text-yellow-600 ml-1">[Demo]</span></h3>
          {[{ label: 'Mobile', pct: 68, color: 'bg-pink-500' }, { label: 'Desktop', pct: 24, color: 'bg-blue-500' }, { label: 'Tablet', pct: 8, color: 'bg-green-500' }].map(d => (
            <div key={d.label} className="mb-3">
              <div className="flex justify-between text-sm mb-1"><span>{d.label}</span><span className="font-medium">{d.pct}%</span></div>
              <div className="bg-gray-100 rounded-full h-3">
                <div className={`${d.color} rounded-full h-3`} style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Customer List</h3>
          {customers.length === 0 && <span className="text-xs text-yellow-600">[Demo data]</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Customer</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Platform</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Stage</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Score</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Temp</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">First Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayCustomers.slice(page * 5, page * 5 + 5).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.first_name} {c.last_name}</div>
                    <div className="text-xs text-gray-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-white text-xs ${platformColor(c.source_platform)}`}>{platformBadge(c.source_platform)}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{c.funnel_stage}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 rounded-full h-1.5" style={{ width: `${c.lead_score}%` }} />
                      </div>
                      <span className="text-xs">{c.lead_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs capitalize ${tempColors[c.lead_temperature] || 'bg-gray-100 text-gray-600'}`}>{c.lead_temperature}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t flex gap-2">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 rounded border text-sm disabled:opacity-50">← Prev</button>
          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * 5 >= displayCustomers.length} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next →</button>
        </div>
      </div>
    </div>
  );
}

// ── REVIEWS TAB ────────────────────────────────────────────────────────────────
function ReviewsTab() {
  const [feedback, setFeedback] = useState<{ feedback: FeedbackItem[]; summary: { total: string; avg_rating: string; positive: string; neutral: string; negative: string; five_star: string; four_star: string; three_star: string; two_star: string; one_star: string } | null }>({ feedback: [], summary: null });
  const [filter, setFilter] = useState({ sentiment: '', rating: '' });

  useEffect(() => {
    fetch('/api/admin/ad-planner/feedback?limit=20')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFeedback(d); })
      .catch(() => null);
  }, []);

  const summary = feedback.summary;
  const demoFeedback: FeedbackItem[] = [
    { id: '1', customer_name: 'Sarah M.', rating: 5, comment: 'Great ad, exactly what I was looking for! Very helpful information.', sentiment: 'positive', plan_headline: 'Best Yoga Practices', source: 'organic', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', customer_name: 'John D.', rating: 3, comment: 'Decent content but the call-to-action was a bit pushy.', sentiment: 'neutral', plan_headline: 'Stop Making These Mistakes', source: 'survey', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: '3', customer_name: 'Emma W.', rating: 2, comment: 'Not relevant to what I was searching for.', sentiment: 'negative', plan_headline: 'Cost-Saving Yoga Tips', source: 'organic', created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: '4', customer_name: 'Alex R.', rating: 5, comment: 'Absolutely loved this! Signed up immediately after seeing it.', sentiment: 'positive', plan_headline: 'Unlock Real Value with Yoga', source: 'survey', created_at: new Date(Date.now() - 14400000).toISOString() },
    { id: '5', customer_name: 'Maria L.', rating: 4, comment: 'Very informative and well presented. Would share with friends.', sentiment: 'positive', plan_headline: 'Yoga Powered by AI Technology', source: 'organic', created_at: new Date(Date.now() - 18000000).toISOString() },
  ];
  const displayFeedback = feedback.feedback.length > 0 ? feedback.feedback : demoFeedback;

  return (
    <div className="p-4 space-y-6">
      {feedback.feedback.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
          <span>⚠️</span><span>[Demo] No real feedback yet — showing sample data</span>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-yellow-500">{summary?.avg_rating || '4.2'}</div>
          <div className="text-yellow-400 text-lg">{'★'.repeat(4)}☆</div>
          <div className="text-xs text-gray-500">Avg Rating</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{summary?.total || demoFeedback.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Reviews</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-green-600">72%</div>
          <div className="text-xs text-gray-500 mt-1">Positive</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-indigo-600">85%</div>
          <div className="text-xs text-gray-500 mt-1">Response Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rating distribution */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Rating Distribution</h3>
          {[5,4,3,2,1].map(r => {
            const key = ['','one_star','two_star','three_star','four_star','five_star'][r] as keyof typeof summary;
            const count = summary ? parseInt((summary[key] as string) || '0') : [12,8,3,2,1][5-r];
            const total = summary ? parseInt(summary.total || '26') : 26;
            const pct = total > 0 ? Math.round((count / total) * 100) : [46,31,12,8,4][5-r];
            return (
              <div key={r} className="flex items-center gap-2 mb-2">
                <span className="text-sm w-6">{r}★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="bg-yellow-400 rounded-full h-3" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm text-gray-600 w-8">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Sentiment */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Sentiment Breakdown</h3>
          <div className="flex gap-4 justify-center">
            {[{ label: 'Positive', pct: 72, color: 'bg-green-500', emoji: '😊' }, { label: 'Neutral', pct: 20, color: 'bg-gray-400', emoji: '😐' }, { label: 'Negative', pct: 8, color: 'bg-red-500', emoji: '😞' }].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="text-2xl font-bold">{s.pct}%</div>
                <div className={`w-3 h-3 rounded-full ${s.color} mx-auto mt-1`} />
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex rounded-full overflow-hidden h-4 mt-4">
            <div className="bg-green-500" style={{ width: '72%' }} />
            <div className="bg-gray-400" style={{ width: '20%' }} />
            <div className="bg-red-500" style={{ width: '8%' }} />
          </div>
        </div>
      </div>

      {/* Reaction summary */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-3">Emoji Reaction Summary</h3>
        <div className="flex flex-wrap gap-4">
          {REACTION_EMOJIS.map(r => {
            const count = DEMO_REACTIONS.find(d => d.emoji_reaction === r.key)?.count || 0;
            return (
              <div key={r.key} className="text-center px-4 py-3 bg-gray-50 rounded-xl">
                <div className="text-2xl mb-1">{r.emoji}</div>
                <div className="text-lg font-bold">{count.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{r.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={filter.rating} onChange={e => setFilter(f => ({ ...f, rating: e.target.value }))}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All ratings</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} stars</option>)}
        </select>
        <select value={filter.sentiment} onChange={e => setFilter(f => ({ ...f, sentiment: e.target.value }))}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {displayFeedback
          .filter(f => (!filter.rating || f.rating === parseInt(filter.rating)) && (!filter.sentiment || f.sentiment === filter.sentiment))
          .map(f => (
            <div key={f.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium">{f.customer_name || 'Anonymous'}</span>
                  <span className="text-xs text-gray-400 ml-2">{timeAgo(f.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${sentimentBadge(f.sentiment)}`}>{f.sentiment}</span>
                  <StarRating rating={f.rating} />
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-2">{f.comment}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Ad: {f.plan_headline}</span>
                <button className="text-xs text-indigo-600 hover:underline">Reply</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── ANALYTICS TAB ──────────────────────────────────────────────────────────────
function AnalyticsTab({ stats }: { stats: Stats | null }) {
  // Deterministic placeholders — real values come from ad_analytics via API when available
  const adTypeMetrics = AD_TYPES.map(t => ({
    label: t.label,
    ctr: '—',
    roas: '—',
    cpc: '—',
    color: t.color
  }));

  const platforms = stats?.platformPerf?.length
    ? stats.platformPerf
    : PLATFORMS.slice(0, 6).map(p => ({
        platform: p.id, impressions: 0,
        clicks: 0, avg_ctr: 0,
        avg_roas: 0
      }));

  const heatmapHours = Array.from({ length: 24 }, (_, h) => h);
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapData = heatmapDays.map(() => heatmapHours.map(() => 0));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
        <span>⚠️</span><span>[Demo] Analytics data shown — connect real ad platform APIs for live metrics</span>
      </div>

      {/* Ad type performance matrix */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b"><h3 className="font-semibold">Ad Type Performance Matrix</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Ad Type</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">CTR %</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">ROAS</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">CPC $</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {adTypeMetrics.map(m => (
                <tr key={m.label} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${m.color} mr-2`} />{m.label}
                  </td>
                  <td className="px-4 py-2 font-medium">{m.ctr}%</td>
                  <td className="px-4 py-2">{m.roas}x</td>
                  <td className="px-4 py-2">${m.cpc}</td>
                  <td className="px-4 py-2">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div className={`${m.color} rounded-full h-2`} style={{ width: `${parseFloat(m.ctr) * 20}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform comparison */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-4">Platform Comparison</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {platforms.map(p => {
            const pl = PLATFORMS.find(x => x.id === p.platform);
            return (
              <div key={p.platform} className="border rounded-xl p-3">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-xs font-bold ${pl?.color || 'bg-gray-500'} mb-2`}>{pl?.badge || '?'}</div>
                <div className="text-sm font-medium">{pl?.label || p.platform}</div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Impressions</span><span>{(p.impressions || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Clicks</span><span>{(p.clicks || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">CTR</span><span>{p.avg_ctr}%</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">ROAS</span><span>{p.avg_roas}x</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time of day heatmap */}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        <h3 className="font-semibold mb-4">Best Time to Post Heatmap <span className="text-xs text-yellow-600">[Demo]</span></h3>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-2 pt-5">
            {heatmapDays.map(d => <div key={d} className="h-4 flex items-center text-xs text-gray-500 w-8">{d}</div>)}
          </div>
          <div>
            <div className="flex gap-1 mb-1">
              {[0,3,6,9,12,15,18,21].map(h => (
                <div key={h} className="text-xs text-gray-400 w-4 text-center">{h}h</div>
              ))}
            </div>
            {heatmapData.map((row, di) => (
              <div key={di} className="flex gap-0.5 mb-0.5">
                {row.map((val, hi) => (
                  <div key={hi} className="w-4 h-4 rounded-sm" title={`${heatmapDays[di]} ${hi}:00 — ${val} interactions`}
                    style={{ backgroundColor: `rgba(99, 102, 241, ${val / 100})` }} />
                ))}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">Low</span>
              <div className="flex gap-0.5">
                {[0.1,0.3,0.5,0.7,1.0].map(o => (
                  <div key={o} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(99,102,241,${o})` }} />
                ))}
              </div>
              <span className="text-xs text-gray-400">High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function AdPlannerPage() {
  const [topNav, setTopNav] = useState<TopNav>('planner');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [engagement, setEngagement] = useState<{ events: EngagementEvent[]; reactions: { emoji_reaction: string; count: number }[]; funnel: { funnel_stage: string; count: number }[]; geo: { city: string; country: string; count: number }[]; devices: { device_type: string; count: number }[] } | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [visualTab, setVisualTab] = useState<VisualTab>('upload');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [form, setForm] = useState({
    campaign_id: '',
    topic: '',
    ad_message_type: '' as AdMessageType | '',
    platforms: [] as Platform[],
    headline: '',
    body_copy: '',
    cta: 'Learn More',
    emoji_set: [] as string[],
    hashtags: [] as string[],
    visual_url: '',
    visual_type: 'image',
    scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    status: 'draft',
    approval_status: 'pending',
    requires_approval: false,
    post_immediately: false,
  });
  const [hashtagInput, setHashtagInput] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [campaignsRes, statsRes, plansRes, engagementRes, assetsRes] = await Promise.allSettled([
        fetch('/api/admin/ads/campaigns?limit=50').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/ad-planner/stats').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/ad-planner/plans?limit=50').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/ad-planner/engagement?limit=20').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/ad-planner/assets?limit=20').then(r => r.ok ? r.json() : null),
      ]);

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value) {
        setCampaigns(campaignsRes.value.campaigns || []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (plansRes.status === 'fulfilled' && plansRes.value) {
        setPlans(plansRes.value.plans || []);
      }
      if (engagementRes.status === 'fulfilled' && engagementRes.value) {
        setEngagement(engagementRes.value);
      }
      if (assetsRes.status === 'fulfilled' && assetsRes.value) {
        setAssets(assetsRes.value.assets || []);
      }
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
    // Poll every 30 seconds
    pollRef.current = setInterval(loadData, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  // Generate headline template when ad type changes
  const handleAdTypeSelect = (type: AdMessageType) => {
    setForm(f => {
      const t = AD_TYPES.find(a => a.id === type);
      const headline = f.topic
        ? t?.template.replace('{topic}', f.topic) || f.headline
        : f.headline;
      return { ...f, ad_message_type: type, headline };
    });
  };

  const handlePlatformToggle = (p: Platform) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
      hashtags: f.platforms.includes(p) ? f.hashtags : [...new Set([...f.hashtags, ...(HASHTAG_SUGGESTIONS[p] || [])])].slice(0, 10)
    }));
  };

  const handleTopicChange = (topic: string) => {
    setForm(f => {
      const t = AD_TYPES.find(a => a.id === f.ad_message_type);
      const headline = t ? t.template.replace('{topic}', topic) : f.headline;
      return { ...f, topic, headline };
    });
  };

  const handleEmojiAdd = (emoji: string) => {
    if (!form.emoji_set.includes(emoji) && form.emoji_set.length < 10) {
      setForm(f => ({ ...f, emoji_set: [...f.emoji_set, emoji] }));
    }
  };

  const handleHashtagAdd = () => {
    const tag = hashtagInput.startsWith('#') ? hashtagInput : `#${hashtagInput}`;
    if (tag.length > 1 && !form.hashtags.includes(tag)) {
      setForm(f => ({ ...f, hashtags: [...f.hashtags, tag] }));
    }
    setHashtagInput('');
  };

  const handleAiGenerate = async () => {
    if (!form.topic || !form.ad_message_type || form.platforms.length === 0) {
      alert('Please fill in topic, ad type, and at least one platform first.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/admin/ad-planner/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: form.topic, adType: form.ad_message_type, platform: form.platforms[0] })
      });
      const data = await res.json();
      setForm(f => ({
        ...f,
        headline: data.headline || f.headline,
        body_copy: data.body || f.body_copy,
        cta: data.cta || f.cta,
        hashtags: [...new Set([...f.hashtags, ...(data.hashtags || [])])].slice(0, 10),
        emoji_set: [...new Set([...f.emoji_set, ...(data.emojis || [])])].slice(0, 10)
      }));
      if (data.model === 'fallback') {
        setSaveMsg('AI fallback used (Ollama unavailable) — content generated from templates');
        setTimeout(() => setSaveMsg(''), 4000);
      }
    } catch (e) { /* ignore */ }
    finally { setAiLoading(false); }
  };

  const handleSave = async (statusOverride?: string) => {
    const platform = form.platforms[0] || '';
    if (!form.topic || !form.ad_message_type || !platform || !form.headline || !form.body_copy) {
      setSaveMsg('Please fill in all required fields (topic, ad type, platform, headline, body)');
      setTimeout(() => setSaveMsg(''), 4000);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ad-planner/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: form.campaign_id || null,
          topic: form.topic,
          ad_message_type: form.ad_message_type,
          platform,
          headline: form.headline,
          body_copy: form.body_copy,
          cta: form.cta,
          visual_url: form.visual_url || null,
          visual_type: form.visual_type,
          emoji_set: form.emoji_set,
          hashtags: form.hashtags,
          scheduled_at: form.post_immediately ? new Date().toISOString() : new Date(form.scheduled_at).toISOString(),
          status: statusOverride || form.status,
          approval_status: form.requires_approval ? 'pending' : 'approved',
          created_by: 'admin'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg(`✅ Ad plan saved (ID: ${data.id?.slice(0, 8)}...)`);
        loadData();
        // Reset form partially
        setForm(f => ({ ...f, headline: '', body_copy: '', topic: '', emoji_set: [], hashtags: [], visual_url: '' }));
      } else {
        setSaveMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setSaveMsg('Save failed — please try again');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 5000);
  };

  const liveEngagementFeed = engagement?.events?.length ? engagement.events : DEMO_ENGAGEMENT_FEED;
  const liveReactions = engagement?.reactions?.length ? engagement.reactions : DEMO_REACTIONS;
  const isDemo = !engagement?.events?.length;

  const funnelCounts = FUNNEL_STAGES.map(s => {
    const found = engagement?.funnel?.find(f => f.funnel_stage === s);
    return { stage: s, count: found ? parseInt(String(found.count)) : 0 };
  });
  const maxFunnel = Math.max(...funnelCounts.map(f => f.count), 1);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Nav */}
      <div className="bg-white border-b px-4 py-0 flex items-center gap-0 sticky top-0 z-20">
        <div className="mr-4 font-bold text-indigo-700 text-lg py-3">📢 Ad Planner</div>
        {(['planner','calendar','tracking','reviews','analytics'] as TopNav[]).map(tab => (
          <button key={tab} onClick={() => setTopNav(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${topNav === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'tracking' ? 'Customer Tracking' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {loading && <span className="ml-auto text-xs text-gray-400 mr-4 animate-pulse">Refreshing…</span>}
      </div>

      {/* Calendar, Tracking, Reviews, Analytics tabs */}
      {topNav === 'calendar' && <div className="flex-1 overflow-y-auto"><CalendarTab plans={plans} /></div>}
      {topNav === 'tracking' && <div className="flex-1 overflow-y-auto"><CustomerTrackingTab stats={stats} /></div>}
      {topNav === 'reviews' && <div className="flex-1 overflow-y-auto"><ReviewsTab /></div>}
      {topNav === 'analytics' && <div className="flex-1 overflow-y-auto"><AnalyticsTab stats={stats} /></div>}

      {/* Main Planner — 3-panel layout */}
      {topNav === 'planner' && (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          <div className={`${leftCollapsed ? 'w-10' : 'w-80'} transition-all duration-200 bg-white border-r flex flex-col overflow-y-auto shrink-0`}>
            <div className="flex items-center justify-between p-3 border-b">
              {!leftCollapsed && <span className="text-sm font-semibold text-gray-700">📁 Campaigns & Queue</span>}
              <button onClick={() => setLeftCollapsed(x => !x)} className="text-gray-400 hover:text-gray-600 ml-auto">
                {leftCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!leftCollapsed && (
              <div className="p-3 space-y-4 flex-1">
                {/* Campaign selector */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Campaign</label>
                  <select value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— No campaign —</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    {campaigns.length === 0 && <option disabled>No campaigns found</option>}
                  </select>
                </div>

                {/* Ad type quick pick */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Quick Ad Type</label>
                  <div className="grid grid-cols-2 gap-1">
                    {AD_TYPES.map(t => (
                      <button key={t.id} onClick={() => handleAdTypeSelect(t.id)}
                        title={t.desc}
                        className={`text-xs px-2 py-1.5 rounded-lg text-white font-medium transition-all ${t.color} ${form.ad_message_type === t.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-105' : 'opacity-80 hover:opacity-100'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upcoming scheduled */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Upcoming ({(stats?.upcoming || []).length})</label>
                  <div className="space-y-1">
                    {(stats?.upcoming?.length ? stats.upcoming : plans.filter(p => p.status === 'scheduled').slice(0, 5)).map(p => (
                      <div key={p.id} className="bg-gray-50 rounded-lg p-2 text-xs">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`w-4 h-4 rounded text-white text-center text-xs leading-4 ${platformColor(p.platform)}`}>{platformBadge(p.platform)}</span>
                          <span className={`px-1 rounded text-xs ${statusBadge(p.status)}`}>{p.status}</span>
                        </div>
                        <div className="font-medium truncate">{p.headline}</div>
                        <div className="text-gray-400">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : ''}</div>
                      </div>
                    ))}
                    {!(stats?.upcoming?.length) && plans.filter(p => p.status === 'scheduled').length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">No scheduled posts</div>
                    )}
                  </div>
                </div>

                {/* Draft queue */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">
                    Drafts ({(stats?.drafts?.length || plans.filter(p => p.status === 'draft').length)})
                  </label>
                  <div className="space-y-1">
                    {(stats?.drafts?.length ? stats.drafts : plans.filter(p => p.status === 'draft').slice(0, 5)).map(p => (
                      <div key={p.id} className="bg-yellow-50 border border-yellow-100 rounded-lg p-2 text-xs">
                        <div className="font-medium truncate">{p.headline}</div>
                        <div className="text-gray-400">{timeAgo(p.created_at)}</div>
                      </div>
                    ))}
                    {!(stats?.drafts?.length) && plans.filter(p => p.status === 'draft').length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">No drafts</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: AD COMPOSER */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">✍️ Ad Composer</h2>
                <span className="text-xs text-gray-400">All fields auto-save</span>
              </div>

              <div className="p-4 space-y-5">
                {/* Topic */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    What is this ad about? <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.topic} onChange={e => handleTopicChange(e.target.value)}
                    placeholder="e.g. Yoga for beginners, Morning routine, Flexibility tips…"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>

                {/* Ad Message Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Ad Message Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AD_TYPES.map(t => (
                      <button key={t.id} onClick={() => handleAdTypeSelect(t.id)}
                        title={t.desc}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${form.ad_message_type === t.id ? `${t.color} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {form.ad_message_type && (
                    <p className="text-xs text-gray-400 mt-1">{AD_TYPES.find(t => t.id === form.ad_message_type)?.desc}</p>
                  )}
                </div>

                {/* Platform */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Platform <span className="text-red-500">*</span> <span className="text-xs text-gray-400">(multi-select)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button key={p.id} onClick={() => handlePlatformToggle(p.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border-2 transition-all ${form.platforms.includes(p.id) ? `${p.color} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <span className="font-bold text-xs">{p.badge}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Headline */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Headline <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${form.headline.length > 80 ? 'text-red-500' : 'text-gray-400'}`}>{form.headline.length}/90</span>
                      <button onClick={handleAiGenerate} disabled={aiLoading || !form.topic}
                        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg disabled:opacity-50 hover:bg-indigo-700 flex items-center gap-1">
                        {aiLoading ? <span className="animate-spin">⟳</span> : '🤖'} AI Generate
                      </button>
                    </div>
                  </div>
                  <input type="text" value={form.headline} maxLength={90}
                    onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                    placeholder="Enter compelling headline…"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>

                {/* Body Copy */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Body Copy <span className="text-red-500">*</span></label>
                    <span className={`text-xs ${form.body_copy.length > 450 ? 'text-red-500' : 'text-gray-400'}`}>{form.body_copy.length}/500</span>
                  </div>
                  <textarea value={form.body_copy} maxLength={500} rows={4}
                    onChange={e => setForm(f => ({ ...f, body_copy: e.target.value }))}
                    placeholder="Write compelling ad copy that speaks to your audience's pain points and desires…"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                </div>

                {/* CTA */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Call to Action</label>
                  <select value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))}
                    className="border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    {CTAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Emoji Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Emojis</label>
                    <button onClick={() => setEmojiPickerOpen(x => !x)}
                      className="text-xs text-indigo-600 hover:underline">{emojiPickerOpen ? 'Close picker' : 'Open picker'}</button>
                  </div>
                  {form.emoji_set.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {form.emoji_set.map(e => (
                        <span key={e} className="bg-gray-100 px-2 py-0.5 rounded-lg text-lg cursor-pointer hover:bg-red-100"
                          onClick={() => setForm(f => ({ ...f, emoji_set: f.emoji_set.filter(x => x !== e) }))}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                  {emojiPickerOpen && (
                    <div className="bg-gray-50 border rounded-xl p-3">
                      <div className="grid grid-cols-10 gap-1">
                        {BUSINESS_EMOJIS.map(e => (
                          <button key={e} onClick={() => handleEmojiAdd(e)}
                            className={`text-xl p-1 rounded hover:bg-white hover:shadow-sm transition-all ${form.emoji_set.includes(e) ? 'bg-indigo-100' : ''}`}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Hashtags</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={hashtagInput} onChange={e => setHashtagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleHashtagAdd(); } }}
                      placeholder="Type and press Enter…"
                      className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={handleHashtagAdd} className="px-3 py-2 bg-gray-100 rounded-xl text-sm hover:bg-gray-200">Add</button>
                  </div>
                  {form.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {form.hashtags.map(h => (
                        <span key={h} className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600"
                          onClick={() => setForm(f => ({ ...f, hashtags: f.hashtags.filter(x => x !== h) }))}>
                          {h} ×
                        </span>
                      ))}
                    </div>
                  )}
                  {form.platforms.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Suggested for {form.platforms[0]}:</div>
                      <div className="flex flex-wrap gap-1">
                        {(HASHTAG_SUGGESTIONS[form.platforms[0]] || []).filter(h => !form.hashtags.includes(h)).map(h => (
                          <button key={h} onClick={() => setForm(f => ({ ...f, hashtags: [...f.hashtags, h] }))}
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-600">
                            + {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Visual Asset</label>
                  <div className="flex gap-1 mb-3 border-b">
                    {(['upload','library','ai'] as VisualTab[]).map(t => (
                      <button key={t} onClick={() => setVisualTab(t)}
                        className={`px-3 py-1.5 text-sm border-b-2 transition-colors capitalize -mb-px ${visualTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                        {t === 'ai' ? 'AI Description' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>

                  {visualTab === 'upload' && (
                    <div>
                      <input type="text" value={form.visual_url} onChange={e => setForm(f => ({ ...f, visual_url: e.target.value }))}
                        placeholder="Paste image URL or upload path…"
                        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      {form.visual_url && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-1">Preview:</div>
                          <div className="relative w-32 h-20 border rounded-lg overflow-hidden bg-gray-100">
                            <img src={form.visual_url} alt="Preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = ''; }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {visualTab === 'library' && (
                    <div>
                      {assets.length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm border rounded-xl border-dashed">
                          No assets in library yet.<br />
                          <button onClick={() => setVisualTab('upload')} className="text-indigo-600 hover:underline mt-1">Upload the first asset →</button>
                        </div>
                      )}
                      {assets.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {assets.map(a => (
                            <button key={a.id} onClick={() => setForm(f => ({ ...f, visual_url: a.url, visual_type: a.asset_type }))}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 ${form.visual_url === a.url ? 'border-indigo-500' : 'border-gray-200'}`}>
                              <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {visualTab === 'ai' && (
                    <div className="bg-purple-50 rounded-xl p-4 text-sm text-gray-600 border border-purple-100">
                      <div className="font-medium mb-1">🎨 AI Visual Description</div>
                      <p className="text-xs text-gray-500">Describe your ideal visual and use this with your design team or AI image tools (DALL-E, Midjourney):</p>
                      <textarea rows={3} className="w-full mt-2 border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none bg-white"
                        placeholder={`A vibrant ${form.ad_message_type || 'topic'} style ad visual for ${form.platforms[0] || 'social media'}, featuring ${form.topic || 'your topic'}, bright colors, professional look…`} />
                    </div>
                  )}

                  {/* Ad visual type */}
                  <div className="mt-2 flex gap-2">
                    {(['image','video','carousel','gif'] as const).map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, visual_type: t }))}
                        className={`text-xs px-2 py-1 rounded-lg border ${form.visual_type === t ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 text-gray-600'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ad preview */}
                {(form.headline || form.body_copy) && (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-gray-100 px-3 py-1.5 text-xs text-gray-500 flex items-center gap-2">
                      <span>📱 Ad Preview</span>
                      <span className={`px-1.5 py-0.5 rounded text-white text-xs ${platformColor(form.platforms[0])}`}>{platformBadge(form.platforms[0])}</span>
                    </div>
                    <div className="p-4 bg-white">
                      {form.visual_url && (
                        <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                          <img src={form.visual_url} alt="Visual" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                        </div>
                      )}
                      <div className="font-bold text-sm">{form.headline || 'Your headline will appear here'}</div>
                      <div className="text-xs text-gray-600 mt-1 line-clamp-3">{form.body_copy || 'Your body copy…'}</div>
                      {form.emoji_set.length > 0 && <div className="mt-1 text-sm">{form.emoji_set.join(' ')}</div>}
                      <button className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg">{form.cta}</button>
                      {form.hashtags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {form.hashtags.slice(0, 4).map(h => <span key={h} className="text-xs text-blue-500">{h}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Schedule */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Schedule</label>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.post_immediately}
                        onChange={e => setForm(f => ({ ...f, post_immediately: e.target.checked }))}
                        className="rounded" />
                      Post Immediately
                    </label>
                  </div>
                  {!form.post_immediately && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Date & Time</label>
                        <input type="datetime-local" value={form.scheduled_at}
                          onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                          className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
                        <select className="w-full border rounded-xl px-3 py-2 text-sm">
                          <option>America/Toronto (EST)</option>
                          <option>America/New_York (EST)</option>
                          <option>America/Los_Angeles (PST)</option>
                          <option>Europe/London (GMT)</option>
                          <option>Asia/Kolkata (IST)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Approval */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.requires_approval}
                      onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))}
                      className="rounded" />
                    Requires approval before going live
                  </label>
                </div>

                {/* Save message */}
                {saveMsg && (
                  <div className={`text-sm px-4 py-2 rounded-xl ${saveMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {saveMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t">
                  <button onClick={() => handleSave('draft')} disabled={saving}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button onClick={() => handleSave('scheduled')} disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {form.post_immediately ? '⚡ Post Now' : '📅 Schedule'}
                  </button>
                  {form.requires_approval && (
                    <button onClick={() => handleSave('draft')} disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-xl text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
                      Submit for Approval
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: LIVE TRACKER */}
          <div className={`${rightCollapsed ? 'w-10' : 'w-80'} transition-all duration-200 bg-white border-l flex flex-col overflow-y-auto shrink-0`}>
            <div className="flex items-center justify-between p-3 border-b">
              {!rightCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">📡 Live Tracker</span>
                  {isDemo && <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">[Demo]</span>}
                </div>
              )}
              <button onClick={() => setRightCollapsed(x => !x)} className="text-gray-400 hover:text-gray-600">
                {rightCollapsed ? '◀' : '▶'}
              </button>
            </div>

            {!rightCollapsed && (
              <div className="p-3 space-y-4 flex-1">
                {/* Live metrics strip */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Impressions', value: (stats?.today.impressions || 0).toLocaleString(), icon: '👁', color: 'text-blue-600' },
                    { label: 'Clicks', value: (stats?.today.clicks || 0).toLocaleString(), icon: '🖱', color: 'text-green-600' },
                    { label: 'CTR', value: `${stats?.today.ctr || 0}%`, icon: '📊', color: 'text-indigo-600' },
                    { label: 'Leads', value: (stats?.today.leads || 0).toLocaleString(), icon: '🎯', color: 'text-purple-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-2 text-center">
                      <div className="text-base">{m.icon}</div>
                      <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-xs text-gray-400">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Engagement feed */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Recent Activity</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {liveEngagementFeed.slice(0, 10).map((e, i) => (
                      <div key={`evt-${i}`} className="bg-gray-50 rounded-lg p-2 text-xs">
                        <div className="flex items-start gap-1">
                          <span className="text-base">{eventIcon(e.event_type)}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium capitalize">{e.event_type}</span>
                            {e.city && <span className="text-gray-400"> from {e.city}</span>}
                            <span className={`ml-1 px-1 rounded text-white text-xs ${platformColor(e.platform)}`}>{platformBadge(e.platform)}</span>
                          </div>
                        </div>
                        <div className="text-gray-400 mt-0.5">{timeAgo(e.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reaction bar */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Reactions</div>
                  <div className="space-y-1">
                    {REACTION_EMOJIS.map(r => {
                      const count = liveReactions.find(x => x.emoji_reaction === r.key)?.count || 0;
                      const max = Math.max(...liveReactions.map(x => x.count), 1);
                      return (
                        <div key={r.key} className="flex items-center gap-2">
                          <span className="text-base w-6">{r.emoji}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-pink-400 rounded-full h-2 transition-all" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right">{count.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Funnel stage rings */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Funnel Stages</div>
                  <div className="space-y-1">
                    {funnelCounts.map((f, i) => (
                      <div key={f.stage} className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${FUNNEL_COLORS[i]}`} />
                        <span className="text-xs text-gray-600 capitalize flex-1">{f.stage}</span>
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className={`${FUNNEL_COLORS[i]} rounded-full h-1.5`} style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 w-8 text-right">{f.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geographic */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Top Cities</div>
                  {(engagement?.geo?.length ? engagement.geo : [
                    { city: 'Toronto', country: 'CA', count: 342 }, { city: 'New York', country: 'US', count: 234 },
                    { city: 'London', country: 'GB', count: 187 }, { city: 'Vancouver', country: 'CA', count: 154 },
                    { city: 'Sydney', country: 'AU', count: 123 }
                  ]).map(g => (
                    <div key={g.city} className="flex items-center gap-1 text-xs mb-1">
                      <span className="flex-1 truncate">{g.city}, {g.country}</span>
                      <span className="text-gray-500">{typeof g.count === 'string' ? parseInt(g.count) : g.count}</span>
                    </div>
                  ))}
                </div>

                {/* Device split */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Device Split</div>
                  {(engagement?.devices?.length ? engagement.devices.map(d => ({
                    label: d.device_type, pct: Math.round((parseInt(String(d.count)) / Math.max(engagement.devices.reduce((s, x) => s + parseInt(String(x.count)), 0), 1)) * 100), color: 'bg-indigo-500'
                  })) : [{ label: 'Mobile', pct: 68, color: 'bg-pink-500' }, { label: 'Desktop', pct: 24, color: 'bg-blue-500' }, { label: 'Tablet', pct: 8, color: 'bg-green-500' }]).map(d => (
                    <div key={d.label} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-600 w-16 capitalize">{d.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${d.color} rounded-full h-2`} style={{ width: `${d.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{d.pct}%</span>
                    </div>
                  ))}
                </div>

                {/* Latest feedback */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Latest Feedback</div>
                  {[
                    { name: 'Sarah M.', rating: 5, comment: 'Great ad!', sentiment: 'positive' },
                    { name: 'John D.', rating: 3, comment: 'Decent content.', sentiment: 'neutral' },
                    { name: 'Emma W.', rating: 2, comment: 'Not relevant.', sentiment: 'negative' },
                  ].map((f, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-2 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{f.name}</span>
                        <StarRating rating={f.rating} />
                      </div>
                      <p className="text-xs text-gray-600">{f.comment}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${sentimentBadge(f.sentiment)}`}>{f.sentiment}</span>
                    </div>
                  ))}
                </div>

                {/* Conversion tracking */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Conversion Tracking</div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats?.today.conversions || 7}</div>
                    <div className="text-xs text-gray-500">Today's Conversions</div>
                    <div className="text-xs text-gray-400 mt-1">Polls every 30s</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
