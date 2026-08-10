'use client';
import { useEffect, useState } from 'react';

type Tab = 'overview' | 'campaigns' | 'adgroups' | 'creatives' | 'health' | 'analytics' | 'ai' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'campaigns',     label: 'Campaigns'     },
  { id: 'adgroups',      label: 'Ad Groups'     },
  { id: 'creatives',     label: 'Creatives'     },
  { id: 'health',        label: 'Health'        },
  { id: 'analytics',     label: 'Analytics'     },
  { id: 'ai',            label: 'AI Engine'     },
  { id: 'integrations',  label: 'Integrations'  },
];

interface DashboardData {
  kpis: { activeCampaigns: number; totalSpend: number; totalImpressions: number; totalClicks: number; conversions: number; avgCtrPct: number; avgCpc: number };
  spendByType: { type: string; spend: number; pct: number }[];
}
interface CampaignRow { id: string; name: string; type: string; status: string; budget: number; impressions: number; clicks: number; ctr: number; cpc: number }
interface AdGroupRow { id: string; name: string; campaign: string; status: string; keywords: number; ads: number; bid: number; ctr: number }
interface CreativeRow { id: string; name: string; type: string; status: string; ai: boolean; impressions: number; clicks: number; ctr: number; cpc: number }
interface HealthFinding {
  id: string; campaignId: string; campaignName: string; findingKey: string; severity: string;
  summary: string; recommendedAction: string; status: string; createdAt: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  info:     'bg-blue-100 text-blue-700',
};

function HealthTab() {
  const [findings, setFindings] = useState<HealthFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = () => {
    setLoading(true);
    fetchJson<{ findings: HealthFinding[] }>(`/api/ads/health-findings?status=${showResolved ? 'all' : 'open'}`)
      .then(d => { setFindings(d?.findings ?? []); setLoading(false); });
  };
  useEffect(load, [showResolved]);

  async function decide(id: string, action: 'acknowledge' | 'resolve') {
    await fetch(`/api/ads/health-findings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Automated config audit (runs hourly) — structural problems only, no fabricated performance data.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
          Show acknowledged/resolved
        </label>
      </div>

      {loading ? <EmptyState message="Loading…" /> : findings.length === 0 ? (
        <EmptyState message="No open health findings — every active campaign passed the structural audit." />
      ) : (
        <div className="space-y-3">
          {findings.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[f.severity] ?? 'bg-gray-100 text-gray-600'}`}>{f.severity}</span>
                    <span className="text-xs text-gray-400 font-mono">{f.findingKey}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500 font-medium">{f.campaignName}</span>
                    {f.status !== 'open' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.status}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{f.summary}</p>
                  <p className="text-xs text-gray-500 mt-1">→ {f.recommendedAction}</p>
                </div>
                {f.status === 'open' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(f.id, 'acknowledge')} className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">Acknowledge</button>
                    <button onClick={() => decide(f.id, 'resolve')} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

const STATUS_BADGE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  paused:       'bg-amber-100 text-amber-700',
  draft:        'bg-gray-100 text-gray-600',
  archived:     'bg-gray-100 text-gray-500',
  ended:        'bg-red-100 text-red-600',
  removed:      'bg-red-100 text-red-600',
  under_review: 'bg-blue-100 text-blue-700',
};

const TYPE_BADGE: Record<string, string> = {
  search:           'bg-blue-50 text-blue-700',
  display:          'bg-purple-50 text-purple-700',
  video:            'bg-rose-50 text-rose-700',
  shopping:         'bg-amber-50 text-amber-700',
  app:              'bg-teal-50 text-teal-700',
  responsive_search:'bg-blue-50 text-blue-700',
  banner:           'bg-purple-50 text-purple-700',
  image:            'bg-green-50 text-green-700',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdsAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [statusFilter, setStatusFilter] = useState('all');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroupRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<DashboardData>('/api/ads/dashboard'),
      fetchJson<{ adGroups: AdGroupRow[] }>('/api/ads/adgroups'),
      fetchJson<{ creatives: CreativeRow[] }>('/api/ads/creatives'),
    ]).then(([dash, groups, cre]) => {
      setDashboard(dash);
      setAdGroups(groups?.adGroups ?? []);
      setCreatives(cre?.creatives ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    fetchJson<{ campaigns: CampaignRow[] }>(`/api/ads/campaigns${qs}`).then(d => setCampaigns(d?.campaigns ?? []));
  }, [statusFilter]);

  const filteredCampaigns = campaigns;
  const kpis = dashboard?.kpis;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ads Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Wave 15 · Revive Adserver · Prebid.js · PostHog · Ollama · ComfyUI · GrowthBook
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
              + New Campaign
            </button>
            <button className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
              AI Generate Ad
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { label: 'Active Campaigns',  value: String(kpis?.activeCampaigns ?? 0), color: 'text-amber-600' },
                { label: 'Total Spend',       value: `₹${(kpis?.totalSpend ?? 0).toLocaleString()}`, color: 'text-red-600' },
                { label: 'Total Impressions', value: (kpis?.totalImpressions ?? 0).toLocaleString(), color: 'text-blue-600' },
                { label: 'Total Clicks',      value: (kpis?.totalClicks ?? 0).toLocaleString(), sub: `Avg CTR ${kpis?.avgCtrPct ?? 0}%`, color: 'text-green-600' },
                { label: 'Conversions',       value: (kpis?.conversions ?? 0).toLocaleString(), color: 'text-purple-600' },
                { label: 'Avg CPC',           value: `₹${kpis?.avgCpc ?? 0}`, color: 'text-indigo-600' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
                </div>
              ))}
            </div>

            {/* Architecture flow */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Architecture — Ads Flow</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm text-center">
                {[
                  { label: 'Campaign Manager', sub: 'Next.js admin', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                  { label: 'Ad Server',         sub: 'Revive Adserver', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { label: 'Header Bidding',    sub: 'Prebid.js + Prebid Server', color: 'bg-purple-50 border-purple-200 text-purple-800' },
                  { label: 'AI Generation',     sub: 'Ollama + ComfyUI', color: 'bg-green-50 border-green-200 text-green-800' },
                  { label: 'Analytics',         sub: 'PostHog', color: 'bg-rose-50 border-rose-200 text-rose-800' },
                  { label: 'A/B Testing',       sub: 'GrowthBook', color: 'bg-teal-50 border-teal-200 text-teal-800' },
                ].map((n, i) => (
                  <div key={n.label} className="flex flex-col items-center gap-1">
                    <div className={`w-full border rounded-xl p-3 ${n.color}`}>
                      <p className="font-semibold text-xs">{n.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
                    </div>
                    {i < 5 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Spend by campaign type */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Spend by Campaign Type</h3>
              {!dashboard?.spendByType.length ? <EmptyState message={loading ? 'Loading…' : 'No ad spend recorded yet.'} /> : (
              <div className="space-y-3">
                {dashboard.spendByType.map(s => (
                  <div key={s.type} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-600 capitalize">{s.type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-gray-700 w-20 text-right">₹{s.spend.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}

        {/* ── Campaigns ── */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Statuses</option>
                {['active','paused','draft','archived','ended'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {filteredCampaigns.length === 0 ? <EmptyState message="No campaigns match this filter." /> : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['ID','Name','Type','Status','Budget/day','Impressions','Clicks','CTR','CPC'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCampaigns.map(c => (
                    <tr key={c.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[c.type] ?? 'bg-gray-100 text-gray-600'}`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">₹{c.budget}</td>
                      <td className="px-4 py-3">{c.impressions ? c.impressions.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">{c.clicks ? c.clicks.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">{c.ctr ? `${c.ctr}%` : '—'}</td>
                      <td className="px-4 py-3">{c.cpc ? `₹${c.cpc}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* ── Ad Groups ── */}
        {activeTab === 'adgroups' && (
          adGroups.length === 0 ? <EmptyState message={loading ? 'Loading…' : 'No ad groups yet.'} /> :
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['ID','Ad Group','Campaign','Status','Keywords','Ads','Default Bid','CTR'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adGroups.map(g => (
                  <tr key={g.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{g.campaign}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status] ?? 'bg-gray-100 text-gray-600'}`}>{g.status}</span>
                    </td>
                    <td className="px-4 py-3">{g.keywords}</td>
                    <td className="px-4 py-3">{g.ads}</td>
                    <td className="px-4 py-3">₹{g.bid}</td>
                    <td className="px-4 py-3">{g.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Creatives ── */}
        {activeTab === 'creatives' && (
          creatives.length === 0 ? <EmptyState message={loading ? 'Loading…' : 'No ad creatives yet.'} /> :
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {creatives.map(ad => (
              <div key={ad.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ad.name}</p>
                    <div className="flex gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[ad.type] ?? 'bg-gray-100 text-gray-600'}`}>{ad.type}</span>
                      {ad.ai && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">AI</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">Impressions</p><p className="font-semibold">{ad.impressions ? ad.impressions.toLocaleString() : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Clicks</p><p className="font-semibold">{ad.clicks ? ad.clicks.toLocaleString() : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">CTR</p><p className={`font-semibold ${ad.ctr > 3 ? 'text-green-600' : 'text-gray-700'}`}>{ad.ctr ? `${ad.ctr}%` : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">CPC</p><p className="font-semibold">{ad.cpc ? `₹${ad.cpc}` : '—'}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Health ── */}
        {activeTab === 'health' && <HealthTab />}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Avg CTR',          value: '3.1%',   color: 'text-blue-600'   },
                { label: 'Avg CPC',          value: '₹1.10',  color: 'text-green-600'  },
                { label: 'Avg CPM',          value: '₹34.10', color: 'text-purple-600' },
                { label: 'Avg CPA',          value: '₹32.96', color: 'text-amber-600'  },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Conversion funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Conversion Funnel — Last 30 Days</h3>
              <div className="space-y-2">
                {[
                  { step: 'Impressions',      count: 1240000, pct: 100  },
                  { step: 'Clicks',           count: 38400,   pct: 3.1  },
                  { step: 'Landing page',     count: 30720,   pct: 2.48 },
                  { step: 'Add to cart / book', count: 6860,  pct: 0.55 },
                  { step: 'Converted',        count: 1284,    pct: 0.10 },
                ].map(f => (
                  <div key={f.step} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-40 flex-shrink-0">{f.step}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-amber-400 h-3 rounded-full" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-20 text-right">{f.count.toLocaleString()}</span>
                    <span className="text-gray-400 w-12 text-right text-xs">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Attribution by Channel</h3>
              <div className="space-y-2">
                {[
                  { ch: 'Search',  convs: 820,  pct: 64, revenue: 24600 },
                  { ch: 'Display', convs: 280,  pct: 22, revenue: 7280  },
                  { ch: 'Video',   convs: 184,  pct: 14, revenue: 4800  },
                ].map(a => (
                  <div key={a.ch} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-16">{a.ch}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-green-400 h-3 rounded-full" style={{ width: `${a.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-16 text-right">{a.convs} conv</span>
                    <span className="text-green-600 w-24 text-right font-medium">₹{a.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Engine ── */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { tool: 'Ad Copy Generation',      engine: 'Ollama (llama3)',        desc: 'Generate RSA headlines, descriptions, and CTAs from campaign brief', status: 'active', count: '342 ads generated' },
                { tool: 'Banner Image Generation', engine: 'ComfyUI (SDXL)',          desc: 'Generate display and banner images from text prompts', status: 'active', count: '87 banners generated' },
                { tool: 'Keyword Suggestions',     engine: 'Ollama + search APIs',   desc: 'Suggest long-tail keywords from seed keyword and campaign context', status: 'active', count: '1,240 keywords suggested' },
                { tool: 'Landing Page Optimization',engine: 'Ollama',                 desc: 'Analyse landing page copy and suggest A/B variant headlines', status: 'active', count: '23 page analyses' },
                { tool: 'A/B Testing',             engine: 'GrowthBook',             desc: 'Split-test ad variants, budgets, and landing page CTAs', status: 'active', count: '5 experiments running' },
                { tool: 'Campaign Automation',     engine: 'Activepieces',           desc: 'Workflow triggers: budget alerts, daily reports, pause on low ROAS', status: 'active', count: '12 automations' },
              ].map(t => (
                <div key={t.tool} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{t.tool}</p>
                      <p className="text-xs text-amber-600 font-medium mt-0.5">{t.engine}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{t.status}</span>
                  </div>
                  <p className="text-sm text-gray-500">{t.desc}</p>
                  <p className="text-xs text-gray-400 mt-2">{t.count}</p>
                </div>
              ))}
            </div>

            {/* Safety note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">AI Safety — Ads</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
                <li>All AI-generated ad copy is marked <code className="bg-amber-100 px-1 rounded">ai_generated=true</code> and requires human review before activation</li>
                <li>ComfyUI images must be reviewed for brand compliance and offensive content before publishing</li>
                <li>GrowthBook A/B tests require minimum 100 impressions before declaring winner</li>
                <li>Keyword suggestions are recommendations only — negative keywords must be added manually</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            {/* MCP Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">MCP Tool Registry — 13 Tools</h3>
              <div className="space-y-2">
                {[
                  { name: 'get_campaigns',          tier: 'auto',              desc: 'List all campaigns with status and budget summary' },
                  { name: 'get_campaign_summary',   tier: 'auto',              desc: 'Aggregate CTR, CPC, spend, impressions across active campaigns' },
                  { name: 'get_campaign',           tier: 'staff',             desc: 'Full campaign + ad groups + keywords + targeting' },
                  { name: 'create_campaign',        tier: 'staff',             desc: 'Create campaign with type, budget, targeting, bidding' },
                  { name: 'update_campaign',        tier: 'staff',             desc: 'Update name, budget, status, geo/device targets' },
                  { name: 'pause_campaign',         tier: 'staff',             desc: 'Pause active campaign — all ads stop serving' },
                  { name: 'get_ad_performance',     tier: 'staff',             desc: 'Per-ad CTR, CPC, conversions for a campaign' },
                  { name: 'opt_out_ad_targeting',   tier: 'customer_confirm',  desc: 'Opt out of personalized targeting [OPT_OUT_ADS]' },
                  { name: 'get_audience_data',      tier: 'staff_approval',    desc: 'Access audience segments — PII-adjacent, audit-logged' },
                  { name: 'export_campaign_report', tier: 'staff_approval',    desc: 'Export full campaign performance CSV with attribution data' },
                  { name: 'set_campaign_budget',    tier: 'admin',             desc: 'Override daily or total budget — affects live serving' },
                  { name: 'get_billing_analytics',  tier: 'admin',             desc: 'Total spend, billing history, ROAS across all campaigns' },
                  { name: 'delete_campaign_data',   tier: 'admin_destructive', desc: 'Permanent delete [GDPR] — campaigns, ads, analytics, audiences' },
                ].map(t => {
                  const tierColor: Record<string, string> = {
                    auto:              'bg-gray-100 text-gray-600',
                    staff:             'bg-blue-100 text-blue-700',
                    customer_confirm:  'bg-yellow-100 text-yellow-700',
                    staff_approval:    'bg-orange-100 text-orange-700',
                    admin:             'bg-purple-100 text-purple-700',
                    admin_destructive: 'bg-red-100 text-red-700',
                  };
                  return (
                    <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <code className="text-xs font-mono text-gray-800 w-52 flex-shrink-0">{t.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tierColor[t.tier]}`}>{t.tier}</span>
                      <span className="text-xs text-gray-500">{t.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stack */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Open-Source Stack</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { layer: 'Ad Server',        tool: 'Revive Adserver',  note: 'self-hosted serving' },
                    { layer: 'Header Bidding',   tool: 'Prebid.js',        note: 'browser-side' },
                    { layer: 'Bidding Server',   tool: 'Prebid Server',    note: 'server-side' },
                    { layer: 'AI Copywriting',   tool: 'Ollama (llama3)',  note: 'local LLM' },
                    { layer: 'Image Generation', tool: 'ComfyUI (SDXL)',   note: 'local diffusion' },
                    { layer: 'A/B Testing',      tool: 'GrowthBook',       note: 'experiments' },
                    { layer: 'Email Marketing',  tool: 'Listmonk',         note: 'campaigns' },
                    { layer: 'Social Media',     tool: 'Postiz',           note: '14+ platforms' },
                    { layer: 'Automation',       tool: 'Activepieces',     note: 'budget rules, alerts' },
                    { layer: 'Analytics',        tool: 'PostHog',          note: 'events + funnels' },
                    { layer: 'Dashboard',        tool: 'Grafana',          note: 'ROAS, spend, CTR' },
                  ].map(s => (
                    <div key={s.layer} className="flex items-start gap-2">
                      <span className="text-gray-500 w-32 flex-shrink-0">{s.layer}</span>
                      <span className="font-medium text-gray-800">{s.tool}</span>
                      <span className="text-gray-400">· {s.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">DB Tables</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['ad_campaign','advertisement','ad_group','ad_keyword','ad_analytics','ad_audience','ad_budget_event','ad_audit'].map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">DB Views</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['v_campaign_summary','v_ad_performance','v_daily_roas'].map(v => (
                    <span key={v} className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">Google Ads API Clients</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['PHP','Java','Python','.NET','Ruby'].map(l => (
                    <span key={l} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-medium">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
