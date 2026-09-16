'use client';

import { useCallback, useEffect, useState } from 'react';

const TABS = ['Overview', 'Carousels', 'Banners', 'Analytics'] as const;
type Tab = typeof TABS[number];

const LOCATIONS = ['hero', 'testimonials', 'gallery', 'teachers', 'services', 'promotions', 'classes', 'partners', 'videos', 'products'] as const;
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700', archived: 'bg-red-100 text-red-600',
};

interface Carousel {
  id: string; name: string; location: string; status: string; description: string | null;
  view_count: number; click_count: number; autoplay: boolean; autoplay_delay: number;
  effect: string; slide_count: string;
}

interface Banner {
  id: string; title: string; slug: string; type: string; media_type: string; status: string;
  media_url: string; headline: string | null; created_at: string;
}

interface Summary { total: number; active: number; draft: number; totalSlides: number; }

interface Data { carousels: Carousel[]; banners: Banner[]; summary: Summary; }

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600', green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c[color] ?? c.gray}`}>{children}</span>;
}

function statusColor(s: string) {
  return s === 'active' ? 'green' : s === 'paused' ? 'amber' : s === 'archived' ? 'red' : 'gray';
}

export default function CarouselAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', location: LOCATIONS[0] as string, effect: 'slide', autoplay: true, autoplay_delay: 5000 });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/carousel', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: Data) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    await fetch('/api/admin/carousel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowCreate(false);
    setForm({ name: '', location: LOCATIONS[0], effect: 'slide', autoplay: true, autoplay_delay: 5000 });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/admin/carousel', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const deleteCarousel = async (id: string) => {
    if (!confirm('Delete this carousel and all its slides?')) return;
    await fetch(`/api/admin/carousel?id=${id}`, { method: 'DELETE' });
    load();
  };

  const carousels = data?.carousels ?? [];
  const filtered = statusFilter === 'all' ? carousels : carousels.filter(c => c.status === statusFilter);
  const summary = data?.summary ?? { total: 0, active: 0, draft: 0, totalSlides: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carousel Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Homepage hero, testimonials, gallery, and promotional carousels</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
            + New Carousel
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading carousels…</div>
        ) : (
          <>
            {tab === 'Overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Total Carousels" value={summary.total} />
                  <KpiCard label="Active" value={summary.active} />
                  <KpiCard label="Draft" value={summary.draft} />
                  <KpiCard label="Total Slides" value={summary.totalSlides} />
                </div>
                {summary.total === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <div className="text-2xl mb-2">🖼️</div>
                    <p className="text-sm text-amber-800 font-medium">No carousels created yet</p>
                    <p className="text-xs text-amber-600 mt-1">Create your first carousel to manage homepage hero, testimonials, and gallery sections.</p>
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 text-sm bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700">
                      Create First Carousel
                    </button>
                  </div>
                )}
                {carousels.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {carousels.map(c => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{c.name}</div>
                            <div className="text-xs text-gray-500">{c.location}</div>
                          </div>
                          <Badge color={statusColor(c.status)}>{c.status}</Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.slide_count} slides · {c.view_count.toLocaleString()} views · {c.click_count.toLocaleString()} clicks
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'Carousels' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm">
                    <option value="all">All statuses</option>
                    {['active', 'draft', 'paused', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-xs text-gray-500">{filtered.length} carousels</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>{['Name', 'Location', 'Slides', 'Views', 'Clicks', 'Status', 'Actions'].map(h =>
                        <th key={h} className="px-4 py-3 text-left">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-gray-500">{c.location}</td>
                          <td className="px-4 py-3">{c.slide_count}</td>
                          <td className="px-4 py-3">{Number(c.view_count).toLocaleString()}</td>
                          <td className="px-4 py-3">{Number(c.click_count).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <select value={c.status}
                              onChange={e => setStatus(c.id, e.target.value)}
                              className={`text-xs border-0 rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {['draft', 'active', 'paused', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteCarousel(c.id)}
                              className="text-xs text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">No carousels yet.</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'Banners' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Banners ({data?.banners.length ?? 0})</h2>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>{['Title', 'Type', 'Media Type', 'Status', 'Created'].map(h =>
                        <th key={h} className="px-4 py-3 text-left">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(data?.banners ?? []).map(b => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{b.title}</td>
                          <td className="px-4 py-3"><Badge>{b.type}</Badge></td>
                          <td className="px-4 py-3 text-gray-500">{b.media_type}</td>
                          <td className="px-4 py-3"><Badge color={statusColor(b.status)}>{b.status}</Badge></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(data?.banners ?? []).length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">No banners created yet.</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'Analytics' && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
                Analytics requires carousels with active impressions. Create carousels and embed the carousel widget on your website pages — analytics will populate as visitors interact.
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">New Carousel</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Homepage Hero" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Page Location</label>
                <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm">
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Transition Effect</label>
                <select value={form.effect} onChange={e => setForm({ ...form, effect: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm">
                  {['slide', 'fade', 'cube', 'flip', 'coverflow', 'creative'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoplay" checked={form.autoplay}
                  onChange={e => setForm({ ...form, autoplay: e.target.checked })} className="rounded" />
                <label htmlFor="autoplay" className="text-sm text-gray-700">Autoplay</label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={create} disabled={saving || !form.name.trim()}
                className="text-sm px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
