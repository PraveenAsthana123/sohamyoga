'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Listing = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  status: string;
  platform: string;
};

type Stats = {
  total: number;
  active: number;
  revenue: number | string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Digital Products', 'Services', 'Courses', 'Templates', 'Software', 'Physical'];
const PLATFORMS = ['All', 'Gumroad', 'Etsy', 'Amazon', 'Shopify', 'WooCommerce', 'Direct'];
const STATUSES = ['All', 'active', 'draft', 'paused', 'sold_out'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  paused: 'bg-yellow-100 text-yellow-700',
  sold_out: 'bg-red-100 text-red-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketplaceHubPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', price: '', status: 'draft', platform: '' });
  const [aiName, setAiName] = useState('');
  const [aiDesc, setAiDesc] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    fetch('/api/admin/marketplace-hub')
      .then(r => r.json())
      .then(d => { setListings(d.listings ?? []); setStats(d.stats ?? { total: 0, active: 0, revenue: 0 }); setLoading(false); })
      .catch(() => { setError('Failed to load listings'); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch('/api/admin/marketplace-hub/sync', { method: 'POST' });
      load();
    } catch { /* ignore */ } finally { setSyncing(false); }
  }

  async function handleAdd() {
    if (!form.name) return;
    await fetch('/api/admin/marketplace-hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setForm({ name: '', category: '', price: '', status: 'draft', platform: '' });
    load();
  }

  async function generateDescription() {
    if (!aiName) return;
    setAiLoading(true);
    setAiDesc('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Write a compelling marketplace listing description for: "${aiName}". Include key benefits, target audience, and a clear call to action. Keep it under 150 words.` }),
      });
      const d = await r.json();
      setAiDesc(d.result ?? d.text ?? JSON.stringify(d));
    } catch { setAiDesc('Error connecting to AI.'); } finally { setAiLoading(false); }
  }

  const filtered = listings.filter(l => {
    if (filterCat !== 'All' && l.category !== filterCat) return false;
    if (filterPlatform !== 'All' && l.platform !== filterPlatform) return false;
    if (filterStatus !== 'All' && l.status !== filterStatus) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace Hub</h1>
            <p className="text-gray-500 mt-1">Manage listings across all platforms.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-slate-800 text-white rounded font-medium text-sm hover:bg-slate-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync All'}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
            >
              + Add Listing
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Listings', value: stats.total },
            { label: 'Active Listings', value: stats.active },
            { label: 'Total Revenue', value: typeof stats.revenue === 'number' ? `$${stats.revenue.toLocaleString()}` : stats.revenue },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500 uppercase font-medium">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
            />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Listings Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No listings match filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Category', 'Platform', 'Price', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.category}</td>
                    <td className="px-4 py-3 text-gray-600">{l.platform}</td>
                    <td className="px-4 py-3 text-gray-900">${l.price}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline text-xs">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* AI Description Generator */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Listing Description Generator</h2>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={aiName}
              onChange={e => setAiName(e.target.value)}
              placeholder="Product / listing name…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={generateDescription}
              disabled={aiLoading || !aiName}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiLoading ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {aiDesc && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">{aiDesc}</div>
          )}
        </div>

        {/* Add Listing Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Listing</h3>
              <div className="space-y-3">
                {[
                  { key: 'name', label: 'Name', placeholder: 'Listing name' },
                  { key: 'category', label: 'Category', placeholder: 'e.g. Courses' },
                  { key: 'platform', label: 'Platform', placeholder: 'e.g. Gumroad' },
                  { key: 'price', label: 'Price (USD)', placeholder: '0.00' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={(form as Record<string, string>)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5 justify-end">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Add Listing</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
