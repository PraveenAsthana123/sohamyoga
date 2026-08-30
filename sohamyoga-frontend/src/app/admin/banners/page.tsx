"use client";
// Was previously a hardcoded BANNERS mock array with no backing table/API,
// despite Banner.ts/BannerCampaign.ts/BannerMedia.ts being a real, sophisticated
// domain model. Now backed by a real `banner` table + /api/banners.
import { useEffect, useState, useCallback } from "react";
import { FeatureGate } from "@/components/features/FeatureGate";

interface BannerRow {
  id: string; title: string; type: string; mediaType: string; status: string; category: string;
  tags: string[]; views: number; clicks: number; isFeatured: boolean; isFavorite: boolean; schedule: string;
}

const CATEGORIES = ["All", "Festival", "Classes", "Training", "Promotion", "Events", "Seasonal"];
const MEDIA_TYPES = ["All", "image", "video", "gif", "svg", "lottie"];
const STATUSES = ["All", "draft", "pending_approval", "approved", "scheduled", "active", "paused", "archived"];
const TYPES = ["hero", "full_screen", "slider", "carousel", "video", "inline", "popup", "sidebar", "announcement"];

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", pending_approval: "bg-yellow-100 text-yellow-700", approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700", active: "bg-green-100 text-green-700", paused: "bg-orange-100 text-orange-700",
  archived: "bg-gray-100 text-gray-500",
};
const TYPE_ICON: Record<string, string> = {
  hero: "🖼️", slider: "🎠", carousel: "🎡", video: "🎬", inline: "📄", popup: "💬", sidebar: "📌", full_screen: "⛶", announcement: "📢",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color ?? "bg-gray-100 text-gray-600"}`}>{label}</span>;
}

function NewBannerForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(''); const [slug, setSlug] = useState('');
  const [type, setType] = useState('hero'); const [mediaUrl, setMediaUrl] = useState('');
  const [altText, setAltText] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/banners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, type, mediaType: 'image', mediaUrl, altText }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setTitle(''); setSlug(''); setMediaUrl(''); setAltText(''); onCreated(); }
    else setError(body.error ?? 'Failed to create banner.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Banner</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug-like-this" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="Media URL" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Alt text (required)" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !title || !slug || !mediaUrl || !altText} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [mediaType, setMediaType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/banners', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setBanners(d?.banners ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: string) {
    await fetch(`/api/banners/${id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }

  const filtered = banners.filter(b =>
    (category === "All" || b.category === category) &&
    (mediaType === "All" || b.mediaType === mediaType) &&
    (statusFilter === "All" || b.status === statusFilter) &&
    (!showFavOnly || b.isFavorite) &&
    (b.title.toLowerCase().includes(search.toLowerCase()) || b.tags.some(t => t.includes(search.toLowerCase())))
  );

  const stats = {
    total: banners.length, active: banners.filter(b => b.status === "active").length, draft: banners.filter(b => b.status === "draft").length,
    totalViews: banners.reduce((s, b) => s + b.views, 0), totalClicks: banners.reduce((s, b) => s + b.clicks, 0),
  };

  return (
    <FeatureGate flag="banner.library">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banner Library</h1>
            <p className="text-sm text-gray-500">Real data from the `banner` table — was a hardcoded mock list before.</p>
          </div>
          <NewBannerForm onCreated={load} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total Banners", value: stats.total, color: "text-gray-800" },
            { label: "Active", value: stats.active, color: "text-green-600" },
            { label: "Draft", value: stats.draft, color: "text-gray-500" },
            { label: "Total Views", value: stats.totalViews.toLocaleString(), color: "text-indigo-600" },
            { label: "Total Clicks", value: stats.totalClicks.toLocaleString(), color: "text-purple-600" },
          ].map(k => (
            <div key={k.label} className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search banners or tags…" className="flex-1 min-w-[180px] px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <select value={category} onChange={e => setCategory(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={mediaType} onChange={e => setMediaType(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">{MEDIA_TYPES.map(m => <option key={m}>{m}</option>)}</select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showFavOnly} onChange={e => setShowFavOnly(e.target.checked)} className="rounded" /> Favorites only
          </label>
          <div className="ml-auto flex border rounded-md overflow-hidden">
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm ${view === v ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{v === "grid" ? "⊞" : "≡"}</button>
            ))}
          </div>
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : <>
        <p className="text-sm text-gray-500 mb-3">{filtered.length} banner{filtered.length !== 1 ? "s" : ""}</p>

        {view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(b => (
              <div key={b.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-36 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-4xl relative">
                  {TYPE_ICON[b.type] ?? "🖼️"}
                  {b.isFeatured && <span className="absolute top-2 left-2 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-medium">Featured</span>}
                  <span className="absolute bottom-2 right-2"><Badge label={b.mediaType} /></span>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{b.title}</p>
                    <Badge label={b.status} color={STATUS_COLOR[b.status]} />
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{b.category} · {b.type} · {b.schedule}</p>
                  <div className="flex gap-1 flex-wrap mb-2">{b.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}</div>
                  {b.views > 0 && (
                    <div className="flex gap-4 text-xs text-gray-500 mb-2">
                      <span>👁 {b.views.toLocaleString()}</span><span>🖱 {b.clicks}</span><span>CTR {((b.clicks / b.views) * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {b.status === 'draft' && <button onClick={() => transition(b.id, 'submit')} className="text-xs text-indigo-600 hover:underline">Submit</button>}
                    {b.status === 'pending_approval' && <button onClick={() => transition(b.id, 'approve')} className="text-xs text-green-600 hover:underline">Approve</button>}
                    {(b.status === 'approved' || b.status === 'scheduled' || b.status === 'paused') && <button onClick={() => transition(b.id, 'activate')} className="text-xs text-green-600 hover:underline">Activate</button>}
                    {b.status === 'active' && <button onClick={() => transition(b.id, 'pause')} className="text-xs text-orange-600 hover:underline">Pause</button>}
                    {b.status !== 'archived' && <button onClick={() => transition(b.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                  </div>
                </div>
              </div>
            ))}
            {!filtered.length && <p className="col-span-3 text-center text-sm text-gray-400 py-8">No banners yet — create one above.</p>}
          </div>
        )}

        {view === "list" && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Banner</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Views</th><th className="px-4 py-3">CTR</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium text-gray-800">{b.title}</p><p className="text-xs text-gray-400">{b.category}</p></td>
                    <td className="px-4 py-3">{TYPE_ICON[b.type]} {b.type}</td>
                    <td className="px-4 py-3"><Badge label={b.status} color={STATUS_COLOR[b.status]} /></td>
                    <td className="px-4 py-3 text-gray-600">{b.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{b.views > 0 ? ((b.clicks / b.views) * 100).toFixed(1) : "—"}%</td>
                    <td className="px-4 py-3">
                      {b.status !== 'archived' && <button onClick={() => transition(b.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="text-center text-sm text-gray-400 py-8">No banners yet — create one above.</p>}
          </div>
        )}
        </>}
      </div>
    </FeatureGate>
  );
}
