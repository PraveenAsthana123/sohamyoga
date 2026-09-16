"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const TABS = ["Overview", "Campaigns", "Content", "SEO", "Social", "AI Strategy"] as const;
type Tab = typeof TABS[number];

interface MarketingData {
  budget_spent: number;
  budget_allocated: number;
  campaigns_active: number;
  leads_generated: number;
  mqls: number;
  recent_campaigns?: { id: string; name: string; status: string; spend: number; leads: number }[];
  recent_content?: { title: string; type: string; published_at: string; views: number }[];
  keyword_rankings?: { keyword: string; position: number; change: number }[];
  social_followers?: { platform: string; followers: number; change: number }[];
}

const FALLBACK: MarketingData = {
  budget_spent: 12400,
  budget_allocated: 18000,
  campaigns_active: 5,
  leads_generated: 284,
  mqls: 67,
  recent_campaigns: [
    { id: "1", name: "September Yoga Challenge", status: "RUNNING", spend: 3200, leads: 89 },
    { id: "2", name: "Back-to-School Membership Drive", status: "RUNNING", spend: 2100, leads: 62 },
    { id: "3", name: "Instructor Spotlight Series", status: "COMPLETED", spend: 1800, leads: 41 },
    { id: "4", name: "Referral Rewards Program", status: "RUNNING", spend: 900, leads: 57 },
    { id: "5", name: "Wellness Workshop Q4 Preview", status: "DRAFT", spend: 0, leads: 0 },
  ],
  recent_content: [
    { title: "5 Yoga Poses for Better Sleep", type: "Blog", published_at: "2026-09-14", views: 1842 },
    { title: "Meet Our Head Instructor: Sandra", type: "Video", published_at: "2026-09-12", views: 3290 },
    { title: "October Class Schedule", type: "Announcement", published_at: "2026-09-10", views: 724 },
    { title: "The Science of Breathwork", type: "Blog", published_at: "2026-09-08", views: 2110 },
    { title: "New Member Welcome Kit", type: "Guide", published_at: "2026-09-05", views: 508 },
  ],
  keyword_rankings: [
    { keyword: "yoga classes Calgary", position: 3, change: 1 },
    { keyword: "hot yoga near me", position: 7, change: -2 },
    { keyword: "beginner yoga Calgary", position: 2, change: 0 },
  ],
  social_followers: [
    { platform: "Instagram", followers: 14200, change: 312 },
    { platform: "Facebook", followers: 8900, change: 88 },
    { platform: "TikTok", followers: 6400, change: 540 },
    { platform: "YouTube", followers: 3200, change: 120 },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-green-100 text-green-700", DRAFT: "bg-gray-100 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-700", PAUSED: "bg-yellow-100 text-yellow-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
};

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border shadow-sm ${accent ? "bg-indigo-600 text-white border-indigo-500" : "bg-white text-gray-900 border-gray-100"}`}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${accent ? "text-indigo-200" : "text-gray-400"}`}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className={`text-xs mt-1 ${accent ? "text-indigo-200" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiObjective, setAiObjective] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/marketing", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => { setData(d ?? FALLBACK); setLoading(false); });
  }, []);

  const runAi = async () => {
    if (!aiObjective.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are a marketing strategist. Given the following business objective for a wellness/yoga brand, provide a concrete marketing strategy with channel recommendations, tactics, KPIs, and budget allocation guidance. Objective: ${aiObjective}`,
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
  const budgetPct = d.budget_allocated > 0 ? Math.round((d.budget_spent / d.budget_allocated) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Marketing Command Center</h1>
        <p className="text-gray-500 mb-6">Budget, campaigns, content, SEO, and social — all in one view</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Budget Spent" value={`$${d.budget_spent.toLocaleString()}`} sub={`of $${d.budget_allocated.toLocaleString()} allocated`} />
              <KpiCard label="Campaigns Active" value={d.campaigns_active} />
              <KpiCard label="Leads Generated" value={d.leads_generated} />
              <KpiCard label="MQLs" value={d.mqls} sub="marketing-qualified leads" accent />
              <KpiCard label="Lead-to-MQL Rate" value={`${d.leads_generated > 0 ? Math.round((d.mqls / d.leads_generated) * 100) : 0}%`} />
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Budget Utilization</span>
                <span className="text-gray-900 font-semibold">{budgetPct}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full">
                <div className={`h-3 rounded-full transition-all ${budgetPct > 85 ? "bg-red-500" : budgetPct > 65 ? "bg-amber-400" : "bg-indigo-500"}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }} />
              </div>
            </div>
          </div>
        )}

        {tab === "Campaigns" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Recent Campaigns</h2>
              <Link href="/admin/campaigns" className="text-sm text-indigo-600 hover:underline">Manage All Campaigns →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>{["Campaign", "Status", "Spend", "Leads Generated"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(d.recent_campaigns ?? []).map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>{c.status}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.spend > 0 ? `$${c.spend.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.leads > 0 ? c.leads : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Content" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Recent Content</h2>
              <Link href="/admin/content-library" className="text-sm text-indigo-600 hover:underline">Content Library →</Link>
            </div>
            <div className="space-y-3">
              {(d.recent_content ?? []).map((c, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full whitespace-nowrap">{c.type}</span>
                  <p className="flex-1 text-sm font-medium text-gray-800">{c.title}</p>
                  <p className="text-xs text-gray-400">{c.published_at}</p>
                  <p className="text-sm font-medium text-gray-700 w-20 text-right">{c.views.toLocaleString()} views</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "SEO" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Top Keyword Rankings</h2>
              <Link href="/admin/seo-checker" className="text-sm text-indigo-600 hover:underline">Full SEO Dashboard →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>{["Keyword", "Position", "Change"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(d.keyword_rankings ?? []).map((k, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">{k.keyword}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${k.position <= 3 ? "text-green-600" : k.position <= 10 ? "text-blue-600" : "text-gray-600"}`}>
                          #{k.position}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${k.change > 0 ? "text-green-600" : k.change < 0 ? "text-red-500" : "text-gray-400"}`}>
                          {k.change > 0 ? `↑${k.change}` : k.change < 0 ? `↓${Math.abs(k.change)}` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Social" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Social Media Followers</h2>
              <Link href="/admin/social" className="text-sm text-indigo-600 hover:underline">Social Management →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(d.social_followers ?? []).map((s, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-2">{s.platform}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.followers.toLocaleString()}</p>
                  <p className={`text-xs mt-1 font-medium ${s.change > 0 ? "text-green-600" : s.change < 0 ? "text-red-500" : "text-gray-400"}`}>
                    {s.change > 0 ? `+${s.change}` : s.change} this month
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "AI Strategy" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">AI Marketing Strategy</h2>
            <p className="text-sm text-gray-500 mb-4">Describe your marketing objective and get AI-powered strategy recommendations with channel mix, tactics, and KPIs.</p>
            <label className="block text-sm text-gray-600 mb-2">Marketing Objective</label>
            <textarea value={aiObjective} onChange={e => setAiObjective(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none mb-3"
              placeholder="e.g. Increase new student sign-ups by 30% in Q4 with a $5,000 budget. Target audience: women aged 25-45 in Calgary." />
            <button onClick={runAi} disabled={aiLoading || !aiObjective.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? "Generating Strategy…" : "Generate Marketing Strategy"}
            </button>
            {aiResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500 font-medium">AI Strategy Recommendation</p>
                  <button onClick={() => navigator.clipboard.writeText(aiResult)} className="text-xs text-indigo-600 hover:underline">Copy</button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResult}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
