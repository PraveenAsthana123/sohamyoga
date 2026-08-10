"use client";
import { useState } from "react";
import { FeatureGate } from "@/components/features/FeatureGate";

const CAMPAIGNS = [
  {
    id: "c1", name: "Diwali Yoga Festival", type: "festival",
    status: "active", banners: 3,
    start: "2026-10-20", end: "2026-11-05",
    views: 12400, clicks: 558, conversions: 84, revenue: 4200,
    isAbTest: false,
  },
  {
    id: "c2", name: "September Beginner Series", type: "seasonal",
    status: "scheduled", banners: 2,
    start: "2026-09-01", end: "2026-09-30",
    views: 0, clicks: 0, conversions: 0, revenue: 0,
    isAbTest: true,
  },
  {
    id: "c3", name: "Weekend Flash Sale", type: "flash",
    status: "approved", banners: 1,
    start: "2026-08-29", end: "2026-08-31",
    views: 0, clicks: 0, conversions: 0, revenue: 0,
    isAbTest: false,
  },
  {
    id: "c4", name: "Summer Ongoing Promo", type: "ongoing",
    status: "paused", banners: 4,
    start: "2026-06-01", end: "2026-08-31",
    views: 28000, clicks: 840, conversions: 126, revenue: 7560,
    isAbTest: false,
  },
  {
    id: "c5", name: "Spring Referral Drive", type: "referral",
    status: "completed", banners: 2,
    start: "2026-03-01", end: "2026-05-31",
    views: 45200, clicks: 2260, conversions: 339, revenue: 20340,
    isAbTest: true,
  },
];

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  approved:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  scheduled: "bg-purple-100 text-purple-700",
  paused:    "bg-orange-100 text-orange-700",
  completed: "bg-teal-100 text-teal-700",
  archived:  "bg-gray-100 text-gray-400",
};

const TYPE_ICON: Record<string, string> = {
  festival: "🪔", seasonal: "🌿", flash: "⚡", ongoing: "♻️",
  referral: "🤝", ab_test: "🔬", holiday: "🎉", weekend: "📅", launch: "🚀",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color ?? "bg-gray-100 text-gray-600"}`}>{label}</span>;
}

const TABS = ["All", "Active", "Scheduled", "Approved", "Paused", "Completed"] as const;

export default function BannerCampaignsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("All");
  const [search, setSearch] = useState("");

  const filtered = CAMPAIGNS.filter(c =>
    (tab === "All" || c.status === tab.toLowerCase()) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = CAMPAIGNS.filter(c => c.status === "active").reduce((s, c) => s + c.revenue, 0);
  const totalConversions = CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);

  return (
    <FeatureGate flag="banner.campaign_manager">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banner Campaign Manager</h1>
            <p className="text-sm text-gray-500">Schedule, A/B test, and measure banner campaigns across portal and social media</p>
          </div>
          <div className="flex gap-2">
            <a href="http://localhost:5000" target="_blank" rel="noreferrer"
               className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Postiz Social</a>
            <a href="http://localhost:1337/admin" target="_blank" rel="noreferrer"
               className="px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">Strapi CMS</a>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Campaign</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Campaigns",  value: CAMPAIGNS.filter(c => c.status === "active").length,  color: "text-green-600" },
            { label: "Total Conversions", value: totalConversions,                                      color: "text-indigo-600" },
            { label: "Active Revenue",    value: `CAD ${totalRevenue.toLocaleString()}`,                color: "text-purple-600" },
            { label: "A/B Tests Live",    value: CAMPAIGNS.filter(c => c.isAbTest && c.status === "active").length, color: "text-amber-600" },
          ].map(k => (
            <div key={k.label} className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex border rounded-lg overflow-hidden">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm whitespace-nowrap ${tab === t ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                {t}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="ml-auto px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56" />
        </div>

        <div className="space-y-3">
          {filtered.map(c => {
            const ctr = c.views > 0 ? ((c.clicks / c.views) * 100).toFixed(1) : "—";
            const convRate = c.clicks > 0 ? ((c.conversions / c.clicks) * 100).toFixed(1) : "—";
            return (
              <div key={c.id} className="bg-white border rounded-lg p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TYPE_ICON[c.type] ?? "📢"}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{c.name}</h3>
                        {c.isAbTest && <Badge label="A/B Test" color="bg-amber-100 text-amber-700" />}
                        <Badge label={c.status} color={STATUS_COLOR[c.status]} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.type} · {c.banners} banner{c.banners !== 1 ? "s" : ""} · {c.start} → {c.end}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "active"   && <button className="text-xs px-3 py-1.5 border rounded text-orange-600 border-orange-300 hover:bg-orange-50">Pause</button>}
                    {c.status === "approved" && <button className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700">Activate</button>}
                    <button className="text-xs px-3 py-1.5 border rounded text-gray-600 hover:bg-gray-50">View Details</button>
                  </div>
                </div>

                {c.views > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-xs text-gray-400">Views</p><p className="font-semibold">{c.views.toLocaleString()}</p></div>
                    <div><p className="text-xs text-gray-400">CTR</p><p className="font-semibold">{ctr}%</p></div>
                    <div><p className="text-xs text-gray-400">Conv. Rate</p><p className="font-semibold">{convRate}%</p></div>
                    <div><p className="text-xs text-gray-400">Revenue</p><p className="font-semibold text-green-700">CAD {c.revenue.toLocaleString()}</p></div>
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  {["Facebook","Instagram","LinkedIn","X","Pinterest"].map(p => (
                    <span key={p} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                  <a href="http://localhost:5000" target="_blank" rel="noreferrer"
                     className="text-xs text-gray-400 hover:text-indigo-600 ml-auto">Schedule via Postiz →</a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FeatureGate>
  );
}
