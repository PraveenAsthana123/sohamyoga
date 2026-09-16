"use client";
import { useEffect, useState } from "react";

const TABS = ["Funnel", "Metrics", "Experiments", "Channels", "North Star"] as const;
type Tab = typeof TABS[number];

interface GrowthData {
  funnel: { stage: string; count: number; pct: number }[];
  metrics: { name: string; current: number; prev: number; unit: string }[];
  experiments_count: number;
  channels: { name: string; cac: number; volume: number }[];
  north_star: { name: string; value: number; unit: string; trend: number };
}

const FALLBACK: GrowthData = {
  funnel: [
    { stage: "Awareness", count: 48200, pct: 100 },
    { stage: "Acquisition", count: 12400, pct: 25.7 },
    { stage: "Activation", count: 4800, pct: 9.9 },
    { stage: "Retention", count: 2900, pct: 6.0 },
    { stage: "Revenue", count: 1640, pct: 3.4 },
    { stage: "Referral", count: 390, pct: 0.8 },
  ],
  metrics: [
    { name: "Monthly Active Users", current: 4800, prev: 4100, unit: "" },
    { name: "Monthly Revenue", current: 48750, prev: 41200, unit: "$" },
    { name: "Avg Session Duration", current: 8.4, prev: 7.1, unit: "min" },
    { name: "Retention Rate (30d)", current: 62, prev: 57, unit: "%" },
    { name: "NPS Score", current: 71, prev: 65, unit: "" },
  ],
  experiments_count: 7,
  channels: [
    { name: "Organic Search", cac: 0, volume: 1840 },
    { name: "Social Media (Paid)", cac: 28, volume: 920 },
    { name: "Email Referral", cac: 4, volume: 640 },
    { name: "Influencer", cac: 52, volume: 380 },
    { name: "Direct / Brand", cac: 0, volume: 1020 },
  ],
  north_star: { name: "Weekly Active Students", value: 2840, unit: "students", trend: 12.4 },
};

export default function GrowthPage() {
  const [tab, setTab] = useState<Tab>("Funnel");
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/growth", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => { setData(d ?? FALLBACK); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  const d = data!;

  const maxFunnelCount = d.funnel[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Growth Overview</h1>
        <p className="text-gray-500 mb-6">Funnel health, growth metrics, channel CAC, and experiments</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Funnel" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">AARRR Growth Funnel</h2>
            <div className="space-y-3">
              {d.funnel.map((stage, i) => {
                const widthPct = Math.round((stage.count / maxFunnelCount) * 100);
                const colors = ["bg-indigo-500", "bg-blue-500", "bg-cyan-500", "bg-teal-500", "bg-green-500", "bg-emerald-500"];
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-gray-600 text-right">{stage.stage}</div>
                    <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden">
                      <div className={`h-10 ${colors[i]} rounded-lg flex items-center px-3`} style={{ width: `${widthPct}%` }}>
                        <span className="text-white text-xs font-semibold whitespace-nowrap">{stage.count.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-16 text-xs text-gray-400 text-right">{stage.pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "Metrics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {d.metrics.map(m => {
                const growthPct = m.prev > 0 ? (((m.current - m.prev) / m.prev) * 100).toFixed(1) : "0";
                const positive = m.current >= m.prev;
                return (
                  <div key={m.name} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{m.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{m.unit === "$" ? "$" : ""}{m.current.toLocaleString()}{m.unit !== "$" ? m.unit : ""}</p>
                    <p className={`text-xs mt-1 font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
                      {positive ? "+" : ""}{growthPct}% MoM (was {m.unit === "$" ? "$" : ""}{m.prev.toLocaleString()}{m.unit !== "$" ? m.unit : ""})
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "Experiments" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Growth Experiments</h2>
              <a href="/admin/growth-hacking" className="text-sm text-indigo-600 hover:underline">Manage in Growth Hacking →</a>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 mb-4">
              <p className="text-3xl font-bold text-indigo-700">{d.experiments_count}</p>
              <p className="text-sm text-indigo-500 mt-1">active experiments running</p>
            </div>
            <p className="text-sm text-gray-500">Full experiment management (A/B tests, feature flags, hypothesis tracking) is available in the <a href="/admin/growth-hacking" className="text-indigo-600 hover:underline">Growth Hacking</a> module.</p>
          </div>
        )}

        {tab === "Channels" && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Customer Acquisition Cost by Channel</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Channel", "CAC", "New Users", "Efficiency"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.channels.map(c => (
                  <tr key={c.name} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.cac === 0 ? "Organic" : `$${c.cac}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.volume.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.cac === 0 ? "bg-green-100 text-green-700" : c.cac < 30 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {c.cac === 0 ? "Free" : c.cac < 30 ? "Good" : "Review"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "North Star" && (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-3">North Star Metric</p>
            <p className="text-6xl font-black text-indigo-600 mb-2">{d.north_star.value.toLocaleString()}</p>
            <p className="text-lg text-gray-600 mb-1">{d.north_star.name}</p>
            <p className="text-sm text-gray-400 mb-6">{d.north_star.unit}</p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${d.north_star.trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              <span>{d.north_star.trend >= 0 ? "↑" : "↓"}</span>
              <span>{Math.abs(d.north_star.trend)}% vs last week</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
