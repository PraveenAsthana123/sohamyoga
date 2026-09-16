"use client";
import { useEffect, useState } from "react";

const TABS = ["Overview", "Revenue", "Products", "Customers", "Channels", "AI Insights"] as const;
type Tab = typeof TABS[number];

interface EcomData {
  gmv: number;
  orders: number;
  aov: number;
  conversion_rate: number;
  new_customers: number;
  returning_customers: number;
  monthly_revenue?: { month: string; revenue: number }[];
  top_products?: { name: string; revenue: number; units: number; category: string }[];
  channels?: { source: string; sessions: number; conversions: number; revenue: number }[];
}

const FALLBACK: EcomData = {
  gmv: 48750,
  orders: 312,
  aov: 156.25,
  conversion_rate: 3.2,
  new_customers: 89,
  returning_customers: 223,
  monthly_revenue: [
    { month: "Apr", revenue: 38200 }, { month: "May", revenue: 42100 },
    { month: "Jun", revenue: 39800 }, { month: "Jul", revenue: 44500 },
    { month: "Aug", revenue: 46900 }, { month: "Sep", revenue: 48750 },
  ],
  top_products: [
    { name: "Online Yoga 30-Day Program", revenue: 12400, units: 62, category: "Digital" },
    { name: "Premium Mat + Strap Bundle", revenue: 8900, units: 89, category: "Physical" },
    { name: "Monthly Membership", revenue: 7200, units: 48, category: "Subscription" },
    { name: "Beginner Workshop Series", revenue: 5600, units: 40, category: "Event" },
    { name: "Meditation Audio Pack", revenue: 4100, units: 164, category: "Digital" },
  ],
  channels: [
    { source: "Organic Search", sessions: 4821, conversions: 154, revenue: 18200 },
    { source: "Social Media", sessions: 3240, conversions: 87, revenue: 12400 },
    { source: "Email", sessions: 1890, conversions: 56, revenue: 9800 },
    { source: "Direct", sessions: 1120, conversions: 15, revenue: 8350 },
  ],
};

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border shadow-sm ${highlight ? "bg-indigo-600 text-white border-indigo-500" : "bg-white text-gray-900 border-gray-100"}`}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${highlight ? "text-indigo-200" : "text-gray-400"}`}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className={`text-xs mt-1 ${highlight ? "text-indigo-200" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

export default function EcommerceAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<EcomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ecommerce-analytics", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => { setData(d ?? FALLBACK); setLoading(false); });
  }, []);

  const runAi = async () => {
    if (!aiPrompt.trim() || !data) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Ecommerce metrics: GMV=$${data.gmv}, orders=${data.orders}, AOV=$${data.aov}, conversion=${data.conversion_rate}%, new_customers=${data.new_customers}, returning=${data.returning_customers}. Question: ${aiPrompt}`,
        }),
      });
      const d = await res.json();
      setAiResult(d.result || d.text || JSON.stringify(d));
    } catch {
      setAiResult("Unable to reach AI service. Please try again.");
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const d = data!;
  const maxRev = Math.max(...(d.monthly_revenue?.map(r => r.revenue) ?? [1]));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Ecommerce Analytics</h1>
        <p className="text-gray-500 mb-6">Sales performance, product insights, and customer behaviour</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Gross Merchandise Value" value={`$${d.gmv.toLocaleString()}`} highlight />
            <KpiCard label="Total Orders" value={d.orders.toLocaleString()} />
            <KpiCard label="Avg Order Value" value={`$${d.aov.toFixed(2)}`} />
            <KpiCard label="Conversion Rate" value={`${d.conversion_rate}%`} />
            <KpiCard label="New Customers" value={d.new_customers.toLocaleString()} />
            <KpiCard label="Returning Customers" value={d.returning_customers.toLocaleString()} />
          </div>
        )}

        {tab === "Revenue" && d.monthly_revenue && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Monthly Revenue</h2>
            <div className="flex items-end gap-3 h-48">
              {d.monthly_revenue.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">${(m.revenue / 1000).toFixed(1)}k</span>
                  <div className="w-full bg-indigo-400 rounded-t-md"
                    style={{ height: `${Math.round((m.revenue / maxRev) * 160)}px` }} />
                  <span className="text-xs text-gray-500">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Products" && d.top_products && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Top Products by Revenue</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Product", "Category", "Units Sold", "Revenue"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.top_products.map((p, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.units}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Customers" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="New Customers" value={d.new_customers.toString()} />
              <KpiCard label="Returning Customers" value={d.returning_customers.toString()} />
              <KpiCard label="Return Rate" value={`${Math.round((d.returning_customers / (d.new_customers + d.returning_customers)) * 100)}%`} />
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">New vs Returning</h3>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-sm text-gray-600 w-24">New</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full">
                  <div className="h-4 bg-blue-400 rounded-full"
                    style={{ width: `${Math.round((d.new_customers / (d.new_customers + d.returning_customers)) * 100)}%` }} />
                </div>
                <span className="text-sm font-medium text-gray-800 w-12 text-right">{d.new_customers}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">Returning</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full">
                  <div className="h-4 bg-indigo-400 rounded-full"
                    style={{ width: `${Math.round((d.returning_customers / (d.new_customers + d.returning_customers)) * 100)}%` }} />
                </div>
                <span className="text-sm font-medium text-gray-800 w-12 text-right">{d.returning_customers}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "Channels" && d.channels && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Traffic Source Breakdown</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Source", "Sessions", "Conversions", "Conv. Rate", "Revenue"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.channels.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.sessions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.conversions}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{((c.conversions / c.sessions) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${c.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "AI Insights" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">AI Ecommerce Insights</h2>
            <p className="text-sm text-gray-500 mb-4">Ask AI for analysis and recommendations based on your store data.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none mb-3"
              placeholder="e.g. How can I increase AOV? Which products should I promote more?" />
            <button onClick={runAi} disabled={aiLoading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? "Analyzing…" : "Generate Insights"}
            </button>
            {aiResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
