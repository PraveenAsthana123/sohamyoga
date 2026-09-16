'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Brochure {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string | null;
  thumbnail_url: string | null;
  version: string;
  status: string;
  download_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface BrochureForm {
  title: string;
  description: string;
  category: string;
  file_url: string;
  thumbnail_url: string;
  version: string;
  tags: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES = ['product', 'service', 'company', 'event', 'campaign'];
const STATUSES = ['all', 'published', 'draft', 'archived'] as const;
type StatusFilter = typeof STATUSES[number];

function categoryColor(c: string): string {
  const m: Record<string, string> = {
    product: 'bg-blue-100 text-blue-700',
    service: 'bg-purple-100 text-purple-700',
    company: 'bg-teal-100 text-teal-700',
    event: 'bg-amber-100 text-amber-700',
    campaign: 'bg-pink-100 text-pink-700',
  };
  return m[c] ?? 'bg-gray-100 text-gray-600';
}

function statusDot(s: string): string {
  return s === 'published' ? 'bg-green-500' : s === 'archived' ? 'bg-red-400' : 'bg-gray-400';
}

const EMPTY_FORM: BrochureForm = {
  title: '', description: '', category: 'product',
  file_url: '', thumbnail_url: '', version: '1.0', tags: '',
};

const PLACEHOLDER_THUMB = 'https://placehold.co/280x160/f1f5f9/94a3b8?text=No+Image';

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BrochuresPage() {
  const [tab, setTab] = useState<StatusFilter>('all');
  const [brochures, setBrochures] = useState<Brochure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<BrochureForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/brochures');
      const data = await res.json() as { brochures?: Brochure[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setBrochures(data.brochures ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = brochures.filter(b => tab === 'all' || b.status === tab);

  const handleCreate = async () => {
    if (!form.title) return;
    setCreating(true);
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const res = await fetch('/api/admin/brochures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags: tags.length ? tags : undefined }),
      });
      if (!res.ok) throw new Error('Failed to create');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      alert('Error creating brochure.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (b: Brochure) => {
    const next = b.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/admin/brochures/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  const handleDownload = async (b: Brochure) => {
    await fetch(`/api/admin/brochures/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ increment_download: true }),
    });
    if (b.file_url) window.open(b.file_url, '_blank');
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brochure?')) return;
    await fetch(`/api/admin/brochures/${id}`, { method: 'DELETE' });
    await load();
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/admin/brochures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    await load();
  };

  const TAB_LABELS: Record<StatusFilter, string> = {
    all: 'All', published: 'Published', draft: 'Drafts', archived: 'Archived',
  };

  const counts: Record<StatusFilter, number> = {
    all: brochures.length,
    published: brochures.filter(b => b.status === 'published').length,
    draft: brochures.filter(b => b.status === 'draft').length,
    archived: brochures.filter(b => b.status === 'archived').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brochure Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {counts.published} published · {counts.draft} drafts · {brochures.reduce((s, b) => s + b.download_count, 0)} total downloads
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Brochure
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === s ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[s]}
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No brochures found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(b => (
              <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {/* Thumbnail */}
                <div className="relative">
                  <img
                    src={b.thumbnail_url ?? PLACEHOLDER_THUMB}
                    alt={b.title}
                    className="w-full h-40 object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_THUMB; }}
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${statusDot(b.status)}`} title={b.status} />
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${categoryColor(b.category)}`}>
                      {b.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{b.title}</h3>
                  {b.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{b.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span>v{b.version}</span>
                    <span>{b.download_count} downloads</span>
                  </div>

                  {b.tags && b.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {b.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                      {b.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{b.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-3 border-t border-gray-100 flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleDownload(b)}
                      className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 min-w-0"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleToggleStatus(b)}
                      className={`flex-1 py-1.5 text-xs rounded min-w-0 ${
                        b.status === 'published'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {b.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    {b.status !== 'archived' && (
                      <button
                        onClick={() => handleArchive(b.id)}
                        className="py-1.5 px-2 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="py-1.5 px-2 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100"
                    >
                      Del
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Brochure</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Product Overview Brochure"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 resize-y"
                  placeholder="Brief description of this brochure…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="1.0"
                    value={form.version}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File URL</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://cdn.example.com/brochure.pdf"
                  value={form.file_url}
                  onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://cdn.example.com/thumb.jpg"
                  value={form.thumbnail_url}
                  onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="yoga, wellness, b2b"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.title}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Brochure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
