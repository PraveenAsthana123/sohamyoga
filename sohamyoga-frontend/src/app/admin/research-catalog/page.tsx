'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  id: string;
  title: string;
  category: string;
  methodology: string;
  pages: number;
  price_usd: number | string;
  status: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Market Research',
  'Competitor Analysis',
  'Consumer Behavior',
  'Trend Analysis',
  'Brand Audit',
  'SEO Research',
  'Social Listening',
  'Ad Intelligence',
  'Product Research',
  'Pricing Analysis',
  'Customer Journey',
];

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-red-100 text-red-600',
};

const METHODOLOGIES = ['Quantitative', 'Qualitative', 'Mixed Methods', 'Secondary Research', 'Primary Research', 'Desk Research'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchCatalogPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', methodology: '', pages: '', price_usd: '', status: 'draft' });
  const [aiTitle, setAiTitle] = useState('');
  const [aiOutline, setAiOutline] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    fetch('/api/admin/research-catalog')
      .then(r => r.json())
      .then(d => { setReports(d.reports ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load catalog'); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.title) return;
    await fetch('/api/admin/research-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, pages: Number(form.pages) || 0, price_usd: Number(form.price_usd) || 0 }),
    });
    setShowCreate(false);
    setForm({ title: '', category: '', methodology: '', pages: '', price_usd: '', status: 'draft' });
    load();
  }

  async function generateOutline() {
    if (!aiTitle) return;
    setAiLoading(true);
    setAiOutline('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Create a detailed research report outline for: "${aiTitle}". Include: Executive Summary, Methodology, 5-7 main sections with sub-points, Key Findings format, Recommendations, and Appendix structure. Format as a structured outline.`,
        }),
      });
      const d = await r.json();
      setAiOutline(d.result ?? d.text ?? JSON.stringify(d));
    } catch { setAiOutline('Error connecting to AI.'); } finally { setAiLoading(false); }
  }

  const filtered = reports.filter(r => {
    if (filterCat !== 'All' && r.category !== filterCat) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const catCounts = CATEGORIES.slice(1).reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = reports.filter(r => r.category === cat).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Research Catalog</h1>
            <p className="text-gray-500 mt-1">{reports.length} report types across {CATEGORIES.length - 1} categories.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
          >
            + New Report
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        <div className="flex gap-6">

          {/* Sidebar: Category filter */}
          <div className="w-52 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">Categories</div>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex justify-between items-center hover:bg-gray-50 transition ${filterCat === cat ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <span>{cat}</span>
                  <span className="text-xs text-gray-400">{cat === 'All' ? reports.length : (catCounts[cat] ?? 0)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main: Search + Grid */}
          <div className="flex-1">
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search report titles…"
                className="w-full border border-gray-300 rounded px-4 py-2.5 text-sm bg-white"
              />
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400">Loading catalog…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">No reports found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {filtered.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                      <span className="text-xs text-gray-400">{r.pages}p</span>
                    </div>
                    <div className="font-medium text-gray-900 text-sm mb-1 leading-snug">{r.title}</div>
                    <div className="text-xs text-gray-500 mb-1">{r.category}</div>
                    <div className="text-xs text-gray-400">{r.methodology}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">${r.price_usd}</span>
                      <button className="text-xs text-blue-600 hover:underline">View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Outline Generator */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Generate Report Outline (AI)</h2>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={aiTitle}
                  onChange={e => setAiTitle(e.target.value)}
                  placeholder="Report title or topic…"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={generateOutline}
                  disabled={aiLoading || !aiTitle}
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiLoading ? 'Generating…' : 'Generate Outline'}
                </button>
              </div>
              {aiOutline && (
                <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">{aiOutline}</div>
              )}
            </div>
          </div>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Report</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                  <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Report title" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                      <option value="">— select —</option>
                      {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Methodology</label>
                    <select value={form.methodology} onChange={e => setForm(p => ({ ...p, methodology: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                      <option value="">— select —</option>
                      {METHODOLOGIES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pages</label>
                    <input type="number" value={form.pages} onChange={e => setForm(p => ({ ...p, pages: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price (USD)</label>
                    <input type="number" value={form.price_usd} onChange={e => setForm(p => ({ ...p, price_usd: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Create Report</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
