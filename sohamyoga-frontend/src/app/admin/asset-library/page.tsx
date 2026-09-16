'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
  id: number;
  title: string;
  asset_type: string;
  category: string | null;
  tags: string[] | null;
  file_url: string | null;
  thumbnail_url: string | null;
  file_size_kb: number | null;
  mime_type: string | null;
  source: string;
  usage_count: number;
  created_at: string;
};

type TypeStat = { asset_type: string; cnt: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_TYPES = ['All', 'image', 'video', 'audio', 'document', 'template'];
const CATEGORIES = ['All', 'Brand', 'Social Media', 'Email', 'Ads', 'Blog', 'Product', 'Presentations', 'Training', 'Other'];

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📄',
  template: '📐',
};

const TYPE_COLORS: Record<string, string> = {
  image: 'bg-blue-100 text-blue-700',
  video: 'bg-purple-100 text-purple-700',
  audio: 'bg-green-100 text-green-700',
  document: 'bg-yellow-100 text-yellow-700',
  template: 'bg-pink-100 text-pink-700',
};

// ─── Add Asset Modal ──────────────────────────────────────────────────────────

type AddModalProps = {
  onClose: () => void;
  onAdded: () => void;
};

function AddAssetModal({ onClose, onAdded }: AddModalProps) {
  const [form, setForm] = useState({
    title: '', asset_type: 'image', category: '', tags: '',
    file_url: '', thumbnail_url: '', file_size_kb: '', mime_type: '', source: 'upload',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.title || !form.asset_type) { setError('Title and type are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await fetch('/api/admin/asset-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags,
          file_size_kb: form.file_size_kb ? Number(form.file_size_kb) : null,
        }),
      });
      onAdded();
    } catch { setError('Failed to save asset.'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Asset</h3>
        {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Asset title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                {ASSET_TYPES.slice(1).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                <option value="">— none —</option>
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="yoga, brand, summer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">File URL</label>
            <input type="text" value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="https://…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thumbnail URL</label>
            <input type="text" value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">File Size (KB)</label>
              <input type="number" value={form.file_size_kb} onChange={e => setForm(p => ({ ...p, file_size_kb: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">MIME Type</label>
              <input type="text" value={form.mime_type} onChange={e => setForm(p => ({ ...p, mime_type: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="image/png" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              <option value="upload">Upload</option>
              <option value="generated">AI Generated</option>
              <option value="stock">Stock</option>
              <option value="external">External</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: Asset }) {
  const icon = TYPE_ICONS[asset.asset_type] ?? '📦';
  const color = TYPE_COLORS[asset.asset_type] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition">
      {/* Thumbnail */}
      <div className="h-36 bg-gray-100 flex items-center justify-center relative">
        {asset.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl opacity-40">{icon}</span>
        )}
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
          {icon} {asset.asset_type}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="font-medium text-gray-900 text-sm truncate" title={asset.title}>{asset.title}</div>
        {asset.category && <div className="text-xs text-gray-500 mt-0.5">{asset.category}</div>}

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
            {asset.tags.length > 4 && <span className="text-xs text-gray-400">+{asset.tags.length - 4}</span>}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <span>{asset.file_size_kb ? `${asset.file_size_kb} KB` : '—'}</span>
          <span>Used {asset.usage_count}×</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [typeStats, setTypeStats] = useState<TypeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiTags, setAiTags] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  function buildQuery() {
    const params = new URLSearchParams();
    if (filterType !== 'All') params.set('type', filterType);
    if (filterCat !== 'All') params.set('category', filterCat);
    if (search) params.set('q', search);
    return params.toString();
  }

  function load() {
    setLoading(true);
    fetch(`/api/admin/asset-library?${buildQuery()}`)
      .then(r => r.json())
      .then(d => { setAssets(d.assets ?? []); setTypeStats(d.stats ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load assets'); setLoading(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filterType, filterCat, search]);

  async function generateTags() {
    if (!aiTitle) return;
    setAiLoading(true);
    setAiTags('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate 10-15 relevant tags for a digital asset titled: "${aiTitle}". Tags should be concise, searchable keywords useful for a marketing asset library. Return as a comma-separated list only, no explanation.`,
        }),
      });
      const d = await r.json();
      setAiTags(d.result ?? d.text ?? JSON.stringify(d));
    } catch { setAiTags('Error connecting to AI.'); } finally { setAiLoading(false); }
  }

  const statMap = Object.fromEntries(typeStats.map(s => [s.asset_type, Number(s.cnt)]));
  const totalAssets = typeStats.reduce((sum, s) => sum + Number(s.cnt), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asset Library</h1>
            <p className="text-gray-500 mt-1">Manage all brand and marketing assets in one place.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
          >
            + Add Asset
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{totalAssets}</span>
            <span className="text-sm text-gray-500">Total Assets</span>
          </div>
          {ASSET_TYPES.slice(1).map(type => (
            <div key={type} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2">
              <span>{TYPE_ICONS[type]}</span>
              <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
              <span className="text-sm font-bold text-gray-900">{statMap[type] ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
            />
            <div className="flex gap-2 flex-wrap">
              {ASSET_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterType === t ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t !== 'All' && TYPE_ICONS[t] ? `${TYPE_ICONS[t]} ` : ''}{t}
                </button>
              ))}
            </div>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Asset Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading assets…</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-lg font-medium">No assets found</div>
            <div className="text-sm mt-1">Add your first asset to get started.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
            {assets.map(a => <AssetCard key={a.id} asset={a} />)}
          </div>
        )}

        {/* AI Tag Generator */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Tag Generator</h2>
          <p className="text-xs text-gray-500 mb-3">Paste a title or description to generate search-optimized tags via Ollama.</p>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={aiTitle}
              onChange={e => setAiTitle(e.target.value)}
              placeholder="Asset title or description…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={generateTags}
              disabled={aiLoading || !aiTitle}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiLoading ? 'Generating…' : 'Generate Tags'}
            </button>
          </div>
          {aiTags && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-2">Suggested Tags:</div>
              <div className="flex flex-wrap gap-2">
                {aiTags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showAdd && (
          <AddAssetModal
            onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); load(); }}
          />
        )}
      </div>
    </div>
  );
}
