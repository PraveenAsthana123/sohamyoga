"use client";
import { useState } from "react";
import { FeatureGate } from "@/components/features/FeatureGate";

const BANNERS = [
  { id: "b1", title: "Diwali Yoga Special",     type: "hero",        mediaType: "image", status: "active",    category: "Festival",  tags: ["diwali","offers"], views: 4200, clicks: 189, isFeatured: true,  isFavorite: false, schedule: "Oct 20–Nov 5" },
  { id: "b2", title: "Morning Flow Series",      type: "slider",      mediaType: "video", status: "scheduled", category: "Classes",   tags: ["morning","hatha"], views: 0,    clicks: 0,   isFeatured: false, isFavorite: true,  schedule: "Sep 1–Sep 30" },
  { id: "b3", title: "RYT-200 Teacher Training", type: "inline",      mediaType: "image", status: "approved",  category: "Training",  tags: ["teacher","RYT"],   views: 0,    clicks: 0,   isFeatured: false, isFavorite: false, schedule: "—" },
  { id: "b4", title: "Wellness Workshop Sale",   type: "popup",       mediaType: "gif",   status: "paused",    category: "Promotion", tags: ["sale","workshop"], views: 1800, clicks: 72,  isFeatured: false, isFavorite: false, schedule: "Sep 10–20" },
  { id: "b5", title: "Studio Opening Nov",       type: "announcement",mediaType: "image", status: "draft",     category: "Events",    tags: ["studio","new"],    views: 0,    clicks: 0,   isFeatured: false, isFavorite: false, schedule: "—" },
  { id: "b6", title: "New Year Intentions Flow", type: "full_screen", mediaType: "video", status: "archived",  category: "Seasonal",  tags: ["newyear"],         views: 6100, clicks: 244, isFeatured: false, isFavorite: false, schedule: "Jan 1–15" },
];

const CATEGORIES = ["All", "Festival", "Classes", "Training", "Promotion", "Events", "Seasonal"];
const MEDIA_TYPES = ["All", "image", "video", "gif", "svg", "lottie"];
const STATUSES = ["All", "draft", "pending_approval", "approved", "scheduled", "active", "paused", "archived"];

const STATUS_COLOR: Record<string, string> = {
  draft:            "bg-gray-100 text-gray-600",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved:         "bg-blue-100 text-blue-700",
  scheduled:        "bg-purple-100 text-purple-700",
  active:           "bg-green-100 text-green-700",
  paused:           "bg-orange-100 text-orange-700",
  archived:         "bg-gray-100 text-gray-500",
};

const TYPE_ICON: Record<string, string> = {
  hero: "🖼️", slider: "🎠", carousel: "🎡", video: "🎬",
  inline: "📄", popup: "💬", sidebar: "📌", full_screen: "⛶", announcement: "📢",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color ?? "bg-gray-100 text-gray-600"}`}>{label}</span>;
}

export default function BannersPage() {
  const [category, setCategory] = useState("All");
  const [mediaType, setMediaType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const filtered = BANNERS.filter(b =>
    (category   === "All" || b.category === category) &&
    (mediaType  === "All" || b.mediaType === mediaType) &&
    (statusFilter === "All" || b.status === statusFilter) &&
    (!showFavOnly || b.isFavorite) &&
    (b.title.toLowerCase().includes(search.toLowerCase()) || b.tags.some(t => t.includes(search.toLowerCase())))
  );

  const stats = {
    total:  BANNERS.length,
    active: BANNERS.filter(b => b.status === "active").length,
    draft:  BANNERS.filter(b => b.status === "draft").length,
    totalViews:  BANNERS.reduce((s, b) => s + b.views, 0),
    totalClicks: BANNERS.reduce((s, b) => s + b.clicks, 0),
  };

  return (
    <FeatureGate flag="banner.library">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banner Library</h1>
            <p className="text-sm text-gray-500">Digital asset management — design, schedule, and publish across all channels</p>
          </div>
          <div className="flex gap-2">
            <a href="http://localhost:1337/admin" target="_blank" rel="noreferrer"
               className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Strapi CMS</a>
            <a href="http://localhost:9002" target="_blank" rel="noreferrer"
               className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">PhotoPrism</a>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Banner</button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total Banners", value: stats.total,  color: "text-gray-800" },
            { label: "Active",        value: stats.active, color: "text-green-600" },
            { label: "Draft",         value: stats.draft,  color: "text-gray-500" },
            { label: "Total Views",   value: stats.totalViews.toLocaleString(),  color: "text-indigo-600" },
            { label: "Total Clicks",  value: stats.totalClicks.toLocaleString(), color: "text-purple-600" },
          ].map(k => (
            <div key={k.label} className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search banners or tags…"
            className="flex-1 min-w-[180px] px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <select value={category} onChange={e => setCategory(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={mediaType} onChange={e => setMediaType(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            {MEDIA_TYPES.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showFavOnly} onChange={e => setShowFavOnly(e.target.checked)} className="rounded" />
            Favorites only
          </label>
          <div className="ml-auto flex border rounded-md overflow-hidden">
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                {v === "grid" ? "⊞" : "≡"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-3">{filtered.length} banner{filtered.length !== 1 ? "s" : ""}</p>

        {/* Grid view */}
        {view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(b => (
              <div key={b.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                {/* Thumbnail placeholder */}
                <div className="h-36 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-4xl relative">
                  {TYPE_ICON[b.type] ?? "🖼️"}
                  {b.isFeatured && <span className="absolute top-2 left-2 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-medium">Featured</span>}
                  {b.isFavorite && <span className="absolute top-2 right-2">❤️</span>}
                  <span className="absolute bottom-2 right-2"><Badge label={b.mediaType} /></span>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{b.title}</p>
                    <Badge label={b.status} color={STATUS_COLOR[b.status]} />
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{b.category} · {b.type} · {b.schedule}</p>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {b.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                  </div>
                  {b.views > 0 && (
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>👁 {b.views.toLocaleString()}</span>
                      <span>🖱 {b.clicks}</span>
                      <span>CTR {b.views > 0 ? ((b.clicks/b.views)*100).toFixed(1) : 0}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Banner</th>
                  <th className="px-4 py-3">Type / Media</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">CTR</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.title}</p>
                      <p className="text-xs text-gray-400">{b.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{TYPE_ICON[b.type]} {b.type}</span>
                      <span className="ml-2 text-xs text-gray-400">{b.mediaType}</span>
                    </td>
                    <td className="px-4 py-3"><Badge label={b.status} color={STATUS_COLOR[b.status]} /></td>
                    <td className="px-4 py-3 text-gray-500">{b.schedule}</td>
                    <td className="px-4 py-3 text-gray-600">{b.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{b.views > 0 ? ((b.clicks/b.views)*100).toFixed(1) : "—"}%</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs text-indigo-600 hover:underline">Edit</button>
                        <button className="text-xs text-gray-400 hover:underline">Archive</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
