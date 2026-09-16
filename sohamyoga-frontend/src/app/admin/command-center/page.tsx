'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface UnifiedItem {
  id: string;
  item_type: 'social_post' | 'ad';
  source_id: string;
  platform: string;
  content_type: string;
  caption: string | null;
  headline: string | null;
  media_urls: string[];
  hashtags: string[];
  cta_text: string | null;
  cta_url: string | null;
  status: string;
  approval_status: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  external_url: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
  engagement_rate: number;
  failure_reason: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionLog {
  id: string;
  action: string;
  actor: string;
  notes: string | null;
  created_at: string;
}

interface Stats {
  by_platform: Record<string, number>;
  by_status: Record<string, number>;
  total_impressions: number;
  total_spend: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PLATFORMS = [
  // ── Core ─────────────────────────────────────────────────────────────────
  { key: 'youtube', label: 'YouTube', emoji: '📺', color: '#FF0000', group: 'core' },
  { key: 'facebook', label: 'Facebook', emoji: '📘', color: '#1877F2', group: 'core' },
  { key: 'instagram', label: 'Instagram', emoji: '📸', color: '#E1306C', group: 'core' },
  { key: 'x_twitter', label: 'Twitter/X', emoji: '🐦', color: '#1DA1F2', group: 'core' },
  { key: 'linkedin', label: 'LinkedIn', emoji: '💼', color: '#0A66C2', group: 'core' },
  { key: 'tiktok', label: 'TikTok', emoji: '🎵', color: '#010101', group: 'core' },
  { key: 'google_ads', label: 'Google Ads', emoji: '🔴', color: '#4285F4', group: 'core' },
  { key: 'meta_ads', label: 'Meta Ads', emoji: '📊', color: '#0082FB', group: 'core' },
  // ── 🔴 High Priority ──────────────────────────────────────────────────────
  { key: 'whatsapp_business', label: 'WhatsApp Business', emoji: '💬', color: '#25D366', group: 'red' },
  { key: 'pinterest', label: 'Pinterest', emoji: '📌', color: '#E60023', group: 'red' },
  { key: 'reddit', label: 'Reddit', emoji: '🤖', color: '#FF4500', group: 'red' },
  // ── 🟠 Medium-High Priority ───────────────────────────────────────────────
  { key: 'snapchat', label: 'Snapchat', emoji: '👻', color: '#FFFC00', group: 'orange' },
  { key: 'discord', label: 'Discord', emoji: '🎮', color: '#5865F2', group: 'orange' },
  { key: 'twitch', label: 'Twitch', emoji: '🎮', color: '#9146FF', group: 'orange' },
  { key: 'medium', label: 'Medium', emoji: '✍️', color: '#12100E', group: 'orange' },
  { key: 'substack', label: 'Substack', emoji: '📧', color: '#FF6719', group: 'orange' },
  { key: 'threads', label: 'Threads', emoji: '🧵', color: '#000000', group: 'orange' },
  { key: 'quora', label: 'Quora', emoji: '❓', color: '#B92B27', group: 'orange' },
  { key: 'tumblr', label: 'Tumblr', emoji: '🌀', color: '#35465C', group: 'orange' },
  { key: 'mastodon', label: 'Mastodon', emoji: '🐘', color: '#6364FF', group: 'orange' },
  { key: 'bluesky', label: 'Bluesky', emoji: '🦋', color: '#0085FF', group: 'orange' },
  // ── 🟡 Medium Priority ────────────────────────────────────────────────────
  { key: 'github', label: 'GitHub', emoji: '🐱', color: '#181717', group: 'yellow' },
  { key: 'gitlab', label: 'GitLab', emoji: '🦊', color: '#FCA121', group: 'yellow' },
  { key: 'google_business', label: 'Google Business', emoji: '🗺️', color: '#4285F4', group: 'yellow' },
  { key: 'trustpilot', label: 'Trustpilot', emoji: '⭐', color: '#00B67A', group: 'yellow' },
  { key: 'vimeo', label: 'Vimeo', emoji: '🎬', color: '#1AB7EA', group: 'yellow' },
  { key: 'patreon', label: 'Patreon', emoji: '🎨', color: '#FF424D', group: 'yellow' },
  { key: 'soundcloud', label: 'SoundCloud', emoji: '🎵', color: '#FF5500', group: 'yellow' },
  { key: 'spotify', label: 'Spotify', emoji: '🎙️', color: '#1DB954', group: 'yellow' },
  { key: 'apple_podcasts', label: 'Apple Podcasts', emoji: '🎧', color: '#872EC4', group: 'yellow' },
  { key: 'dailymotion', label: 'Dailymotion', emoji: '📺', color: '#0066DC', group: 'yellow' },
  { key: 'yelp', label: 'Yelp', emoji: '⭐', color: '#D32323', group: 'yellow' },
  { key: 'tripadvisor', label: 'TripAdvisor', emoji: '🦉', color: '#34E0A1', group: 'yellow' },
  { key: 'stack_overflow', label: 'Stack Overflow', emoji: '💻', color: '#F58025', group: 'yellow' },
];

const PLATFORM_CONTENT_TYPES: Record<string, string[]> = {
  youtube: ['video_post', 'short', 'story'],
  facebook: ['text_post', 'image_post', 'video_post', 'reel', 'story', 'carousel'],
  instagram: ['image_post', 'video_post', 'reel', 'story', 'carousel'],
  x_twitter: ['text_post', 'image_post', 'video_post'],
  linkedin: ['text_post', 'image_post', 'video_post', 'carousel'],
  tiktok: ['video_post', 'reel'],
  google_ads: ['search_ad', 'display_ad', 'video_ad'],
  meta_ads: ['display_ad', 'video_ad', 'carousel', 'story_ad'],
  // Extended platforms
  whatsapp_business: ['text_message', 'image_message', 'video_message', 'template_message', 'document_message', 'catalog_message'],
  pinterest: ['pin', 'idea_pin', 'video_pin', 'rich_pin'],
  reddit: ['text_post', 'link_post', 'image_post', 'video_post', 'poll'],
  snapchat: ['story', 'spotlight', 'snap_ad', 'collection_ad'],
  discord: ['channel_message', 'embed', 'announcement', 'forum_post'],
  twitch: ['stream_title_update', 'clip_promotion', 'channel_points_reward'],
  medium: ['article', 'response', 'series'],
  substack: ['newsletter', 'thread', 'podcast_episode'],
  threads: ['text_post', 'image_post', 'video_post'],
  quora: ['answer', 'space_post', 'blog_post'],
  tumblr: ['text_post', 'photo_post', 'video_post', 'audio_post', 'quote_post', 'link_post', 'chat_post'],
  mastodon: ['toot', 'boost', 'poll', 'thread'],
  bluesky: ['post', 'thread', 'quote_post'],
  github: ['release', 'discussion', 'gist'],
  gitlab: ['release', 'snippet', 'wiki_page'],
  google_business: ['standard_post', 'event_post', 'offer_post', 'product_post'],
  trustpilot: ['review_invitation', 'review_response', 'service_review'],
  vimeo: ['video_upload', 'showcase', 'project'],
  patreon: ['creator_post', 'patron_only_post', 'audio_post', 'poll'],
  soundcloud: ['track_upload', 'playlist', 'repost'],
  spotify: ['podcast_episode', 'show_update'],
  apple_podcasts: ['podcast_episode', 'show_notes'],
  dailymotion: ['video_upload', 'live_stream'],
  yelp: ['business_response', 'owner_post', 'offer'],
  tripadvisor: ['management_response', 'experience_update'],
  stack_overflow: ['question', 'answer', 'documentation_article'],
};

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  x_twitter: 280, instagram: 2200, facebook: 63206,
  linkedin: 3000, tiktok: 2200, youtube: 5000,
  google_ads: 90, meta_ads: 125,
  // Extended platforms
  whatsapp_business: 4096, pinterest: 500, reddit: 40000,
  snapchat: 250, discord: 2000, twitch: 140, medium: 100000,
  substack: 500000, threads: 500, quora: 100000, tumblr: 500000,
  mastodon: 500, bluesky: 300, github: 50000, gitlab: 50000,
  google_business: 1500, trustpilot: 3000, vimeo: 5000,
  patreon: 50000, soundcloud: 5000, spotify: 4000,
  apple_podcasts: 4000, dailymotion: 2000, yelp: 5000,
  tripadvisor: 2000, stack_overflow: 30000,
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  published: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-400 line-through',
  queued: 'bg-purple-100 text-purple-700',
  ended: 'bg-slate-100 text-slate-600',
};

const APPROVAL_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border border-yellow-300',
  approved: 'bg-green-50 text-green-700 border border-green-300',
  rejected: 'bg-red-50 text-red-700 border border-red-300',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function platformEmoji(p: string) {
  return PLATFORMS.find(x => x.key === p)?.emoji ?? '🌐';
}
function platformColor(p: string) {
  return PLATFORMS.find(x => x.key === p)?.color ?? '#888';
}
function fmtNum(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Small components ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  const isLive = status === 'live';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      {status}
    </span>
  );
}

function ApprovalBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cls = APPROVAL_COLORS[status] ?? 'bg-gray-50 text-gray-600 border border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${cls}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ by_platform: {}, by_status: {}, total_impressions: 0, total_spend: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Filters
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'social_post' | 'ad'>('all');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'grid'>('list');

  // Selected item for right panel
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [rightPanelMode, setRightPanelMode] = useState<'detail' | 'create'>('detail');
  const [createType, setCreateType] = useState<'social_post' | 'ad'>('social_post');

  // Edit state (right panel)
  const [editCaption, setEditCaption] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editHashtags, setEditHashtags] = useState<string[]>([]);
  const [editHashtagInput, setEditHashtagInput] = useState('');
  const [editCtaText, setEditCtaText] = useState('');
  const [editCtaUrl, setEditCtaUrl] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editApproval, setEditApproval] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editRejectionReason, setEditRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newPlatform, setNewPlatform] = useState('facebook');
  const [newContentType, setNewContentType] = useState('text_post');
  const [newCaption, setNewCaption] = useState('');
  const [newHeadline, setNewHeadline] = useState('');
  const [newCtaText, setNewCtaText] = useState('');
  const [newCtaUrl, setNewCtaUrl] = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [newHashtags, setNewHashtags] = useState<string[]>([]);
  const [newHashtagInput, setNewHashtagInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Calendar state
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split('T')[0];
  });
  const [calendarData, setCalendarData] = useState<Record<string, UnifiedItem[]>>({});

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Live metric refresh interval
  const liveRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-save debounce
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Date range helper ────────────────────────────────────────────────────
  function getDateRange() {
    const now = new Date();
    if (dateRange === 'today') {
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    } else if (dateRange === 'week') {
      const from = new Date(now); from.setDate(from.getDate() - 7);
      return { from: from.toISOString(), to: now.toISOString() };
    } else if (dateRange === 'month') {
      const from = new Date(now); from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    return {};
  }

  // ── Fetch items ──────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentOffset = reset ? 0 : offset;
    const params = new URLSearchParams();
    if (selectedPlatforms.length) params.set('platforms', selectedPlatforms.join(','));
    if (itemTypeFilter !== 'all') params.set('item_type', itemTypeFilter);
    if (statusFilter.length) params.set('status', statusFilter.join(','));
    if (search) params.set('search', search);
    params.set('limit', '20');
    params.set('offset', String(currentOffset));
    const dr = getDateRange();
    if (dr.from) params.set('date_from', dr.from);
    if (dr.to) params.set('date_to', dr.to);

    try {
      const res = await fetch(`/api/admin/command-center/items?${params}`);
      const data = await res.json() as { items: UnifiedItem[]; total: number; stats: Stats };
      if (reset) {
        setItems(data.items ?? []);
        setOffset(20);
      } else {
        setItems(prev => [...prev, ...(data.items ?? [])]);
        setOffset(prev => prev + 20);
      }
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { by_platform: {}, by_status: {}, total_impressions: 0, total_spend: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedPlatforms, itemTypeFilter, statusFilter, search, dateRange, offset]);

  useEffect(() => { void fetchItems(true); }, [selectedPlatforms, itemTypeFilter, statusFilter, search, dateRange]);

  // ── Calendar fetch ───────────────────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    const res = await fetch(`/api/admin/command-center/calendar?week_start=${calendarWeekStart}`);
    const data = await res.json() as { by_date: Record<string, UnifiedItem[]> };
    setCalendarData(data.by_date ?? {});
  }, [calendarWeekStart]);

  useEffect(() => { if (viewMode === 'calendar') void fetchCalendar(); }, [viewMode, calendarWeekStart]);

  // ── Live refresh interval ────────────────────────────────────────────────
  useEffect(() => {
    if (selectedItem && (selectedItem.status === 'live' || selectedItem.status === 'published')) {
      liveRefreshRef.current = setInterval(async () => {
        const res = await fetch(`/api/admin/command-center/items/${selectedItem.id}`);
        const data = await res.json() as { item: UnifiedItem };
        if (data.item) {
          setSelectedItem(data.item);
          setItems(prev => prev.map(i => i.id === data.item.id ? data.item : i));
        }
      }, 60_000);
    }
    return () => { if (liveRefreshRef.current) clearInterval(liveRefreshRef.current); };
  }, [selectedItem?.id, selectedItem?.status]);

  // ── Select item ──────────────────────────────────────────────────────────
  async function selectItem(item: UnifiedItem) {
    setSelectedItem(item);
    setRightPanelMode('detail');
    setEditCaption(item.caption ?? '');
    setEditHeadline(item.headline ?? '');
    setEditHashtags(item.hashtags ?? []);
    setEditCtaText(item.cta_text ?? '');
    setEditCtaUrl(item.cta_url ?? '');
    setEditStatus(item.status);
    setEditApproval(item.approval_status ?? '');
    setEditScheduledAt(item.scheduled_at ? item.scheduled_at.slice(0, 16) : '');
    setEditRejectionReason(item.failure_reason ?? '');

    // Fetch action log
    try {
      const res = await fetch(`/api/admin/command-center/items/${item.id}`);
      const data = await res.json() as { action_log: ActionLog[] };
      setActionLog(data.action_log ?? []);
    } catch { setActionLog([]); }
  }

  // ── Auto-save on blur ────────────────────────────────────────────────────
  function scheduleAutoSave(fields: Record<string, unknown>) {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!selectedItem) return;
      await fetch(`/api/admin/command-center/items/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    }, 800);
  }

  // ── PATCH item ───────────────────────────────────────────────────────────
  async function patchItem(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/command-center/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json() as { item: UnifiedItem };
    if (data.item) {
      setItems(prev => prev.map(i => i.id === id ? data.item : i));
      if (selectedItem?.id === id) setSelectedItem(data.item);
    }
    return data.item;
  }

  // ── Save all changes ─────────────────────────────────────────────────────
  async function saveChanges() {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await patchItem(selectedItem.id, {
        caption: editCaption, headline: editHeadline, hashtags: editHashtags,
        cta_text: editCtaText, cta_url: editCtaUrl, status: editStatus,
        approval_status: editApproval,
        scheduled_at: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
        failure_reason: editRejectionReason || null,
      });
    } finally { setSaving(false); }
  }

  // ── Quick actions ────────────────────────────────────────────────────────
  async function quickPause(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/admin/command-center/items/${id}/pause`, { method: 'POST' });
    const data = await res.json() as { item: UnifiedItem };
    if (data.item) setItems(prev => prev.map(i => i.id === id ? data.item : i));
    if (selectedItem?.id === id && data.item) setSelectedItem(data.item);
  }

  async function quickResume(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/admin/command-center/items/${id}/resume`, { method: 'POST' });
    const data = await res.json() as { item: UnifiedItem };
    if (data.item) setItems(prev => prev.map(i => i.id === id ? data.item : i));
    if (selectedItem?.id === id && data.item) setSelectedItem(data.item);
  }

  async function quickDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/admin/command-center/items/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    setTotal(prev => prev - 1);
  }

  async function quickDuplicate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/admin/command-center/items/${id}/duplicate`, { method: 'POST' });
    const data = await res.json() as { item: UnifiedItem };
    if (data.item) { setItems(prev => [data.item, ...prev]); setTotal(prev => prev + 1); }
  }

  async function syncMetrics(id: string) {
    await fetch(`/api/admin/command-center/sync-metrics/${id}`, { method: 'POST' });
    const res = await fetch(`/api/admin/command-center/items/${id}`);
    const data = await res.json() as { item: UnifiedItem };
    if (data.item) {
      setSelectedItem(data.item);
      setItems(prev => prev.map(i => i.id === id ? data.item : i));
    }
  }

  async function syncAll() {
    await fetch('/api/admin/command-center/sync-all', { method: 'POST' });
  }

  // ── Create item ──────────────────────────────────────────────────────────
  async function createItem(postNow: boolean) {
    setCreating(true);
    try {
      const body = {
        item_type: createType, platform: newPlatform, content_type: newContentType,
        caption: newCaption, headline: newHeadline,
        hashtags: newHashtags, cta_text: newCtaText, cta_url: newCtaUrl,
        scheduled_at: postNow ? new Date().toISOString() : (newScheduledAt ? new Date(newScheduledAt).toISOString() : undefined),
        status: postNow ? 'scheduled' : 'draft',
        approval_status: createType === 'ad' ? 'pending' : undefined,
      };
      const res = await fetch('/api/admin/command-center/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json() as { item: UnifiedItem };
      if (data.item) {
        setItems(prev => [data.item, ...prev]);
        setTotal(prev => prev + 1);
        setSelectedItem(data.item);
        setRightPanelMode('detail');
        // Reset form
        setNewCaption(''); setNewHeadline(''); setNewHashtags([]); setNewCtaText(''); setNewCtaUrl(''); setNewScheduledAt('');
      }
    } finally { setCreating(false); }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function bulkPause() {
    for (const id of selectedIds) await fetch(`/api/admin/command-center/items/${id}/pause`, { method: 'POST' });
    void fetchItems(true);
    setSelectedIds(new Set());
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return;
    for (const id of selectedIds) await fetch(`/api/admin/command-center/items/${id}`, { method: 'DELETE' });
    void fetchItems(true);
    setSelectedIds(new Set());
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (selectedPlatforms.length) params.set('platforms', selectedPlatforms.join(','));
    if (statusFilter.length) params.set('status', statusFilter.join(','));
    if (search) params.set('search', search);
    window.open(`/api/admin/command-center/export?${params}`, '_blank');
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  function calendarDays() {
    const start = new Date(calendarWeekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d;
    });
  }

  function prevWeek() {
    const d = new Date(calendarWeekStart); d.setDate(d.getDate() - 7);
    setCalendarWeekStart(d.toISOString().split('T')[0]);
  }
  function nextWeek() {
    const d = new Date(calendarWeekStart); d.setDate(d.getDate() + 7);
    setCalendarWeekStart(d.toISOString().split('T')[0]);
  }
  function goToday() {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1);
    setCalendarWeekStart(d.toISOString().split('T')[0]);
  }

  // ── Character count ──────────────────────────────────────────────────────
  function charCountColor(text: string, platform: string) {
    const limit = PLATFORM_CHAR_LIMITS[platform] ?? 5000;
    const pct = text.length / limit;
    if (pct < 0.7) return 'bg-green-400';
    if (pct < 0.9) return 'bg-yellow-400';
    return 'bg-red-500';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const rightPanelOpen = selectedItem !== null || rightPanelMode === 'create';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* ── TOP TOOLBAR ─────────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          🎯 Command Center
          <span className="text-sm font-normal text-gray-500">({total} items)</span>
        </h1>

        {/* Search */}
        <div className="flex-1 min-w-48">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Search caption, headline, hashtags…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
            />
          </div>
        </div>

        {/* View mode */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['list', 'calendar', 'grid'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-xs font-medium ${viewMode === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {m === 'list' ? '☰ List' : m === 'calendar' ? '📅 Calendar' : '⊞ Grid'}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
            <span className="text-xs font-medium text-indigo-700">{selectedIds.size} selected</span>
            <button onClick={bulkPause} className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">⏸ Pause All</button>
            <button onClick={bulkDelete} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">🗑 Delete All</button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => { setRightPanelMode('create'); setCreateType('social_post'); setSelectedItem(null); }}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >+ New Post</button>
          <button
            onClick={() => { setRightPanelMode('create'); setCreateType('ad'); setSelectedItem(null); }}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
          >+ New Ad</button>
          <button onClick={syncAll} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">🔄 Sync All</button>
          <button onClick={exportCsv} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">↓ Export</button>
        </div>
      </div>

      {/* ── MAIN 3-PANEL GRID ────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns: rightPanelOpen ? '280px 1fr 320px' : '280px 1fr', transition: 'grid-template-columns 0.2s ease' }}
      >
        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div className="overflow-y-auto bg-white border-r border-gray-200 p-4 flex flex-col gap-5">
          {/* Quick Stats */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-indigo-50 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-indigo-700">{total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-blue-700">{stats.by_status['scheduled'] ?? 0}</div>
                <div className="text-xs text-gray-500">Scheduled</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-green-700">{stats.by_status['live'] ?? 0}</div>
                <div className="text-xs text-gray-500">Live Now</div>
              </div>
              <div className={`rounded-lg p-2 text-center ${(stats.by_status['failed'] ?? 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-xl font-bold ${(stats.by_status['failed'] ?? 0) > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                  {stats.by_status['failed'] ?? 0}
                </div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center col-span-2">
                <div className="text-lg font-bold text-purple-700">{fmtNum(stats.total_impressions)}</div>
                <div className="text-xs text-gray-500">Total Reach</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center col-span-2">
                <div className="text-lg font-bold text-orange-700">${Number(stats.total_spend).toFixed(2)}</div>
                <div className="text-xs text-gray-500">Total Spend</div>
              </div>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Platforms</h3>
            <div className="flex flex-col gap-1">
              {/* Core */}
              {PLATFORMS.filter(p => p.group === 'core').map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                  <input type="checkbox" checked={selectedPlatforms.includes(p.key)}
                    onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev, p.key] : prev.filter(x => x !== p.key))}
                    className="rounded text-indigo-600" />
                  <span className="text-sm">{p.emoji} {p.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">{stats.by_platform[p.key] ?? 0}</span>
                </label>
              ))}
              {/* 🔴 High Priority */}
              <div className="mt-2 mb-1 text-xs font-semibold text-red-600">🔴 High Priority</div>
              {PLATFORMS.filter(p => p.group === 'red').map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer hover:bg-red-50 rounded p-1">
                  <input type="checkbox" checked={selectedPlatforms.includes(p.key)}
                    onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev, p.key] : prev.filter(x => x !== p.key))}
                    className="rounded text-red-600" />
                  <span className="text-sm">{p.emoji} {p.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">{stats.by_platform[p.key] ?? 0}</span>
                </label>
              ))}
              {/* 🟠 Medium-High Priority */}
              <div className="mt-2 mb-1 text-xs font-semibold text-orange-600">🟠 Medium-High</div>
              {PLATFORMS.filter(p => p.group === 'orange').map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer hover:bg-orange-50 rounded p-1">
                  <input type="checkbox" checked={selectedPlatforms.includes(p.key)}
                    onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev, p.key] : prev.filter(x => x !== p.key))}
                    className="rounded text-orange-600" />
                  <span className="text-sm">{p.emoji} {p.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">{stats.by_platform[p.key] ?? 0}</span>
                </label>
              ))}
              {/* 🟡 Medium Priority */}
              <div className="mt-2 mb-1 text-xs font-semibold text-yellow-700">🟡 Medium Priority</div>
              {PLATFORMS.filter(p => p.group === 'yellow').map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer hover:bg-yellow-50 rounded p-1">
                  <input type="checkbox" checked={selectedPlatforms.includes(p.key)}
                    onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev, p.key] : prev.filter(x => x !== p.key))}
                    className="rounded text-yellow-700" />
                  <span className="text-sm">{p.emoji} {p.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">{stats.by_platform[p.key] ?? 0}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</h3>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'social_post', 'ad'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setItemTypeFilter(t)}
                  className={`px-2 py-1 rounded-full text-xs ${itemTypeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t === 'all' ? 'All' : t === 'social_post' ? 'Social Posts' : 'Ads'}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
            <div className="flex gap-1 flex-wrap">
              {['draft', 'scheduled', 'live', 'published', 'paused', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={`px-2 py-1 rounded-full text-xs ${statusFilter.includes(s) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Range</h3>
            <div className="flex flex-col gap-1">
              {(['today', 'week', 'month'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDateRange(d)}
                  className={`text-left px-3 py-1.5 rounded text-sm ${dateRange === d ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {d === 'today' ? 'Today' : d === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL ────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-400 text-sm animate-pulse">Loading items…</div>
            </div>
          ) : viewMode === 'list' ? (
            <ListView
              items={items} total={total} loadingMore={loadingMore}
              selectedIds={selectedIds} setSelectedIds={setSelectedIds}
              toggleSelectAll={toggleSelectAll}
              onSelect={selectItem} selectedItem={selectedItem}
              onPause={quickPause} onResume={quickResume}
              onDelete={quickDelete} onDuplicate={quickDuplicate}
              onLoadMore={() => fetchItems(false)}
            />
          ) : viewMode === 'calendar' ? (
            <CalendarView
              days={calendarDays()} data={calendarData}
              onPrev={prevWeek} onNext={nextWeek} onToday={goToday}
              onSelect={selectItem}
              onNewItem={(date) => {
                setRightPanelMode('create');
                setCreateType('social_post');
                setSelectedItem(null);
                setNewScheduledAt(date + 'T09:00');
              }}
            />
          ) : (
            <GridView
              items={items} total={total} loadingMore={loadingMore}
              onSelect={selectItem} selectedItem={selectedItem}
              onPause={quickPause} onResume={quickResume}
              onDelete={quickDelete} onDuplicate={quickDuplicate}
              onLoadMore={() => fetchItems(false)}
            />
          )}
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        {rightPanelOpen && (
          <div className="overflow-y-auto border-l border-gray-200 bg-white flex flex-col">
            {rightPanelMode === 'create' ? (
              <CreateForm
                createType={createType} setCreateType={setCreateType}
                platform={newPlatform} setPlatform={setNewPlatform}
                contentType={newContentType} setContentType={setNewContentType}
                caption={newCaption} setCaption={setNewCaption}
                headline={newHeadline} setHeadline={setNewHeadline}
                hashtags={newHashtags} setHashtags={setNewHashtags}
                hashtagInput={newHashtagInput} setHashtagInput={setNewHashtagInput}
                ctaText={newCtaText} setCtaText={setNewCtaText}
                ctaUrl={newCtaUrl} setCtaUrl={setNewCtaUrl}
                scheduledAt={newScheduledAt} setScheduledAt={setNewScheduledAt}
                creating={creating}
                onCreate={createItem}
                onClose={() => { setRightPanelMode('detail'); }}
              />
            ) : selectedItem ? (
              <DetailPanel
                item={selectedItem} actionLog={actionLog}
                editCaption={editCaption} setEditCaption={setEditCaption}
                editHeadline={editHeadline} setEditHeadline={setEditHeadline}
                editHashtags={editHashtags} setEditHashtags={setEditHashtags}
                editHashtagInput={editHashtagInput} setEditHashtagInput={setEditHashtagInput}
                editCtaText={editCtaText} setEditCtaText={setEditCtaText}
                editCtaUrl={editCtaUrl} setEditCtaUrl={setEditCtaUrl}
                editStatus={editStatus} setEditStatus={setEditStatus}
                editApproval={editApproval} setEditApproval={setEditApproval}
                editScheduledAt={editScheduledAt} setEditScheduledAt={setEditScheduledAt}
                editRejectionReason={editRejectionReason} setEditRejectionReason={setEditRejectionReason}
                saving={saving}
                onSave={saveChanges}
                onClose={() => setSelectedItem(null)}
                onAutoSave={scheduleAutoSave}
                onPause={async () => { const e = { stopPropagation: () => {} } as React.MouseEvent; await quickPause(selectedItem.id, e); }}
                onResume={async () => { const e = { stopPropagation: () => {} } as React.MouseEvent; await quickResume(selectedItem.id, e); }}
                onDuplicate={async () => { const e = { stopPropagation: () => {} } as React.MouseEvent; await quickDuplicate(selectedItem.id, e); }}
                onDelete={async () => { const e = { stopPropagation: () => {} } as React.MouseEvent; await quickDelete(selectedItem.id, e); }}
                onSyncMetrics={() => syncMetrics(selectedItem.id)}
                charCountColor={charCountColor}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LIST VIEW ───────────────────────────────────────────────────────────────
function ListView({
  items, total, loadingMore, selectedIds, setSelectedIds, toggleSelectAll,
  onSelect, selectedItem, onPause, onResume, onDelete, onDuplicate, onLoadMore,
}: {
  items: UnifiedItem[]; total: number; loadingMore: boolean;
  selectedIds: Set<string>; setSelectedIds: (s: Set<string>) => void;
  toggleSelectAll: () => void;
  onSelect: (item: UnifiedItem) => void; selectedItem: UnifiedItem | null;
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDuplicate: (id: string, e: React.MouseEvent) => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll} className="rounded" />
        <span className="text-xs text-gray-500">{items.length} of {total} items</span>
      </div>

      {/* Items */}
      <div className="flex flex-col divide-y divide-gray-100">
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50 border-l-2 border-l-indigo-500' : ''}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={e => {
                  e.stopPropagation();
                  const next = new Set(selectedIds);
                  if (e.target.checked) next.add(item.id); else next.delete(item.id);
                  setSelectedIds(next);
                }}
                onClick={e => e.stopPropagation()}
                className="rounded mt-1"
              />
              <div className="flex-1 min-w-0">
                {/* Row 1 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{platformEmoji(item.platform)}</span>
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.content_type.replace(/_/g, ' ')}</span>
                  {item.item_type === 'ad' && item.approval_status && <ApprovalBadge status={item.approval_status} />}
                  <span className="ml-auto text-xs text-gray-400">{fmtDate(item.scheduled_at ?? item.created_at)}</span>
                </div>
                {/* Caption */}
                <p className="text-sm text-gray-700 mt-1 truncate">
                  {item.headline ? <strong>{item.headline} — </strong> : null}
                  {item.caption?.slice(0, 100) ?? <span className="text-gray-400 italic">No caption</span>}
                </p>
                {/* Metrics */}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>👁 {fmtNum(item.impressions)}</span>
                  <span>❤️ {fmtNum(item.likes)}</span>
                  <span>💬 {fmtNum(item.comments)}</span>
                  <span>🔁 {fmtNum(item.shares)}</span>
                  {item.item_type === 'ad' && <span>💰 ${Number(item.spend).toFixed(2)}</span>}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                  {(item.status === 'live' || item.status === 'scheduled') && (
                    <button onClick={e => onPause(item.id, e)} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">⏸ Pause</button>
                  )}
                  {item.status === 'paused' && (
                    <button onClick={e => onResume(item.id, e)} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">▶ Resume</button>
                  )}
                  <button onClick={e => onDuplicate(item.id, e)} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">⊕ Duplicate</button>
                  <button onClick={e => onDelete(item.id, e)} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑 Delete</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {items.length < total && (
        <div className="p-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : `Load more (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
function CalendarView({
  days, data, onPrev, onNext, onToday, onSelect, onNewItem,
}: {
  days: Date[]; data: Record<string, UnifiedItem[]>;
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelect: (item: UnifiedItem) => void;
  onNewItem: (date: string) => void;
}) {
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Calendar header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <button onClick={onPrev} className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50">‹</button>
        <button onClick={onToday} className="px-3 py-1 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">Today</button>
        <button onClick={onNext} className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50">›</button>
        <span className="text-sm font-medium text-gray-700">
          {days[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = dateStr === today;
          return (
            <div key={i} className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-indigo-50' : ''}`}>
              <div className="text-xs text-gray-500">{DOW[i]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const dayItems = data[dateStr] ?? [];
          return (
            <div key={i} className="border-r border-gray-200 last:border-r-0 p-1 min-h-24 relative">
              <div className="flex flex-col gap-1">
                {dayItems.slice(0, 5).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="text-left rounded px-1.5 py-1 text-xs text-white truncate hover:opacity-80"
                    style={{ backgroundColor: platformColor(item.platform) }}
                    title={item.caption ?? item.headline ?? item.platform}
                  >
                    {platformEmoji(item.platform)} {(item.caption ?? item.headline ?? '').slice(0, 20)}
                  </button>
                ))}
                {dayItems.length > 5 && (
                  <span className="text-xs text-gray-400 px-1">+{dayItems.length - 5} more</span>
                )}
              </div>
              {/* Add button */}
              <button
                onClick={() => onNewItem(dateStr)}
                className="absolute bottom-1 right-1 w-5 h-5 bg-gray-200 rounded-full text-gray-500 hover:bg-indigo-200 hover:text-indigo-700 flex items-center justify-center text-xs font-bold"
              >+</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── GRID VIEW ────────────────────────────────────────────────────────────────
function GridView({
  items, total, loadingMore, onSelect, selectedItem,
  onPause, onResume, onDelete, onDuplicate, onLoadMore,
}: {
  items: UnifiedItem[]; total: number; loadingMore: boolean;
  onSelect: (item: UnifiedItem) => void; selectedItem: UnifiedItem | null;
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDuplicate: (id: string, e: React.MouseEvent) => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-4">
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`group relative bg-white border rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all ${selectedItem?.id === item.id ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}
          >
            {/* Card top */}
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">{platformEmoji(item.platform)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400">{item.content_type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card middle */}
            <div className="p-3">
              {item.media_urls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.media_urls[0]} alt="" className="w-full h-24 object-cover rounded mb-2 bg-gray-100" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              )}
              <p className="text-sm text-gray-700 line-clamp-2">
                {item.headline ? <strong>{item.headline}</strong> : null}
                {item.headline && item.caption ? ' — ' : ''}
                {item.caption ?? <span className="text-gray-400 italic">No caption</span>}
              </p>
              <div className="text-xs text-gray-400 mt-1">{fmtDate(item.scheduled_at)}</div>
            </div>

            {/* Card bottom */}
            <div className="px-3 pb-3 grid grid-cols-4 gap-1">
              <div className="text-center"><div className="text-xs font-medium text-gray-800">{fmtNum(item.impressions)}</div><div className="text-xs text-gray-400">Views</div></div>
              <div className="text-center"><div className="text-xs font-medium text-gray-800">{fmtNum(item.likes)}</div><div className="text-xs text-gray-400">Likes</div></div>
              <div className="text-center"><div className="text-xs font-medium text-gray-800">{fmtNum(item.comments)}</div><div className="text-xs text-gray-400">Cmts</div></div>
              <div className="text-center"><div className="text-xs font-medium text-gray-800">${Number(item.spend).toFixed(0)}</div><div className="text-xs text-gray-400">Spend</div></div>
            </div>

            {/* Hover actions */}
            <div className="absolute inset-0 bg-black/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 gap-1" onClick={e => e.stopPropagation()}>
              {(item.status === 'live' || item.status === 'scheduled') && (
                <button onClick={e => onPause(item.id, e)} className="text-xs px-2 py-1 bg-yellow-500 text-white rounded">⏸</button>
              )}
              {item.status === 'paused' && (
                <button onClick={e => onResume(item.id, e)} className="text-xs px-2 py-1 bg-green-500 text-white rounded">▶</button>
              )}
              <button onClick={e => onDuplicate(item.id, e)} className="text-xs px-2 py-1 bg-white text-gray-700 rounded border">⊕</button>
              <button onClick={e => onDelete(item.id, e)} className="text-xs px-2 py-1 bg-red-500 text-white rounded">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {items.length < total && (
        <div className="mt-6 text-center">
          <button onClick={onLoadMore} disabled={loadingMore} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loadingMore ? 'Loading…' : `Load more (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({
  item, actionLog,
  editCaption, setEditCaption, editHeadline, setEditHeadline,
  editHashtags, setEditHashtags, editHashtagInput, setEditHashtagInput,
  editCtaText, setEditCtaText, editCtaUrl, setEditCtaUrl,
  editStatus, setEditStatus, editApproval, setEditApproval,
  editScheduledAt, setEditScheduledAt,
  editRejectionReason, setEditRejectionReason,
  saving, onSave, onClose, onAutoSave,
  onPause, onResume, onDuplicate, onDelete, onSyncMetrics,
  charCountColor,
}: {
  item: UnifiedItem; actionLog: ActionLog[];
  editCaption: string; setEditCaption: (v: string) => void;
  editHeadline: string; setEditHeadline: (v: string) => void;
  editHashtags: string[]; setEditHashtags: (v: string[]) => void;
  editHashtagInput: string; setEditHashtagInput: (v: string) => void;
  editCtaText: string; setEditCtaText: (v: string) => void;
  editCtaUrl: string; setEditCtaUrl: (v: string) => void;
  editStatus: string; setEditStatus: (v: string) => void;
  editApproval: string; setEditApproval: (v: string) => void;
  editScheduledAt: string; setEditScheduledAt: (v: string) => void;
  editRejectionReason: string; setEditRejectionReason: (v: string) => void;
  saving: boolean; onSave: () => void; onClose: () => void;
  onAutoSave: (fields: Record<string, unknown>) => void;
  onPause: () => void; onResume: () => void; onDuplicate: () => void; onDelete: () => void;
  onSyncMetrics: () => void;
  charCountColor: (text: string, platform: string) => string;
}) {
  const limit = PLATFORM_CHAR_LIMITS[item.platform] ?? 5000;
  const captionLen = editCaption.length;
  const captionPct = Math.min(captionLen / limit, 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 sticky top-0">
        <span className="text-xl">{platformEmoji(item.platform)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500">{item.content_type.replace(/_/g, ' ')} · {item.item_type}</div>
          <StatusBadge status={item.status} />
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Content section */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Content</h4>
          {item.item_type === 'ad' && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Headline</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={editHeadline}
                onChange={e => setEditHeadline(e.target.value)}
                onBlur={() => onAutoSave({ headline: editHeadline })}
                placeholder="Ad headline"
              />
            </div>
          )}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              Caption / Body
              <span className="ml-2 text-gray-400">{captionLen}/{limit}</span>
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={5}
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              onBlur={() => onAutoSave({ caption: editCaption })}
              placeholder="Caption / body copy…"
            />
            {/* Char bar */}
            <div className="mt-1 h-1 rounded bg-gray-200">
              <div className={`h-1 rounded transition-all ${charCountColor(editCaption, item.platform)}`} style={{ width: `${captionPct * 100}%` }} />
            </div>
          </div>

          {/* Hashtags */}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Hashtags</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {editHashtags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                  #{tag}
                  <button onClick={() => setEditHashtags(editHashtags.filter(t => t !== tag))} className="text-blue-500 hover:text-blue-800">×</button>
                </span>
              ))}
            </div>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="Type tag + Enter"
              value={editHashtagInput}
              onChange={e => setEditHashtagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && editHashtagInput.trim()) {
                  setEditHashtags([...editHashtags, editHashtagInput.trim().replace(/^#/, '')]);
                  setEditHashtagInput('');
                }
              }}
            />
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">CTA Text</label>
              <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={editCtaText} onChange={e => setEditCtaText(e.target.value)} onBlur={() => onAutoSave({ cta_text: editCtaText })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CTA URL</label>
              <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={editCtaUrl} onChange={e => setEditCtaUrl(e.target.value)} onBlur={() => onAutoSave({ cta_url: editCtaUrl })} />
            </div>
          </div>
        </section>

        {/* Schedule section */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Schedule</h4>
          <div className="flex flex-col gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scheduled At</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                value={editScheduledAt}
                onChange={e => { setEditScheduledAt(e.target.value); onAutoSave({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null }); }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                value={editStatus}
                onChange={e => { setEditStatus(e.target.value); onAutoSave({ status: e.target.value }); }}
              >
                {['draft', 'scheduled', 'live', 'published', 'paused', 'failed', 'ended'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {item.item_type === 'ad' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Approval Status</label>
                <select
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                  value={editApproval}
                  onChange={e => { setEditApproval(e.target.value); onAutoSave({ approval_status: e.target.value }); }}
                >
                  {['pending', 'approved', 'rejected'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {editApproval === 'rejected' && (
                  <input
                    className="mt-1 w-full border border-red-200 rounded px-2 py-1 text-xs bg-red-50"
                    placeholder="Rejection reason…"
                    value={editRejectionReason}
                    onChange={e => setEditRejectionReason(e.target.value)}
                    onBlur={() => onAutoSave({ failure_reason: editRejectionReason })}
                  />
                )}
              </div>
            )}
          </div>
        </section>

        {/* Live Metrics */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Metrics</h4>
            <div className="flex items-center gap-2">
              {item.last_synced_at && <span className="text-xs text-gray-400">Synced {fmtDateShort(item.last_synced_at)}</span>}
              <button onClick={onSyncMetrics} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">↻ Sync</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Impressions" value={fmtNum(item.impressions)} />
            <MetricCard label="Reach" value={fmtNum(item.reach)} />
            <MetricCard label="Clicks" value={fmtNum(item.clicks)} />
            <MetricCard label="Likes" value={fmtNum(item.likes)} />
            <MetricCard label="Comments" value={fmtNum(item.comments)} />
            <MetricCard label="Shares" value={fmtNum(item.shares)} />
            <MetricCard label="Saves" value={fmtNum(item.saves)} />
            <MetricCard label="Conversions" value={fmtNum(item.conversions)} />
            {item.item_type === 'ad' && (
              <>
                <MetricCard label="Spend" value={`$${Number(item.spend).toFixed(2)}`} />
                <MetricCard label="Revenue" value={`$${Number(item.revenue).toFixed(2)}`} />
                <MetricCard label="ROAS" value={`${Number(item.roas).toFixed(2)}x`} />
                <MetricCard label="CTR" value={`${Number(item.ctr).toFixed(2)}%`} />
                <MetricCard label="CPC" value={`$${Number(item.cpc).toFixed(2)}`} />
                <MetricCard label="Eng. Rate" value={`${Number(item.engagement_rate).toFixed(2)}%`} />
              </>
            )}
          </div>
        </section>

        {/* Action Log */}
        {actionLog.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Action Log</h4>
            <div className="flex flex-col gap-2">
              {actionLog.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-white text-xs ${
                    log.action === 'created' ? 'bg-green-500' :
                    log.action === 'deleted' ? 'bg-red-500' :
                    log.action === 'paused' ? 'bg-yellow-500' :
                    log.action === 'approved' ? 'bg-emerald-500' :
                    log.action === 'rejected' ? 'bg-red-600' : 'bg-gray-500'
                  }`}>{log.action}</span>
                  <span className="text-gray-500">{log.actor}</span>
                  <span className="text-gray-400">{fmtDate(log.created_at)}</span>
                  {log.notes && <span className="text-gray-500 truncate">{log.notes}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</h4>
          <div className="flex flex-col gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={onDuplicate} className="w-full py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">⊕ Duplicate as Draft</button>
            {(item.status === 'live' || item.status === 'scheduled') && (
              <button onClick={onPause} className="w-full py-2 bg-yellow-100 text-yellow-700 text-sm rounded-lg hover:bg-yellow-200">⏸ Pause</button>
            )}
            {item.status === 'paused' && (
              <button onClick={onResume} className="w-full py-2 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200">▶ Resume</button>
            )}
            {item.item_type === 'social_post' && item.status === 'published' && (
              <a href="/admin/ad-planner" className="block w-full py-2 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200 text-center">🚀 Boost as Ad</a>
            )}
            <button onClick={onDelete} className="w-full py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100">🗑 Delete</button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── CREATE FORM ──────────────────────────────────────────────────────────────
function CreateForm({
  createType, setCreateType, platform, setPlatform,
  contentType, setContentType, caption, setCaption,
  headline, setHeadline, hashtags, setHashtags,
  hashtagInput, setHashtagInput, ctaText, setCtaText,
  ctaUrl, setCtaUrl, scheduledAt, setScheduledAt,
  creating, onCreate, onClose,
}: {
  createType: 'social_post' | 'ad'; setCreateType: (t: 'social_post' | 'ad') => void;
  platform: string; setPlatform: (v: string) => void;
  contentType: string; setContentType: (v: string) => void;
  caption: string; setCaption: (v: string) => void;
  headline: string; setHeadline: (v: string) => void;
  hashtags: string[]; setHashtags: (v: string[]) => void;
  hashtagInput: string; setHashtagInput: (v: string) => void;
  ctaText: string; setCtaText: (v: string) => void;
  ctaUrl: string; setCtaUrl: (v: string) => void;
  scheduledAt: string; setScheduledAt: (v: string) => void;
  creating: boolean; onCreate: (postNow: boolean) => void; onClose: () => void;
}) {
  const availableTypes = PLATFORM_CONTENT_TYPES[platform] ?? ['text_post'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">
          {createType === 'social_post' ? '📝 New Social Post' : '🎯 New Ad'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button onClick={() => setCreateType('social_post')} className={`flex-1 py-2 text-sm rounded-lg ${createType === 'social_post' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Social Post</button>
          <button onClick={() => setCreateType('ad')} className={`flex-1 py-2 text-sm rounded-lg ${createType === 'ad' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Ad</button>
        </div>

        {/* Platform */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Platform</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={platform}
            onChange={e => { setPlatform(e.target.value); setContentType((PLATFORM_CONTENT_TYPES[e.target.value] ?? ['text_post'])[0]); }}
          >
            {PLATFORMS.map(p => (
              <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>
            ))}
          </select>
        </div>

        {/* Content type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Content Type</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={contentType} onChange={e => setContentType(e.target.value)}>
            {availableTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {/* Headline (ads) */}
        {createType === 'ad' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Headline <span className="text-red-400">*</span></label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Ad headline" />
          </div>
        )}

        {/* Caption */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {createType === 'ad' ? 'Body Copy' : 'Caption'}
            <span className="ml-2 text-gray-400">{caption.length}/{PLATFORM_CHAR_LIMITS[platform] ?? 5000}</span>
          </label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={5} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write your content…" />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hashtags</label>
          <div className="flex flex-wrap gap-1 mb-1">
            {hashtags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                #{tag}<button onClick={() => setHashtags(hashtags.filter(t => t !== tag))} className="text-blue-500">×</button>
              </span>
            ))}
          </div>
          <input
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
            placeholder="Type tag + Enter"
            value={hashtagInput}
            onChange={e => setHashtagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && hashtagInput.trim()) { setHashtags([...hashtags, hashtagInput.trim().replace(/^#/, '')]); setHashtagInput(''); } }}
          />
        </div>

        {/* CTA */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA Text</label>
            <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Learn More" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA URL</label>
            <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Schedule Date/Time</label>
          <input type="datetime-local" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 mt-2">
          {createType === 'social_post' ? (
            <>
              <button onClick={() => onCreate(true)} disabled={creating || !caption.trim()} className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {creating ? 'Posting…' : '🚀 Post Now'}
              </button>
              <button onClick={() => onCreate(false)} disabled={creating || !caption.trim()} className="w-full py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50">
                {creating ? 'Saving…' : '💾 Save Draft'}
              </button>
            </>
          ) : (
            <button onClick={() => onCreate(false)} disabled={creating || !headline.trim()} className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {creating ? 'Submitting…' : '📤 Submit for Approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
