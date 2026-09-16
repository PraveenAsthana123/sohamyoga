'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab =
  | 'Posts'
  | 'Compose'
  | 'Search'
  | 'B2B Portals'
  | 'Lead Enrichment'
  | 'Analytics'
  | 'Content Strategy'
  | 'Settings';

type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
type PostType = 'text' | 'image' | 'video' | 'article' | 'carousel' | 'poll' | 'document';
type SearchType = 'people' | 'company' | 'job' | 'content' | 'group';
type PortalCategory =
  | 'all'
  | 'sales_intelligence'
  | 'contact_database'
  | 'intent_data'
  | 'email_verification'
  | 'technographic'
  | 'company_intelligence'
  | 'crm_enrichment';
type PostingTone = 'professional' | 'casual' | 'thought-leader' | 'educational';

interface LinkedInPost {
  id: number;
  title: string | null;
  content: string;
  post_type: PostType;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  target_audience: string;
  hashtags: string;
  media_url: string | null;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement_rate: string;
  ai_generated: boolean;
  created_at: string;
}

interface PostStats {
  total: string;
  published: string;
  scheduled: string;
  draft: string;
  impressions: string;
  likes: string;
  avg_engagement_rate: string;
}

interface B2BPortal {
  id: number;
  portal_name: string;
  portal_type: string;
  website_url: string;
  api_key_env: string;
  connected: boolean;
  credits_remaining: number | null;
  monthly_limit: number | null;
  features: string[];
  pricing_model: string;
  status: string;
  last_error: string | null;
}

interface LinkedInSearch {
  id: number;
  search_name: string;
  search_type: SearchType;
  keywords: string;
  filters: Record<string, string | number | boolean>;
  result_count: number;
  results: SearchResult[];
  last_run_at: string | null;
  created_at: string;
}

interface SearchResult {
  name: string;
  title: string;
  company: string;
  location: string;
  connection: string;
  industry?: string;
  size?: string;
  followers?: string;
  relevance?: string;
}

interface EnrichedProfile {
  full_name: string;
  email: string;
  company: string;
  job_title: string;
  linkedin_url: string;
  phone: string;
  location: string;
  industry: string;
  company_size: string;
  revenue: string;
  technologies: string[];
  intent_signals: string[];
  confidence_score: number;
}

interface EnrichmentRecord {
  id: number;
  portal_name: string;
  email: string;
  full_name: string;
  company: string;
  job_title: string;
  confidence_score: string;
  created_at: string;
}

interface GenerateResult {
  content: string;
  hashtags: string;
  cta: string;
  ai_generated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-50 text-blue-600',
  image: 'bg-green-50 text-green-600',
  video: 'bg-purple-50 text-purple-600',
  article: 'bg-orange-50 text-orange-600',
  carousel: 'bg-teal-50 text-teal-600',
  poll: 'bg-pink-50 text-pink-600',
  document: 'bg-indigo-50 text-indigo-600',
};

const PRICING_COLORS: Record<string, string> = {
  free: 'bg-green-100 text-green-700',
  freemium: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  sales_intelligence: 'Sales Intelligence',
  contact_database: 'Contact Database',
  intent_data: 'Intent Data',
  email_verification: 'Email Verification',
  technographic: 'Technographic',
  company_intelligence: 'Company Intelligence',
  crm_enrichment: 'CRM Enrichment',
};

const POST_TYPES: PostType[] = ['text', 'image', 'video', 'article', 'carousel', 'poll', 'document'];
const SEARCH_TYPES: SearchType[] = ['people', 'company', 'job', 'content', 'group'];
const TONES: PostingTone[] = ['professional', 'casual', 'thought-leader', 'educational'];

function kFormat(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(Math.round(num));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LinkedInManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Posts');

  const tabs: Tab[] = [
    'Posts', 'Compose', 'Search', 'B2B Portals',
    'Lead Enrichment', 'Analytics', 'Content Strategy', 'Settings',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            in
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">LinkedIn Management</h1>
            <p className="text-sm text-gray-500">Content, B2B intelligence, lead enrichment & analytics</p>
          </div>
        </div>
        {/* Tab bar */}
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'Posts' && <PostsTab />}
        {activeTab === 'Compose' && <ComposeTab />}
        {activeTab === 'Search' && <SearchTab />}
        {activeTab === 'B2B Portals' && <PortalsTab />}
        {activeTab === 'Lead Enrichment' && <EnrichmentTab />}
        {activeTab === 'Analytics' && <AnalyticsTab />}
        {activeTab === 'Content Strategy' && <ContentStrategyTab />}
        {activeTab === 'Settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Tab: Posts ───────────────────────────────────────────────────────────────

function PostsTab() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<LinkedInPost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    post_type: 'text' as PostType,
    status: 'draft' as PostStatus,
    hashtags: '',
    target_audience: 'connections',
    scheduled_at: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/admin/linkedin-management?${params}`);
      if (!res.ok) throw new Error('Failed to fetch posts');
      const data = await res.json() as { posts: LinkedInPost[]; stats: PostStats };
      setPosts(data.posts);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setEditPost(null);
    setFormData({ title: '', content: '', post_type: 'text', status: 'draft', hashtags: '', target_audience: 'connections', scheduled_at: '' });
    setShowForm(true);
  };

  const openEdit = (p: LinkedInPost) => {
    setEditPost(p);
    setFormData({
      title: p.title ?? '',
      content: p.content,
      post_type: p.post_type,
      status: p.status,
      hashtags: p.hashtags,
      target_audience: p.target_audience,
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const url = editPost
        ? `/api/admin/linkedin-management/${editPost.id}`
        : '/api/admin/linkedin-management';
      const method = editPost ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_at: formData.scheduled_at || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowForm(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/admin/linkedin-management/${id}`, { method: 'DELETE' });
    await load();
  };

  const publishNow = async (id: number) => {
    await fetch(`/api/admin/linkedin-management/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published', published_at: new Date().toISOString() }),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Posts', value: stats.total },
            { label: 'Published', value: stats.published, color: 'text-green-600' },
            { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-600' },
            { label: 'Draft', value: stats.draft, color: 'text-gray-600' },
            { label: 'Total Impressions', value: kFormat(stats.impressions) },
            { label: 'Total Likes', value: kFormat(stats.likes) },
            { label: 'Avg Engagement', value: `${parseFloat(stats.avg_engagement_rate).toFixed(2)}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <div className={`text-2xl font-bold ${k.color ?? 'text-gray-900'}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + New */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {(['draft', 'scheduled', 'published', 'failed'] as PostStatus[]).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {POST_TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <button onClick={openNew} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
          + New Post
        </button>
      </div>

      {/* Error / Loading */}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      {loading && <div className="text-center py-12 text-gray-400">Loading posts...</div>}

      {/* Post cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-gray-900 text-sm line-clamp-2">{p.title ?? 'Untitled'}</div>
                <div className="flex gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.post_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.post_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-3">{p.content}</p>
              {p.hashtags && (
                <p className="text-xs text-blue-500 line-clamp-1">{p.hashtags}</p>
              )}
              {p.status === 'published' && (
                <div className="grid grid-cols-4 gap-2 text-center border-t border-gray-100 pt-2">
                  {[
                    { label: 'Reach', val: kFormat(p.reach) },
                    { label: 'Likes', val: kFormat(p.likes) },
                    { label: 'Comments', val: kFormat(p.comments) },
                    { label: 'Shares', val: kFormat(p.shares) },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="font-semibold text-sm text-gray-800">{m.val}</div>
                      <div className="text-xs text-gray-400">{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {p.scheduled_at && (
                <p className="text-xs text-blue-600">
                  Scheduled: {new Date(p.scheduled_at).toLocaleString()}
                </p>
              )}
              {p.ai_generated && (
                <span className="text-xs text-purple-600 font-medium">AI Generated</span>
              )}
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline">Edit</button>
                {p.status !== 'published' && (
                  <button onClick={() => publishNow(p.id)} className="text-xs text-green-600 hover:underline">Publish Now</button>
                )}
                <button onClick={() => deletePost(p.id)} className="text-xs text-red-500 hover:underline ml-auto">Delete</button>
              </div>
            </div>
          ))}
          {!posts.length && (
            <div className="col-span-full text-center py-12 text-gray-400">No posts found. Create your first LinkedIn post.</div>
          )}
        </div>
      )}

      {/* Inline Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editPost ? 'Edit Post' : 'New Post'}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Post title (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.content}
                onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                rows={5}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Write your LinkedIn post..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.post_type}
                  onChange={e => setFormData(f => ({ ...f, post_type: e.target.value as PostType }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(f => ({ ...f, status: e.target.value as PostStatus }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {(['draft', 'scheduled', 'published'] as PostStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags</label>
              <input
                type="text"
                value={formData.hashtags}
                onChange={e => setFormData(f => ({ ...f, hashtags: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="#yoga #wellness #mindfulness"
              />
            </div>
            {formData.status === 'scheduled' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={e => setFormData(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Post'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Compose ─────────────────────────────────────────────────────────────

function ComposeTab() {
  const [postType, setPostType] = useState<PostType>('text');
  const [audience, setAudience] = useState('connections');
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<PostingTone>('professional');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [articleUrl, setArticleUrl] = useState('');
  const [aiCta, setAiCta] = useState('');

  const charCount = content.length;
  const charLimit = 3000;

  const generate = async () => {
    if (!aiTopic.trim()) { alert('Enter a topic first'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/linkedin-management/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, audience, post_type: postType, tone: aiTone }),
      });
      const data = await res.json() as GenerateResult;
      setContent(data.content);
      setHashtags(data.hashtags);
      setAiCta(data.cta);
    } catch {
      alert('AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const submit = async (status: 'draft' | 'scheduled' | 'published') => {
    if (!content.trim()) { alert('Content is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/linkedin-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          hashtags,
          post_type: postType,
          target_audience: audience,
          status,
          scheduled_at: scheduleEnabled && scheduledAt ? scheduledAt : null,
          ai_generated: Boolean(aiTopic),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      alert(`Post ${status === 'published' ? 'published' : status === 'scheduled' ? 'scheduled' : 'saved as draft'} successfully!`);
      setContent('');
      setHashtags('');
      setAiCta('');
    } catch {
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Editor */}
      <div className="space-y-4">
        {/* Post type selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Post Type</label>
          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setPostType(t)}
                className={`px-3 py-1.5 text-sm rounded-md border capitalize font-medium transition-colors ${
                  postType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Target audience */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Target Audience</label>
          <select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="connections">Connections</option>
            <option value="followers">Followers</option>
            <option value="all">All LinkedIn</option>
            <option value="groups">Specific Groups</option>
          </select>
        </div>

        {/* Content editor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Content
            <span className={`ml-2 text-xs font-normal ${charCount > 2700 ? 'text-red-500' : charCount > 2400 ? 'text-yellow-500' : 'text-gray-400'}`}>
              {charCount}/{charLimit}
            </span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, charLimit))}
            rows={8}
            className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${
              charCount > 2700 ? 'border-red-400' : 'border-gray-300'
            }`}
            placeholder="Write your LinkedIn post here..."
          />
        </div>

        {/* Poll options */}
        {postType === 'poll' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Poll Options</label>
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  value={opt}
                  onChange={e => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder={`Option ${i + 1}`}
                />
              ))}
              {pollOptions.length < 4 && (
                <button onClick={() => setPollOptions(p => [...p, ''])} className="text-sm text-blue-600 hover:underline">
                  + Add option
                </button>
              )}
            </div>
          </div>
        )}

        {/* Article URL */}
        {postType === 'article' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">External Article URL</label>
            <input
              type="url"
              value={articleUrl}
              onChange={e => setArticleUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="https://example.com/article"
            />
          </div>
        )}

        {/* Hashtags */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Hashtags</label>
          <input
            type="text"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="#yoga #wellness #mindfulness #leadership"
          />
          <div className="flex gap-2 mt-1 flex-wrap">
            {['#corporatewellness', '#yoga', '#mindfulness', '#leadership', '#productivity'].map(h => (
              <button
                key={h}
                onClick={() => setHashtags(hs => hs ? `${hs} ${h}` : h)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* AI CTA hint */}
        {aiCta && (
          <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-sm text-purple-800">
            <span className="font-medium">AI Suggested CTA:</span> {aiCta}
          </div>
        )}

        {/* Schedule */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={e => setScheduleEnabled(e.target.checked)}
              className="rounded"
            />
            Schedule Post
          </label>
          {scheduleEnabled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => submit('draft')} disabled={saving} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50">
            Save Draft
          </button>
          {scheduleEnabled ? (
            <button onClick={() => submit('scheduled')} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Scheduling...' : 'Schedule'}
            </button>
          ) : (
            <button onClick={() => submit('published')} disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Publishing...' : 'Publish Now'}
            </button>
          )}
        </div>
      </div>

      {/* Right: AI Assist + Preview */}
      <div className="space-y-4">
        {/* AI Assist panel */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-purple-900 text-sm">AI Content Assistant</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
            <input
              type="text"
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              placeholder="e.g. corporate burnout, morning yoga, mindful leadership"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setAiTone(t)}
                  className={`px-2.5 py-1 text-xs rounded-md border capitalize transition-colors ${
                    aiTone === t ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full bg-purple-600 text-white py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? 'Generating with Ollama...' : 'Generate Post Content'}
          </button>
        </div>

        {/* LinkedIn Preview */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Post Preview</span>
          </div>
          <div className="p-4">
            {/* Profile row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">SY</div>
              <div>
                <div className="font-semibold text-sm text-gray-900">SohamYoga Admin</div>
                <div className="text-xs text-gray-500">Corporate Wellness & Yoga • {postType} post</div>
                <div className="text-xs text-gray-400">Just now</div>
              </div>
            </div>
            {/* Content */}
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {content || <span className="text-gray-300 italic">Your post content will appear here...</span>}
            </p>
            {hashtags && (
              <p className="text-sm text-blue-500 mt-2">{hashtags}</p>
            )}
            {/* Engagement bar */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>↩ Repost</span>
              <span>✉ Send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Search ──────────────────────────────────────────────────────────────

function SearchTab() {
  const [searchType, setSearchType] = useState<SearchType>('people');
  const [keywords, setKeywords] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searches, setSearches] = useState<LinkedInSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/linkedin-management/search');
      if (res.ok) {
        const d = await res.json() as { searches: LinkedInSearch[] };
        setSearches(d.searches);
      }
      setHistoryLoading(false);
    })();
  }, []);

  const runSearch = async () => {
    if (!searchName.trim()) { alert('Enter a search name'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/linkedin-management/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_name: searchName, search_type: searchType, keywords, filters }),
      });
      const d = await res.json() as { search: LinkedInSearch };
      setResults(d.search.results);
      setSearches(s => [d.search, ...s.slice(0, 49)]);
    } catch {
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const peopleFilters = ['Title', 'Company', 'Industry', 'Location', 'School'];
  const companyFilters = ['Industry', 'Size', 'Location', 'Revenue'];
  const filterKeys = searchType === 'people' ? peopleFilters : searchType === 'company' ? companyFilters : [];

  return (
    <div className="space-y-6">
      {/* Search type tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {SEARCH_TYPES.map(t => (
          <button
            key={t}
            onClick={() => { setSearchType(t); setResults([]); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              searchType === t ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'company' ? 'Companies' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Name</label>
            <input
              type="text"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. HR Managers Toronto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. corporate wellness, employee experience"
            />
          </div>
          {filterKeys.map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{k}</label>
              <input
                type="text"
                value={filters[k] ?? ''}
                onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder={`Filter by ${k.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
        <button
          onClick={runSearch}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Run Search & Save'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
            {results.length} Results
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.title} {r.company ? `@ ${r.company}` : ''}</div>
                  <div className="text-xs text-gray-400">{r.location}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.connection && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{r.connection}</span>
                  )}
                  <button className="text-xs text-blue-600 hover:underline">Save</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search history */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Search History</h3>
        {historyLoading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : !searches.length ? (
          <div className="text-gray-400 text-sm">No saved searches yet.</div>
        ) : (
          <div className="space-y-2">
            {searches.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-md px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{s.search_name}</div>
                  <div className="text-xs text-gray-500">{s.search_type} · {s.keywords} · {s.result_count} results</div>
                </div>
                <div className="text-xs text-gray-400">
                  {s.last_run_at ? new Date(s.last_run_at).toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: B2B Portals ─────────────────────────────────────────────────────────

function PortalsTab() {
  const [portals, setPortals] = useState<B2BPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<PortalCategory>('all');
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [configModal, setConfigModal] = useState<B2BPortal | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/linkedin-management/portals');
      if (res.ok) {
        const d = await res.json() as { portals: B2BPortal[] };
        setPortals(d.portals);
      }
      setLoading(false);
    })();
  }, []);

  const toggle = async (p: B2BPortal) => {
    setConnectingId(p.id);
    const res = await fetch('/api/admin/linkedin-management/portals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, connected: !p.connected }),
    });
    if (res.ok) {
      const d = await res.json() as { portal: B2BPortal };
      setPortals(ps => ps.map(x => x.id === p.id ? d.portal : x));
    }
    setConnectingId(null);
  };

  const categories: PortalCategory[] = ['all', 'sales_intelligence', 'contact_database', 'intent_data', 'email_verification', 'technographic', 'company_intelligence', 'crm_enrichment'];

  const filtered = categoryFilter === 'all' ? portals : portals.filter(p => p.portal_type === categoryFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">B2B Intelligence Portals</h2>
        <span className="text-sm text-gray-500">{portals.length} portals across 7 intelligence categories</span>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              categoryFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm py-8 text-center">Loading portals...</div>}

      {/* Portal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                {p.portal_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{p.portal_name}</div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                    {CATEGORY_LABELS[p.portal_type as PortalCategory] ?? p.portal_type}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRICING_COLORS[p.pricing_model] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.pricing_model}
                  </span>
                </div>
              </div>
              {p.connected && (
                <span className="text-green-500 text-lg" title="Connected">✓</span>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-1">
              {(Array.isArray(p.features) ? p.features : []).slice(0, 4).map((f, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="text-blue-400">•</span> {f}
                </li>
              ))}
              {(Array.isArray(p.features) ? p.features : []).length > 4 && (
                <li className="text-xs text-gray-400">+{p.features.length - 4} more features</li>
              )}
            </ul>

            {p.connected && p.credits_remaining !== null && (
              <div className="text-xs text-gray-500">Credits remaining: <span className="font-medium text-gray-800">{p.credits_remaining}</span></div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => toggle(p)}
                disabled={connectingId === p.id}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  p.connected
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {connectingId === p.id ? '...' : p.connected ? 'Disconnect' : 'Connect'}
              </button>
              <button
                onClick={() => setConfigModal(p)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-xs hover:bg-gray-50"
              >
                Config
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Config modal */}
      {configModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Configure: {configModal.portal_name}</h2>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium text-gray-700">Environment Variable</div>
              <code className="block text-sm bg-gray-100 px-3 py-2 rounded font-mono text-blue-800">
                {configModal.api_key_env}=your_api_key_here
              </code>
              <p className="text-xs text-gray-500">Set this in your <code className="bg-gray-100 px-1 rounded">.env.local</code> file or deployment environment.</p>
            </div>
            <a
              href={configModal.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-blue-50 text-blue-700 py-2 rounded-md text-sm hover:bg-blue-100"
            >
              Visit {configModal.portal_name} API Docs →
            </a>
            <button
              onClick={() => setConfigModal(null)}
              className="w-full border border-gray-300 text-gray-600 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Lead Enrichment ─────────────────────────────────────────────────────

function EnrichmentTab() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [portal, setPortal] = useState('Apollo.io');
  const [portals, setPortals] = useState<B2BPortal[]>([]);
  const [enriched, setEnriched] = useState<EnrichedProfile | null>(null);
  const [source, setSource] = useState('');
  const [history, setHistory] = useState<EnrichmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch('/api/admin/linkedin-management/portals').then(r => r.json()) as Promise<{ portals: B2BPortal[] }>,
      fetch('/api/admin/linkedin-management/enrich').then(r => r.json()) as Promise<{ enrichments: EnrichmentRecord[] }>,
    ]).then(([pData, eData]) => {
      setPortals(pData.portals ?? []);
      setHistory(eData.enrichments ?? []);
      setHistoryLoading(false);
    });
  }, []);

  const enrich = async () => {
    if (!email && !name) { alert('Enter an email or name'); return; }
    setLoading(true);
    setEnriched(null);
    try {
      const res = await fetch('/api/admin/linkedin-management/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, company, portal }),
      });
      const d = await res.json() as { enriched: EnrichedProfile; source: string };
      setEnriched(d.enriched);
      setSource(d.source);
      const hr = await fetch('/api/admin/linkedin-management/enrich');
      if (hr.ok) {
        const hd = await hr.json() as { enrichments: EnrichmentRecord[] };
        setHistory(hd.enrichments);
      }
    } catch {
      alert('Enrichment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input panel */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Enrich a Lead</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="lead@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Portal</label>
            <select value={portal} onChange={e => setPortal(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {portals.map(p => (
                <option key={p.id} value={p.portal_name}>
                  {p.portal_name} {p.connected ? '(Connected)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button onClick={enrich} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Enriching...' : 'Enrich Lead'}
          </button>
        </div>

        {/* Enrichment history */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Enrichment History</h3>
          {historyLoading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : !history.length ? (
            <div className="text-gray-400 text-sm">No enrichments yet.</div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                  <div>
                    <div className="font-medium text-gray-800">{h.full_name || h.email}</div>
                    <div className="text-xs text-gray-500">{h.company} · via {h.portal_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${parseFloat(h.confidence_score) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {h.confidence_score}% conf
                    </div>
                    <div className="text-xs text-gray-400">{new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results panel */}
      {enriched && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Enriched Profile</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${source === 'api' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {source === 'api' ? 'Live API' : 'Demo Data'}
            </span>
          </div>

          {/* Confidence score bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Confidence Score</span>
              <span className="font-medium">{enriched.confidence_score}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div
                className={`h-2 rounded-full transition-all ${enriched.confidence_score >= 80 ? 'bg-green-500' : enriched.confidence_score >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                style={{ width: `${enriched.confidence_score}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              { label: 'Full Name', val: enriched.full_name },
              { label: 'Email', val: enriched.email },
              { label: 'Company', val: enriched.company },
              { label: 'Job Title', val: enriched.job_title },
              { label: 'Phone', val: enriched.phone },
              { label: 'Location', val: enriched.location },
              { label: 'Industry', val: enriched.industry },
              { label: 'Company Size', val: enriched.company_size },
              { label: 'Revenue', val: enriched.revenue },
            ].map(f => (
              <div key={f.label}>
                <div className="text-xs text-gray-400">{f.label}</div>
                <div className="font-medium text-gray-800 text-xs">{f.val}</div>
              </div>
            ))}
          </div>

          {enriched.linkedin_url && (
            <a href={enriched.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block">
              {enriched.linkedin_url}
            </a>
          )}

          {enriched.technologies.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Technologies</div>
              <div className="flex flex-wrap gap-1">
                {enriched.technologies.map(t => (
                  <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          )}

          {enriched.intent_signals.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Intent Signals</div>
              <div className="flex flex-wrap gap-1">
                {enriched.intent_signals.map(s => (
                  <span key={s} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}

          <button className="w-full bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700">
            Add to Leads
          </button>
        </div>
      )}

      {!enriched && !loading && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm min-h-[300px]">
          Enriched profile will appear here
        </div>
      )}
    </div>
  );
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/linkedin-management');
      if (res.ok) {
        const d = await res.json() as { posts: LinkedInPost[]; stats: PostStats };
        setPosts(d.posts);
        setStats(d.stats);
      }
      setLoading(false);
    })();
  }, []);

  const published = posts.filter(p => p.status === 'published');

  const byType = POST_TYPES.map(t => ({
    type: t,
    count: posts.filter(p => p.post_type === t).length,
    impressions: posts.filter(p => p.post_type === t).reduce((a, p) => a + p.impressions, 0),
    likes: posts.filter(p => p.post_type === t).reduce((a, p) => a + p.likes, 0),
  }));

  const top5 = [...published].sort((a, b) => b.impressions - a.impressions).slice(0, 5);

  const TYPE_BAR_COLORS: Record<string, string> = {
    text: 'bg-blue-500',
    image: 'bg-green-500',
    video: 'bg-purple-500',
    article: 'bg-orange-500',
    carousel: 'bg-teal-500',
    poll: 'bg-pink-500',
    document: 'bg-indigo-500',
  };

  const maxImpressions = Math.max(...byType.map(t => t.impressions), 1);

  const allHashtags = posts.flatMap(p =>
    (p.hashtags ?? '').split(/\s+/).filter(h => h.startsWith('#'))
  );
  const hashtagMap: Record<string, { count: number; totalImpressions: number }> = {};
  posts.forEach(p => {
    const htags = (p.hashtags ?? '').split(/\s+/).filter(h => h.startsWith('#'));
    htags.forEach(h => {
      if (!hashtagMap[h]) hashtagMap[h] = { count: 0, totalImpressions: 0 };
      hashtagMap[h].count++;
      hashtagMap[h].totalImpressions += p.impressions;
    });
  });
  const hashtagStats = Object.entries(hashtagMap)
    .map(([tag, d]) => ({ tag, ...d, avgImpressions: d.count > 0 ? Math.round(d.totalImpressions / d.count) : 0 }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
    .slice(0, 10);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* Time range */}
      <div className="flex gap-2">
        {['7', '30', '90'].map(d => (
          <button
            key={d}
            onClick={() => setTimeRange(d)}
            className={`px-4 py-1.5 text-sm rounded-md border font-medium transition-colors ${
              timeRange === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Reach', val: kFormat(posts.reduce((a, p) => a + p.reach, 0)) },
            { label: 'Impressions', val: kFormat(stats.impressions) },
            { label: 'Avg Engagement', val: `${parseFloat(stats.avg_engagement_rate).toFixed(2)}%` },
            { label: 'Total Likes', val: kFormat(stats.likes) },
            { label: 'Published', val: stats.published },
            { label: 'Best Type', val: byType.sort((a, b) => b.impressions - a.impressions)[0]?.type ?? 'N/A' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-gray-900">{k.val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Engagement by post type */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Engagement by Post Type</h3>
        <div className="space-y-3">
          {byType.filter(t => t.count > 0).map(t => (
            <div key={t.type} className="flex items-center gap-3">
              <div className="w-16 text-xs text-gray-600 capitalize">{t.type}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-6 rounded-full ${TYPE_BAR_COLORS[t.type] ?? 'bg-gray-400'} transition-all`}
                  style={{ width: `${(t.impressions / maxImpressions) * 100}%` }}
                />
              </div>
              <div className="w-20 text-xs text-right text-gray-600">{kFormat(t.impressions)} impr</div>
              <div className="w-12 text-xs text-right text-gray-400">{t.count} posts</div>
            </div>
          ))}
          {byType.every(t => t.count === 0) && (
            <div className="text-gray-400 text-sm py-4 text-center">No published posts with impression data yet.</div>
          )}
        </div>
      </div>

      {/* Top 5 posts */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Top 5 Performing Posts</h3>
        {!top5.length ? (
          <div className="text-gray-400 text-sm">No published posts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Post</th>
                  <th className="text-right pb-2 font-medium">Type</th>
                  <th className="text-right pb-2 font-medium">Impressions</th>
                  <th className="text-right pb-2 font-medium">Engage %</th>
                  <th className="text-right pb-2 font-medium">Likes</th>
                  <th className="text-right pb-2 font-medium">Shares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {top5.map(p => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 max-w-xs">
                      <div className="truncate font-medium text-gray-800">{p.title ?? p.content.slice(0, 40)}</div>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[p.post_type] ?? 'bg-gray-100 text-gray-600'}`}>{p.post_type}</span>
                    </td>
                    <td className="py-2 text-right font-medium">{kFormat(p.impressions)}</td>
                    <td className="py-2 text-right text-green-600">{p.engagement_rate}%</td>
                    <td className="py-2 text-right">{kFormat(p.likes)}</td>
                    <td className="py-2 text-right">{kFormat(p.shares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hashtag performance */}
      {hashtagStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Hashtag Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Hashtag</th>
                  <th className="text-right pb-2 font-medium">Posts Used</th>
                  <th className="text-right pb-2 font-medium">Avg Impressions</th>
                  <th className="text-right pb-2 font-medium">Total Impressions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {hashtagStats.map(h => (
                  <tr key={h.tag}>
                    <td className="py-2 text-blue-600 font-medium">{h.tag}</td>
                    <td className="py-2 text-right">{h.count}</td>
                    <td className="py-2 text-right font-medium">{kFormat(h.avgImpressions)}</td>
                    <td className="py-2 text-right text-gray-500">{kFormat(h.totalImpressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best time to post heatmap (static demo) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Best Time to Post (Engagement Heatmap)</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-2 text-xs text-gray-400 mb-2 ml-12">
            {['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'].map(h => (
              <div key={h} className="w-10 text-center">{h}</div>
            ))}
          </div>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, di) => (
            <div key={day} className="flex items-center gap-2 mb-1">
              <div className="w-10 text-xs text-gray-500 text-right">{day}</div>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(hi => {
                // Simulate engagement data — higher on weekday mornings
                const isWeekday = di < 5;
                const isMorning = hi >= 1 && hi <= 3;
                const intensity = isWeekday && isMorning ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3;
                const opacity = Math.round(intensity * 9) / 9;
                return (
                  <div
                    key={hi}
                    className="w-10 h-8 rounded"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${opacity})` }}
                    title={`${day} ${['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'][hi]}: ${Math.round(intensity * 100)}% engagement`}
                  />
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <div className="w-6 h-3 rounded" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }} />
            <span>Low</span>
            <div className="w-6 h-3 rounded ml-2" style={{ backgroundColor: 'rgba(37,99,235,1)' }} />
            <span>High Engagement</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Content Strategy ────────────────────────────────────────────────────

type Pillar = { name: string; target: number; current: number; description: string };

function ContentStrategyTab() {
  const [pillars, setPillars] = useState<Pillar[]>([
    { name: 'Thought Leadership', target: 30, current: 25, description: 'Share insights, opinions, and industry expertise' },
    { name: 'Product & Service', target: 20, current: 30, description: 'Showcase offerings, testimonials, case studies' },
    { name: 'Company Culture', target: 15, current: 10, description: 'Team stories, behind-the-scenes, values' },
    { name: 'Industry News', target: 20, current: 20, description: 'Curated news, trends, and commentary' },
    { name: 'Educational', target: 15, current: 15, description: 'How-to guides, tips, explainers' },
  ]);
  const [planTopic, setPlanTopic] = useState('');
  const [planIndustry, setPlanIndustry] = useState('');
  const [planPersona, setPlanPersona] = useState('');
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState('');
  const [repurposeText, setRepurposeText] = useState('');
  const [repurposing, setRepurposing] = useState(false);
  const [repurposed, setRepurposed] = useState('');

  const generatePlan = async () => {
    if (!planTopic) { alert('Enter a topic'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/linkedin-management/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `30-day LinkedIn content calendar for ${planTopic}. Industry: ${planIndustry || 'wellness'}. Persona: ${planPersona || 'HR managers'}. Generate 10 post ideas with: post type, topic, best day and time, expected reach tier (low/medium/high). Format as a numbered list.`,
          tone: 'professional',
          post_type: 'article',
        }),
      });
      const d = await res.json() as GenerateResult;
      setPlan(d.content);
    } catch {
      alert('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const repurpose = async () => {
    if (!repurposeText.trim()) { alert('Paste blog post text first'); return; }
    setRepurposing(true);
    try {
      const res = await fetch('/api/admin/linkedin-management/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `Repurpose this blog post into 3 LinkedIn variants: (1) text post, (2) carousel hook, (3) poll question. Blog: ${repurposeText.slice(0, 500)}`,
          tone: 'professional',
          post_type: 'text',
        }),
      });
      const d = await res.json() as GenerateResult;
      setRepurposed(d.content);
    } catch {
      alert('Repurpose failed');
    } finally {
      setRepurposing(false);
    }
  };

  // Mini weekly calendar
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const calendar: Record<string, { type: PostType; label: string }[]> = {
    Mon: [{ type: 'article', label: 'Thought Leadership' }, { type: 'text', label: 'Tip' }],
    Tue: [{ type: 'image', label: 'Culture' }],
    Wed: [{ type: 'carousel', label: 'Educational' }],
    Thu: [{ type: 'text', label: 'Industry News' }],
    Fri: [{ type: 'poll', label: 'Engagement Poll' }],
    Sat: [],
    Sun: [],
  };

  return (
    <div className="space-y-8">
      {/* Content pillars */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Content Pillars</h3>
        <div className="space-y-4">
          {pillars.map((p, i) => (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm text-gray-800">{p.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.description}</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-500">Target: <span className="font-medium">{p.target}%</span></span>
                  <span className={`${p.current > p.target ? 'text-orange-500' : p.current < p.target ? 'text-blue-500' : 'text-green-500'} font-medium`}>
                    Current: {p.current}%
                  </span>
                </div>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full">
                <div className="absolute h-3 rounded-full bg-blue-200" style={{ width: `${p.target}%` }} />
                <div className={`absolute h-3 rounded-full ${p.current > p.target ? 'bg-orange-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(p.current, 100)}%` }} />
              </div>
              <input
                type="range" min={0} max={50} value={p.current}
                onChange={e => setPillars(ps => ps.map((x, j) => j === i ? { ...x, current: parseInt(e.target.value, 10) } : x))}
                className="w-full accent-blue-600 mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mini content calendar */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Weekly Content Calendar</h3>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => (
            <div key={day} className="min-h-[80px]">
              <div className="text-xs font-semibold text-gray-500 mb-1.5 text-center">{day}</div>
              <div className="space-y-1">
                {(calendar[day] ?? []).map((item, i) => (
                  <div key={i} className={`text-xs px-1.5 py-1 rounded text-center ${TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {item.label}
                  </div>
                ))}
                {!(calendar[day] ?? []).length && (
                  <div className="text-xs text-gray-200 text-center py-2">–</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Content Plan */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">AI 30-Day Content Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Topic / Niche</label>
            <input type="text" value={planTopic} onChange={e => setPlanTopic(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Corporate yoga & wellness" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
            <input type="text" value={planIndustry} onChange={e => setPlanIndustry(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Technology, Finance, Healthcare..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target Persona</label>
            <input type="text" value={planPersona} onChange={e => setPlanPersona(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="HR Managers, CEOs..." />
          </div>
        </div>
        <button onClick={generatePlan} disabled={generating} className="bg-purple-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {generating ? 'Generating with Ollama...' : 'Generate 30-Day Content Plan'}
        </button>
        {plan && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {plan}
          </div>
        )}
      </div>

      {/* Repurpose Assistant */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Repurpose Assistant</h3>
        <p className="text-sm text-gray-500 mb-3">Paste blog post text and get 3 LinkedIn variants: text post, carousel hook, and a poll question.</p>
        <textarea
          value={repurposeText}
          onChange={e => setRepurposeText(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          placeholder="Paste your blog post content here..."
        />
        <button onClick={repurpose} disabled={repurposing} className="bg-teal-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {repurposing ? 'Repurposing with Ollama...' : 'Generate 3 LinkedIn Variants'}
        </button>
        {repurposed && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
            {repurposed}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab() {
  const [autoPublish, setAutoPublish] = useState(false);
  const [timeWindow, setTimeWindow] = useState('09:00');
  const [defaultHashtags, setDefaultHashtags] = useState('#yoga #wellness #mindfulness');
  const [defaultCta, setDefaultCta] = useState('Book a discovery call — link in bio.');
  const [appendCta, setAppendCta] = useState(false);
  const [competitors, setCompetitors] = useState(['']);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* LinkedIn connection */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">LinkedIn Account</h3>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-sm text-gray-800">Personal Profile</div>
            <div className="text-xs text-gray-500">Not connected</div>
          </div>
          <button className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Connect</button>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-2">
          <div>
            <div className="font-medium text-sm text-gray-800">Company Page</div>
            <div className="text-xs text-gray-500">Not connected</div>
          </div>
          <button className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Connect</button>
        </div>
      </div>

      {/* Postiz integration */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Postiz Integration</h3>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-sm text-gray-800">Postiz Social Scheduler</div>
            <div className="text-xs text-gray-500">Status: configured via MCP social route</div>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
        </div>
      </div>

      {/* Auto-publish */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Auto-Publish</h3>
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <div
            onClick={() => setAutoPublish(v => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${autoPublish ? 'bg-blue-600' : 'bg-gray-300'} relative cursor-pointer`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoPublish ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">Enable auto-publish for scheduled posts</span>
        </label>
        {autoPublish && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred publish window</label>
            <input type="time" value={timeWindow} onChange={e => setTimeWindow(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      {/* Signature & CTA */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Default Signature & CTA</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Hashtags</label>
            <input type="text" value={defaultHashtags} onChange={e => setDefaultHashtags(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default CTA</label>
            <input type="text" value={defaultCta} onChange={e => setDefaultCta(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={appendCta} onChange={e => setAppendCta(e.target.checked)} className="rounded" />
            Auto-append CTA to all posts
          </label>
        </div>
      </div>

      {/* Competitor monitoring */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Competitor Monitoring (up to 5)</h3>
        <div className="space-y-2">
          {competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={c}
                onChange={e => setCompetitors(cs => cs.map((x, j) => j === i ? e.target.value : x))}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder={`https://linkedin.com/company/competitor-${i + 1}`}
              />
              {competitors.length > 1 && (
                <button onClick={() => setCompetitors(cs => cs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
              )}
            </div>
          ))}
          {competitors.length < 5 && (
            <button onClick={() => setCompetitors(cs => [...cs, ''])} className="text-sm text-blue-600 hover:underline">+ Add competitor</button>
          )}
        </div>
      </div>

      <button onClick={save} className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700">
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
