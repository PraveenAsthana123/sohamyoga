'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: number; title: string; slug: string; excerpt: string; content: string;
  author: string; category: string; tags: string; status: string;
  seo_title: string; seo_description: string; seo_keywords: string;
  word_count: number; reading_time_minutes: number; views: number; shares: number;
  ai_generated: boolean; scheduled_at: string | null; published_at: string | null;
  created_at: string; updated_at: string;
}

interface BlogCategory {
  id: number; name: string; slug: string; description: string; post_count: number;
}

interface AnalyticsData {
  topPosts: Array<{ id: number; title: string; views: number; shares: number; status: string }>;
  byCategory: Array<{ category: string; count: number }>;
  weekly: Array<{ week: string; posts: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function readingTime(wc: number) {
  return Math.max(1, Math.round(wc / 200));
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', review: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-blue-100 text-blue-700', published: 'bg-green-100 text-green-700',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BlogAdminPage() {
  const [tab, setTab] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetch('/api/admin/blog-cms/seed', { method: 'POST' })
      .then(r => r.json())
      .then((d: { ok?: boolean }) => { if (d.ok !== false) setSeeded(true); })
      .catch(() => setSeeded(true));
  }, []);

  const handleEditPost = (post: BlogPost) => {
    setEditPost(post);
    setTab(1);
  };

  const tabs = ['Posts', 'Write', 'Categories', 'SEO', 'Analytics', 'AI Generator'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Blog CMS</h1>
          <p className="text-sm text-gray-500 mt-0.5">Write, manage, and optimize blog content with AI assistance</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!seeded && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">Initializing…</div>}
        {tab === 0 && <TabPosts onEdit={handleEditPost} onNew={() => { setEditPost(null); setTab(1); }} />}
        {tab === 1 && <TabWrite post={editPost} onSaved={() => { setTab(0); setEditPost(null); }} />}
        {tab === 2 && <TabCategories />}
        {tab === 3 && <TabSEO />}
        {tab === 4 && <TabAnalytics />}
        {tab === 5 && <TabAIGenerator onPopulate={post => { setEditPost(post as BlogPost); setTab(1); }} />}
      </div>
    </div>
  );
}

// ── Tab 1: Posts ──────────────────────────────────────────────────────────────

function TabPosts({ onEdit, onNew }: { onEdit: (p: BlogPost) => void; onNew: () => void }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ resource: 'posts', ...(statusFilter ? { status: statusFilter } : {}), ...(search ? { search } : {}), sortBy });
    fetch(`/api/admin/blog-cms?${params}`)
      .then(r => r.json())
      .then((d: { posts?: BlogPost[] }) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter, sortBy, search]);

  useEffect(() => { load(); }, [load]);

  const total = posts.length;
  const published = posts.filter(p => p.status === 'published').length;
  const draft = posts.filter(p => p.status === 'draft').length;
  const scheduled = posts.filter(p => p.status === 'scheduled').length;

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/admin/blog-cms/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total },
          { label: 'Published', value: published, color: 'text-green-600' },
          { label: 'Draft', value: draft, color: 'text-gray-500' },
          { label: 'Scheduled', value: scheduled, color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={`text-3xl font-bold ${k.color ?? 'text-gray-900'}`}>{loading ? '…' : k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3 items-center flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-48" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option><option value="review">Review</option>
            <option value="scheduled">Scheduled</option><option value="published">Published</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="created_at">Newest</option>
            <option value="views">Most Views</option>
          </select>
        </div>
        <button onClick={onNew} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + New Post
        </button>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Title', 'Category', 'Status', 'Words', 'Views', 'Published', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm line-clamp-1">{p.title}</div>
                    <div className="text-xs text-gray-400">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.category ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.word_count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.views ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(p)} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">Edit</button>
                      <button className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">Preview</button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No posts yet. Create one!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Write ──────────────────────────────────────────────────────────────

interface WriteFormState {
  title: string; slug: string; excerpt: string; content: string; category: string; tags: string;
  seo_title: string; seo_description: string; seo_keywords: string;
  status: string; scheduled_at: string;
}

function TabWrite({ post, onSaved }: { post: BlogPost | null; onSaved: () => void }) {
  const [form, setForm] = useState<WriteFormState>({
    title: post?.title ?? '', slug: post?.slug ?? '', excerpt: post?.excerpt ?? '',
    content: post?.content ?? '', category: post?.category ?? '', tags: post?.tags ?? '',
    seo_title: post?.seo_title ?? '', seo_description: post?.seo_description ?? '',
    seo_keywords: post?.seo_keywords ?? '', status: post?.status ?? 'draft',
    scheduled_at: post?.scheduled_at ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const wc = wordCount(form.content);
  const rt = readingTime(wc);
  const seoDescLen = form.seo_description.length;
  const excerptLen = form.excerpt.length;

  const setField = (key: keyof WriteFormState, value: string) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === 'title') next.slug = slugify(value);
      return next;
    });
  };

  const handleAI = async (action: string) => {
    setAiLoading(action);
    try {
      const r = await fetch('/api/admin/blog-cms/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, topic: form.title, text: form.content }),
      });
      const d = await r.json() as {
        introduction?: string; seo_title?: string; seo_description?: string;
        seo_keywords?: string; tags?: string[]; result?: Record<string, string | string[]>;
      };
      const res = d.result ?? d;
      if (action === 'write-intro' && (res.introduction ?? d.introduction)) {
        setField('content', String(res.introduction ?? d.introduction));
      } else if (action === 'generate-seo') {
        if (res.seo_title ?? d.seo_title) setField('seo_title', String(res.seo_title ?? d.seo_title));
        if (res.seo_description ?? d.seo_description) setField('seo_description', String(res.seo_description ?? d.seo_description));
        if (res.seo_keywords ?? d.seo_keywords) setField('seo_keywords', String(res.seo_keywords ?? d.seo_keywords));
      } else if (action === 'suggest-tags') {
        const tags = (res.tags ?? d.tags) as string[] | undefined;
        if (tags?.length) setField('tags', tags.join(', '));
      }
    } catch { /* ignore */ } finally { setAiLoading(null); }
  };

  const handleSave = async (publish = false) => {
    if (!form.title.trim()) { setMsg('Title is required.'); return; }
    setSaving(true); setMsg('');
    const payload = {
      ...form, word_count: wc, reading_time_minutes: rt,
      status: publish ? 'published' : form.status,
      published_at: publish ? new Date().toISOString() : undefined,
    };
    try {
      const url = post ? `/api/admin/blog-cms/${post.id}` : '/api/admin/blog-cms';
      const method = post ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Failed');
      setMsg(publish ? 'Published!' : 'Draft saved!');
      setTimeout(onSaved, 1000);
    } catch { setMsg('Error saving.'); } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main editor */}
      <div className="lg:col-span-2 space-y-4">
        {msg && <div className={`p-3 rounded text-sm ${msg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input value={form.title} onChange={e => setField('title', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-medium text-gray-900" placeholder="Post title…" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
          <input value={form.slug} onChange={e => setField('slug', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-600" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Excerpt <span className={`ml-1 ${excerptLen > 150 ? 'text-red-500' : 'text-gray-400'}`}>{excerptLen}/150</span>
          </label>
          <textarea value={form.excerpt} onChange={e => setField('excerpt', e.target.value)} rows={2} maxLength={200}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-700">Content (Markdown)</label>
            <span className="text-xs text-gray-400">{wc} words · {rt} min read</span>
          </div>
          <textarea value={form.content} onChange={e => setField('content', e.target.value)} rows={18}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            placeholder="Write your post in Markdown…" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleAI('write-intro')} disabled={!!aiLoading || !form.title}
              className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50">
              {aiLoading === 'write-intro' ? 'Writing…' : 'AI Write Introduction'}
            </button>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">SEO</h3>
            <button onClick={() => handleAI('generate-seo')} disabled={!!aiLoading || !form.content.trim()}
              className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50">
              {aiLoading === 'generate-seo' ? 'Generating…' : 'AI Generate SEO'}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Meta Title</label>
            <input value={form.seo_title} onChange={e => setField('seo_title', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Meta Description <span className={`ml-1 ${seoDescLen > 150 ? 'text-red-500' : 'text-gray-400'}`}>{seoDescLen}/150</span>
            </label>
            <textarea value={form.seo_description} onChange={e => setField('seo_description', e.target.value)} rows={2} maxLength={160}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Keywords</label>
            <input value={form.seo_keywords} onChange={e => setField('seo_keywords', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="yoga, wellness, mindfulness" />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Publish Settings</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="draft">Draft</option><option value="review">Review</option>
              <option value="scheduled">Scheduled</option><option value="published">Published</option>
            </select>
          </div>
          {form.status === 'scheduled' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scheduled At</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setField('scheduled_at', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <input value={form.category} onChange={e => setField('category', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Yoga" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Tags</label>
              <button onClick={() => handleAI('suggest-tags')} disabled={!!aiLoading || !form.title}
                className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50">
                {aiLoading === 'suggest-tags' ? '…' : 'AI Suggest'}
              </button>
            </div>
            <input value={form.tags} onChange={e => setField('tags', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="yoga, wellness, mindfulness" />
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Publishing…' : 'Publish'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => onSaved()} className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Categories ─────────────────────────────────────────────────────────

function TabCategories() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/blog-cms?resource=categories')
      .then(r => r.json())
      .then((d: { categories?: BlogCategory[] }) => setCategories(d.categories ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/admin/blog-cms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'category', name: form.name, slug: slugify(form.name), description: form.description }),
      });
      if (!r.ok) throw new Error('Failed');
      setMsg('Category added!'); setForm({ name: '', description: '' }); load();
    } catch { setMsg('Error.'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Blog Categories</h2>
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <div className="bg-white border border-indigo-200 rounded-lg p-4 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Category Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Yoga Poses" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div className="text-xs text-gray-400">Slug: <span className="font-mono">{slugify(form.name || 'category')}</span></div>
        <button onClick={handleAdd} disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Category'}
        </button>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Slug', 'Description', 'Posts'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{c.slug}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.description}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.post_count}</td>
                </tr>
              ))}
              {categories.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: SEO ────────────────────────────────────────────────────────────────

function TabSEO() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/blog-cms?resource=seo')
      .then(r => r.json())
      .then((d: { posts?: BlogPost[] }) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const seoScore = (p: BlogPost) => {
    let score = 0;
    if (p.seo_title?.trim()) score += 34;
    if (p.seo_description?.trim()) score += 33;
    if (p.seo_keywords?.trim()) score += 33;
    return score;
  };

  const handleFixSEO = async (p: BlogPost) => {
    setFixing(p.id);
    try {
      const r = await fetch('/api/admin/blog-cms/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix-seo', topic: p.title, text: p.content }),
      });
      const d = await r.json() as { seo_title?: string; seo_description?: string; seo_keywords?: string; result?: Record<string, string> };
      const res = d.result ?? d;
      await fetch(`/api/admin/blog-cms/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seo_title: res.seo_title, seo_description: res.seo_description, seo_keywords: res.seo_keywords }),
      });
      setPosts(prev => prev.map(post => post.id === p.id ? { ...post, seo_title: String(res.seo_title ?? ''), seo_description: String(res.seo_description ?? ''), seo_keywords: String(res.seo_keywords ?? '') } : post));
    } catch { /* ignore */ } finally { setFixing(null); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">SEO Completeness</h2>
      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Title', 'Meta Title', 'Meta Description', 'Keywords', 'Score', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(p => {
                const score = seoScore(p);
                return (
                  <tr key={p.id} className={`border-b border-gray-100 ${score < 80 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 max-w-xs truncate">{p.title}</td>
                    <td className="px-4 py-3 text-xs">{p.seo_title?.trim() ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}</td>
                    <td className="px-4 py-3 text-xs">{p.seo_description?.trim() ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}</td>
                    <td className="px-4 py-3 text-xs">{p.seo_keywords?.trim() ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {score < 100 && (
                        <button onClick={() => handleFixSEO(p)} disabled={fixing === p.id}
                          className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50">
                          {fixing === p.id ? 'Fixing…' : 'AI Fix SEO'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {posts.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No posts found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Analytics ──────────────────────────────────────────────────────────

function TabAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/blog-cms?resource=analytics').then(r => r.json()),
      fetch('/api/admin/blog-cms?resource=posts').then(r => r.json()),
    ]).then(([analytics, posts]: [{ topPosts?: AnalyticsData['topPosts']; byCategory?: AnalyticsData['byCategory']; weekly?: AnalyticsData['weekly'] }, { posts?: BlogPost[] }]) => {
      setData({ topPosts: analytics.topPosts ?? [], byCategory: analytics.byCategory ?? [], weekly: analytics.weekly ?? [] });
      setTotalWords((posts.posts ?? []).reduce((s: number, p: BlogPost) => s + (p.word_count ?? 0), 0));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-gray-400 text-sm">No data.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
        <div className="text-3xl font-bold text-indigo-600">{totalWords.toLocaleString()}</div>
        <div className="text-sm text-gray-500 mt-1">Total Words Written</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top posts */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top 5 Posts by Views</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="pb-2">Title</th><th className="pb-2">Views</th><th className="pb-2">Status</th></tr></thead>
            <tbody>
              {data.topPosts.slice(0, 5).map(p => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-700 max-w-xs truncate">{p.title}</td>
                  <td className="py-2 text-xs font-medium">{p.views}</td>
                  <td className="py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(p.status)}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By category */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Posts by Category</h3>
          <div className="space-y-2">
            {data.byCategory.map(c => (
              <div key={c.category} className="flex items-center gap-3">
                <div className="text-xs text-gray-600 w-32 truncate">{c.category || 'Uncategorized'}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, c.count * 10)}%` }} />
                </div>
                <div className="text-xs text-gray-500 w-6 text-right">{c.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Publishing Frequency (last 8 weeks)</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="pb-2">Week</th><th className="pb-2">Posts Published</th></tr></thead>
            <tbody>
              {data.weekly.map(w => (
                <tr key={w.week} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-600">{w.week}</td>
                  <td className="py-2 text-xs font-medium">{w.posts}</td>
                </tr>
              ))}
              {data.weekly.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400 text-xs">No weekly data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 6: AI Generator ───────────────────────────────────────────────────────

interface GeneratedPost {
  title?: string; excerpt?: string; content?: string; tags?: string[] | string;
  seo_title?: string; seo_description?: string;
}

function TabAIGenerator({ onPopulate }: { onPopulate: (post: Partial<BlogPost>) => void }) {
  const [form, setForm] = useState({ topic: '', audience: 'wellness enthusiasts', tone: 'inspirational', length: 'medium' });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!form.topic.trim()) return;
    setGenerating(true); setResult(null); setError('');
    try {
      const r = await fetch('/api/admin/blog-cms/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const d = await r.json() as { result?: GeneratedPost; title?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      setResult(d.result ?? d as GeneratedPost);
    } catch (e) { setError(String(e)); } finally { setGenerating(false); }
  };

  const handleUsePost = () => {
    if (!result) return;
    onPopulate({
      title: result.title ?? '', excerpt: result.excerpt ?? '',
      content: result.content ?? '',
      tags: Array.isArray(result.tags) ? result.tags.join(', ') : result.tags ?? '',
      seo_title: result.seo_title ?? '', seo_description: result.seo_description ?? '',
      slug: slugify(result.title ?? ''),
      status: 'draft',
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">AI Blog Post Generator</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Topic *</label>
            <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. 5 Yoga Poses for Lower Back Pain Relief" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Target Audience</label>
            <input value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
            <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="inspirational">Inspirational</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Length</label>
            <select value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="short">Short (~500w)</option>
              <option value="medium">Medium (~1000w)</option>
              <option value="long">Long (~2000w)</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={generating || !form.topic.trim()}
            className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {generating ? 'Generating Full Post…' : 'Generate Full Post'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {result && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Generated Post</h3>
              <button onClick={handleUsePost} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">
                Use in Editor
              </button>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Title</div>
              <div className="text-sm font-semibold text-gray-900">{result.title}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Excerpt</div>
              <div className="text-sm text-gray-600">{result.excerpt}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Content Preview</div>
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {result.content?.slice(0, 500)}…
              </div>
            </div>
            {result.tags && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Tags</div>
                <div className="flex gap-1 flex-wrap">
                  {(Array.isArray(result.tags) ? result.tags : [result.tags]).map((t, i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
