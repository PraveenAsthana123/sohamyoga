'use client';
import { useEffect, useState } from 'react';
import AdTypesLibrary from '@/components/ads/AdTypesLibrary';

type Tab =
  | 'overview' | 'campaigns' | 'adgroups' | 'keywords'
  | 'creatives' | 'ad-types' | 'report' | 'dashboard' | 'manual' | 'pipeline' | 'agentic' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'campaigns',    label: 'Campaigns'    },
  { id: 'adgroups',     label: 'Ad Groups'    },
  { id: 'keywords',     label: 'Keywords'     },
  { id: 'creatives',    label: 'Creatives'    },
  { id: 'ad-types',     label: 'Ad Types'     },
  { id: 'report',       label: 'Report'       },
  { id: 'dashboard',    label: 'Dashboard'    },
  { id: 'manual',       label: 'Manual'       },
  { id: 'pipeline',     label: 'Pipeline'     },
  { id: 'agentic',      label: 'Agentic'      },
  { id: 'integrations', label: 'Integrations' },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
      {message}
    </div>
  );
}

function DemoBanner({ message }: { message: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
      <span className="font-semibold">Demo Data</span> — {message}
    </div>
  );
}

function NotConfiguredBanner() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
      <p className="font-semibold mb-1">Google Ads Not Configured</p>
      <p>Set the following environment variables to enable live data:</p>
      <ul className="list-disc ml-4 mt-1 space-y-0.5 font-mono text-xs">
        <li>GOOGLE_ADS_DEVELOPER_TOKEN</li>
        <li>GOOGLE_ADS_CLIENT_ID</li>
        <li>GOOGLE_ADS_CLIENT_SECRET</li>
        <li>GOOGLE_ADS_CUSTOMER_ID</li>
        <li>GOOGLE_ADS_REFRESH_TOKEN</li>
      </ul>
    </div>
  );
}

interface Campaign {
  id: string; name: string; status: string; type: string;
  budget: number; impressions: number; clicks: number;
  ctr: number; cpc: number; conversions: number; spend: number; startDate: string;
}

interface Keyword {
  keyword: string; matchType: string; avgCpc: number; competition: string; qualityScore: number;
}

interface ReportSummary {
  spend: number; impressions: number; clicks: number;
  ctr: number; cpc: number; conversions: number; roas: number;
}

interface ReportCampaign {
  id: string; name: string; spend: number; impressions: number; clicks: number; conversions: number; roas: number;
}

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  paused:  'bg-amber-100 text-amber-700',
  draft:   'bg-gray-100 text-gray-600',
  removed: 'bg-red-100 text-red-600',
};

const COMPETITION_BADGE: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-green-100 text-green-700',
};

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ configured }: { configured: boolean }) {
  return (
    <div className="space-y-5">
      {!configured && <NotConfiguredBanner />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Ad Platform', value: 'Google Ads', note: 'Search, Display, Video, Shopping', color: 'text-blue-600' },
          { label: 'Bidding Strategies', value: '5', note: 'Manual CPC, Target CPA/ROAS, Max Clicks/Conv', color: 'text-purple-600' },
          { label: 'API Version', value: 'v17', note: 'Google Ads API (REST)', color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-1">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Architecture — Google Ads Integration</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-center">
          {[
            { label: 'Google Ads UI', sub: 'This admin portal', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Google Ads API', sub: 'REST v17 via OAuth2', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            { label: 'Campaign Sync', sub: 'GoogleAdsSyncJob (4h)', color: 'bg-purple-50 border-purple-200 text-purple-800' },
            { label: 'GA4 Tracking', sub: 'Conversion import', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: 'Ollama AI', sub: 'Keyword + copy assist', color: 'bg-rose-50 border-rose-200 text-rose-800' },
          ].map((n, i) => (
            <div key={n.label} className="flex flex-col items-center gap-1">
              <div className={`w-full border rounded-xl p-3 ${n.color}`}>
                <p className="font-semibold text-xs">{n.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
              </div>
              {i < 4 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Campaign Types Supported</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { type: 'Search', desc: 'Text ads on Google Search results', icon: '🔍' },
            { type: 'Display', desc: 'Banner ads on Google Display Network', icon: '🖼️' },
            { type: 'Video', desc: 'YouTube in-stream and discovery ads', icon: '▶️' },
            { type: 'Shopping', desc: 'Product listings for e-commerce', icon: '🛒' },
          ].map(c => (
            <div key={c.type} className="border border-gray-100 rounded-xl p-4 text-sm">
              <p className="text-lg mb-1">{c.icon}</p>
              <p className="font-semibold text-gray-900">{c.type}</p>
              <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Campaigns Tab ─────────────────────────────────────────────────────────────
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [demo, setDemo] = useState(false);
  const [demoMsg, setDemoMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ demo: boolean; message: string; campaigns: Campaign[] }>('/api/admin/google-ads/campaigns')
      .then(d => {
        setDemo(d?.demo ?? false);
        setDemoMsg(d?.message ?? '');
        setCampaigns(d?.campaigns ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      {demo && <DemoBanner message={demoMsg} />}
      {loading ? <EmptyState message="Loading…" /> : campaigns.length === 0 ? (
        <EmptyState message="No Google Ads campaigns found. Configure credentials to sync real campaigns." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Name', 'Type', 'Status', 'Budget/day', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Conversions', 'Spend'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">${c.budget}/day</td>
                  <td className="px-4 py-3">{c.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3">{c.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3">{c.ctr}%</td>
                  <td className="px-4 py-3">${c.cpc}</td>
                  <td className="px-4 py-3">{c.conversions}</td>
                  <td className="px-4 py-3">${c.spend.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ad Groups Tab ─────────────────────────────────────────────────────────────
function AdGroupsTab() {
  const DEMO_GROUPS = [
    { id: 'dg-001', name: 'Brand Terms', campaign: 'Brand Awareness — Yoga', status: 'active', keywords: 8, ads: 3, bid: 1.50, ctr: 4.2 },
    { id: 'dg-002', name: 'Competitor Terms', campaign: 'Brand Awareness — Yoga', status: 'active', keywords: 5, ads: 2, bid: 2.10, ctr: 1.8 },
    { id: 'dg-003', name: 'Generic Yoga', campaign: 'Class Sign-up — Search', status: 'active', keywords: 12, ads: 4, bid: 1.20, ctr: 2.9 },
    { id: 'dg-004', name: 'Site Visitors', campaign: 'Retargeting — Visitors', status: 'active', keywords: 0, ads: 2, bid: 0.80, ctr: 0.9 },
  ];

  return (
    <div className="space-y-4">
      <DemoBanner message="Google Ads API not configured — showing representative ad group structure." />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['Ad Group', 'Campaign', 'Status', 'Keywords', 'Ads', 'Default Bid', 'CTR'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {DEMO_GROUPS.map(g => (
              <tr key={g.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{g.campaign}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status]}`}>{g.status}</span>
                </td>
                <td className="px-4 py-3">{g.keywords}</td>
                <td className="px-4 py-3">{g.ads}</td>
                <td className="px-4 py-3">${g.bid}</td>
                <td className="px-4 py-3">{g.ctr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Keywords Tab ──────────────────────────────────────────────────────────────
function KeywordsTab() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seedInput, setSeedInput] = useState('yoga');

  const load = (seed: string) => {
    setLoading(true);
    fetchJson<{ demo: boolean; keywords: Keyword[] }>(`/api/admin/google-ads/keywords?seed=${encodeURIComponent(seed)}`)
      .then(d => { setDemo(d?.demo ?? true); setKeywords(d?.keywords ?? []); setLoading(false); });
  };

  useEffect(() => { load('yoga'); }, []);

  return (
    <div className="space-y-4">
      {demo && <DemoBanner message="Showing representative keyword planner data. Connect Google Ads for real search volume and competition data." />}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3">
        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
          placeholder="Seed keyword (e.g. yoga, wellness)"
          value={seedInput}
          onChange={e => setSeedInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(seedInput)}
        />
        <button onClick={() => load(seedInput)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium">
          Get Suggestions
        </button>
      </div>
      {loading ? <EmptyState message="Loading…" /> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Keyword', 'Match Type', 'Avg CPC', 'Competition', 'Quality Score'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {keywords.map(k => (
                <tr key={k.keyword} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.keyword}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{k.matchType}</span>
                  </td>
                  <td className="px-4 py-3">${k.avgCpc.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPETITION_BADGE[k.competition] ?? 'bg-gray-100 text-gray-600'}`}>
                      {k.competition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(k.qualityScore / 10) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{k.qualityScore}/10</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Creatives Tab ─────────────────────────────────────────────────────────────
function CreativesTab() {
  const DEMO_ADS = [
    { id: 'da-001', name: 'RSA — Brand Awareness', type: 'Responsive Search', headlines: 3, descriptions: 2, status: 'active' },
    { id: 'da-002', name: 'ETA — Class Promo', type: 'Expanded Text', headlines: 2, descriptions: 1, status: 'active' },
    { id: 'da-003', name: 'Display — Banner 728x90', type: 'Display', headlines: 1, descriptions: 1, status: 'paused' },
  ];

  return (
    <div className="space-y-4">
      <DemoBanner message="Creatives shown are representative. Connect Google Ads to manage real ad copy." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEMO_ADS.map(ad => (
          <div key={ad.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{ad.name}</p>
                <p className="text-xs text-blue-600 mt-0.5">{ad.type}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Headlines</p><p className="font-semibold">{ad.headlines}</p></div>
              <div><p className="text-xs text-gray-500">Descriptions</p><p className="font-semibold">{ad.descriptions}</p></div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Use the <strong>Agentic</strong> tab to generate ad copy with Ollama, then review and activate it here.
      </div>
    </div>
  );
}

// ── Report Tab ────────────────────────────────────────────────────────────────
function ReportTab() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [byCampaign, setByCampaign] = useState<ReportCampaign[]>([]);
  const [demo, setDemo] = useState(false);
  const [demoMsg, setDemoMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (d: number) => {
    setLoading(true);
    fetchJson<{ demo: boolean; message: string; summary: ReportSummary; byCampaign: ReportCampaign[] }>(
      `/api/admin/google-ads/report?days=${d}`
    ).then(res => {
      setDemo(res?.demo ?? false);
      setDemoMsg(res?.message ?? '');
      setSummary(res?.summary ?? null);
      setByCampaign(res?.byCampaign ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(days); }, [days]);

  return (
    <div className="space-y-4">
      {demo && <DemoBanner message={demoMsg} />}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3 items-center">
        <span className="text-sm text-gray-600">Period:</span>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${days === d ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Last {d}d
          </button>
        ))}
        <button onClick={() => {
          const csv = [
            ['Campaign', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'ROAS'],
            ...(byCampaign.map(c => [c.name, c.spend, c.impressions, c.clicks, c.conversions, c.roas])),
          ].map(r => r.join(',')).join('\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = `google-ads-report-${days}d.csv`;
          a.click();
        }} className="ml-auto px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
          Export CSV
        </button>
      </div>

      {loading ? <EmptyState message="Loading…" /> : !summary ? <EmptyState message="No report data." /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Spend', value: `$${summary.spend.toFixed(2)}`, color: 'text-red-600' },
              { label: 'Impressions', value: summary.impressions.toLocaleString(), color: 'text-blue-600' },
              { label: 'Clicks', value: summary.clicks.toLocaleString(), color: 'text-green-600' },
              { label: 'CTR', value: `${summary.ctr}%`, color: 'text-purple-600' },
              { label: 'CPC', value: `$${summary.cpc}`, color: 'text-amber-600' },
              { label: 'Conversions', value: String(summary.conversions), color: 'text-teal-600' },
              { label: 'ROAS', value: `${summary.roas}x`, color: 'text-indigo-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Performance by Campaign</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Campaign', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'ROAS'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byCampaign.map(c => (
                  <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">${c.spend.toFixed(2)}</td>
                    <td className="px-4 py-3">{c.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.conversions}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${c.roas >= 2 ? 'text-green-600' : c.roas >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                        {c.roas}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<{ demo: boolean; campaigns: Campaign[] }>('/api/admin/google-ads/campaigns'),
      fetchJson<{ demo: boolean; summary: ReportSummary }>('/api/admin/google-ads/report?days=30'),
    ]).then(([cData, rData]) => {
      setDemo(cData?.demo ?? false);
      setCampaigns(cData?.campaigns ?? []);
      setSummary(rData?.summary ?? null);
      setLoading(false);
    });
  }, []);

  const totalBudget = campaigns.reduce((a, c) => a + c.budget, 0);

  return (
    <div className="space-y-5">
      {demo && <DemoBanner message="Demo dashboard — configure Google Ads credentials for live KPIs." />}
      {loading ? <EmptyState message="Loading…" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Active Campaigns', value: String(campaigns.filter(c => c.status === 'active').length), color: 'text-blue-600' },
              { label: 'Total Budget/day', value: `$${totalBudget}`, color: 'text-amber-600' },
              { label: 'Spend (30d)', value: summary ? `$${summary.spend.toFixed(0)}` : '—', color: 'text-red-600' },
              { label: 'Clicks (30d)', value: summary ? summary.clicks.toLocaleString() : '—', color: 'text-green-600' },
              { label: 'CTR', value: summary ? `${summary.ctr}%` : '—', color: 'text-purple-600' },
              { label: 'ROAS', value: summary ? `${summary.roas}x` : '—', color: 'text-indigo-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Campaign Spend vs. Budget (30d)</h3>
            {campaigns.length === 0 ? <EmptyState message="No campaigns." /> : (
              <div className="space-y-3">
                {campaigns.map(c => {
                  const spendPct = Math.min((c.spend / (c.budget * 30)) * 100, 100);
                  return (
                    <div key={c.id} className="flex items-center gap-3 text-sm">
                      <span className="w-48 text-gray-700 truncate">{c.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${spendPct > 90 ? 'bg-red-400' : spendPct > 70 ? 'bg-amber-400' : 'bg-blue-400'}`}
                          style={{ width: `${spendPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-20 text-right">${c.spend.toFixed(0)} / ${c.budget * 30}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Campaign Health Snapshot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div><p className="text-gray-400">CTR</p><p className="font-semibold text-gray-700">{c.ctr}%</p></div>
                    <div><p className="text-gray-400">CPC</p><p className="font-semibold text-gray-700">${c.cpc}</p></div>
                    <div><p className="text-gray-400">Conv</p><p className="font-semibold text-gray-700">{c.conversions}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Manual Tab ────────────────────────────────────────────────────────────────
function ManualTab() {
  const steps = [
    {
      step: 1, title: 'Connect Google Ads Account',
      desc: 'Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_CUSTOMER_ID in your .env file. Obtain a refresh token via the OAuth2 flow at https://developers.google.com/google-ads/api/docs/oauth/overview.',
    },
    {
      step: 2, title: 'Create a Campaign',
      desc: 'Go to the Campaigns tab, click "+ New Campaign". Select campaign type (Search recommended for service businesses), set daily budget, choose start date.',
    },
    {
      step: 3, title: 'Add Ad Groups',
      desc: 'Each campaign needs at least one ad group. Ad groups organize keywords and ads by theme (e.g. "Brand Terms", "Service Keywords"). Create via Ad Groups tab.',
    },
    {
      step: 4, title: 'Add Keywords',
      desc: 'Use the Keywords tab to get suggestions from the Keyword Planner. Add high-intent keywords with appropriate match types. Always include negative keywords to exclude irrelevant searches.',
    },
    {
      step: 5, title: 'Create Ad Creatives',
      desc: 'Go to Creatives tab or use the Agentic tab to generate RSA headlines/descriptions with Ollama. Google recommends 5+ headlines and 2-4 descriptions per Responsive Search Ad.',
    },
    {
      step: 6, title: 'Set Up Conversion Tracking',
      desc: 'Go to Integrations tab. Link Google Ads to GA4 to track conversion actions (form submissions, bookings). Configure conversion import in the Google Ads account.',
    },
    {
      step: 7, title: 'Review & Launch',
      desc: 'Verify campaign settings, keyword bids, and ad copy. Set campaign status to "active". Monitor the Dashboard tab for the first 48–72 hours to check CTR and Quality Scores.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Step-by-Step: Set Up Google Ads</h3>
        <p className="text-sm text-gray-500 mb-5">Follow these steps in order. Each step links to the relevant tab in this portal.</p>
        <div className="space-y-4">
          {steps.map(s => (
            <div key={s.step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Bidding Strategy Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'Manual CPC', when: 'New campaigns — full control over bids', note: 'Start here, adjust after 2 weeks of data' },
            { name: 'Target CPA', when: 'Have 30+ conversions/month', note: 'Set target cost per acquisition' },
            { name: 'Target ROAS', when: 'E-commerce with revenue tracking', note: 'Set target return on ad spend (e.g. 400%)' },
            { name: 'Maximize Clicks', when: 'Brand awareness, fixed budget', note: 'Google maximizes click volume within budget' },
            { name: 'Maximize Conversions', when: 'Have conversion tracking set up', note: 'Best for lead gen with flexible budget' },
          ].map(b => (
            <div key={b.name} className="border border-gray-100 rounded-xl p-4">
              <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
              <p className="text-xs text-gray-500 mt-1"><span className="font-medium text-gray-700">When:</span> {b.when}</p>
              <p className="text-xs text-gray-400 mt-0.5">{b.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────
function PipelineTab() {
  const [jobs] = useState([
    { name: 'GoogleAdsSyncJob', schedule: '0 */4 * * *', desc: 'Sync campaign metrics from Google Ads API every 4 hours', status: 'active', last: 'Heartbeat: 0 campaigns' },
    { name: 'AutoKeywordBidJob', schedule: '0 */12 * * *', desc: 'Review keyword Quality Scores and adjust CPC bids automatically', status: 'not_built', last: 'Not yet implemented' },
    { name: 'BudgetPacingJob', schedule: '0 * * * *', desc: 'Check daily spend pace and pause campaigns over budget', status: 'planned', last: 'Planned — no code yet' },
    { name: 'PerformanceAlertJob', schedule: '*/30 * * * *', desc: 'Alert on CTR drops >50% or CPC increases >200% vs 7d average', status: 'planned', last: 'Planned — no code yet' },
  ]);

  const statusColor: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    not_built: 'bg-gray-100 text-gray-500',
    planned:   'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Automation Jobs</h3>
        <div className="space-y-3">
          {jobs.map(j => (
            <div key={j.name} className="flex items-start justify-between gap-4 border border-gray-100 rounded-xl p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-800">{j.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[j.status]}`}>{j.status}</span>
                </div>
                <p className="text-sm text-gray-600">{j.desc}</p>
                <p className="text-xs text-gray-400 mt-1">Schedule: <code className="bg-gray-50 px-1 rounded">{j.schedule}</code></p>
                <p className="text-xs text-gray-400">Last run: {j.last}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Pipeline Status</p>
        <p>GoogleAdsSyncJob is registered and runs on schedule. AutoKeywordBidJob and budget pacing require Google Ads API credentials and conversion tracking before implementation.</p>
      </div>
    </div>
  );
}

// ── Agentic Tab ───────────────────────────────────────────────────────────────
function AgenticTab() {
  const [copyPrompt, setCopyPrompt] = useState('');
  const [copyResults, setCopyResults] = useState<{ headline: string; description: string }[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');

  const [kwSeed, setKwSeed] = useState('');
  const [kwResults, setKwResults] = useState<Keyword[]>([]);
  const [kwLoading, setKwLoading] = useState(false);

  const [bidPrompt, setBidPrompt] = useState('');
  const [bidResult, setBidResult] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  async function generateCopy() {
    setCopyLoading(true);
    setCopyError('');
    setCopyResults([]);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `You are a Google Ads copywriter. Generate 3 responsive search ad variants for this brief: "${copyPrompt}".
Each variant must have: headline (max 30 chars), description (max 90 chars).
Return JSON array: [{"headline": "...", "description": "..."}, ...]`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCopyError(data.error ?? 'Generation failed'); return; }
      const raw = data.text ?? data.content ?? '';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        setCopyResults(JSON.parse(jsonMatch[0]));
      } else {
        setCopyError('Could not parse variants from Ollama response.');
      }
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Failed to reach Ollama');
    } finally {
      setCopyLoading(false);
    }
  }

  async function suggestKeywords() {
    setKwLoading(true);
    const data = await fetchJson<{ keywords: Keyword[] }>(`/api/admin/google-ads/keywords?seed=${encodeURIComponent(kwSeed)}`);
    setKwResults(data?.keywords ?? []);
    setKwLoading(false);
  }

  async function getBidRecommendation() {
    setBidLoading(true);
    setBidResult('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `You are a Google Ads bid optimization expert. Based on this context: "${bidPrompt}", provide a concise bid optimization recommendation (3-5 sentences). Be specific about bidding strategy, target CPA/ROAS, and when to switch strategies.`,
        }),
      });
      const data = await res.json();
      setBidResult(data.text ?? data.content ?? 'No recommendation generated.');
    } catch (e) {
      setBidResult(e instanceof Error ? e.message : 'Failed to reach Ollama');
    } finally {
      setBidLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        All AI features use local Ollama (llama3.2). No data is sent to external AI services. AI-generated content must be reviewed before activation.
      </div>

      {/* Ad Copy Generation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">AI Ad Copy Generation</h3>
        <p className="text-sm text-gray-500 mb-4">Generate RSA headline and description variants from a campaign brief.</p>
        <div className="space-y-3">
          <textarea
            value={copyPrompt}
            onChange={e => setCopyPrompt(e.target.value)}
            rows={3}
            placeholder="Campaign brief, e.g. 'Promote beginner yoga classes for adults aged 30-50. Focus on stress relief and flexibility. Classes start at $25/session in downtown Vancouver.'"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={generateCopy} disabled={copyLoading || !copyPrompt.trim()}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50">
            {copyLoading ? 'Generating…' : 'Generate 3 Variants'}
          </button>
          {copyError && <p className="text-sm text-red-600">{copyError}</p>}
          {copyResults.length > 0 && (
            <div className="space-y-2">
              {copyResults.map((v, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <p className="font-semibold text-gray-900 text-sm">{v.headline}</p>
                  <p className="text-sm text-gray-500 mt-1">{v.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keyword Suggestions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">AI Keyword Suggestions</h3>
        <p className="text-sm text-gray-500 mb-4">Get keyword ideas for your campaign based on a seed term.</p>
        <div className="flex gap-3">
          <input
            value={kwSeed}
            onChange={e => setKwSeed(e.target.value)}
            placeholder="Seed keyword, e.g. yoga classes"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={suggestKeywords} disabled={kwLoading || !kwSeed.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
            {kwLoading ? 'Loading…' : 'Get Keywords'}
          </button>
        </div>
        {kwResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {kwResults.map(k => (
              <div key={k.keyword} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 text-sm">
                <span className="font-medium text-gray-900">{k.keyword}</span>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{k.matchType}</span>
                  <span>${k.avgCpc}/click</span>
                  <span className={`px-1.5 py-0.5 rounded ${COMPETITION_BADGE[k.competition]}`}>{k.competition}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bid Optimization */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">AI Bid Optimization Advice</h3>
        <p className="text-sm text-gray-500 mb-4">Describe your current campaign performance and get a bidding strategy recommendation.</p>
        <div className="space-y-3">
          <textarea
            value={bidPrompt}
            onChange={e => setBidPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. 'I have 3 active search campaigns with avg CTR 2.5%, CPC $1.80, 15 conversions/month at $60 CPA. Budget is $150/day. Currently on Manual CPC.'"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={getBidRecommendation} disabled={bidLoading || !bidPrompt.trim()}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50">
            {bidLoading ? 'Analyzing…' : 'Get Recommendation'}
          </button>
          {bidResult && (
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-sm text-gray-700">
              {bidResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────────
function IntegrationsTab({ configured }: { configured: boolean }) {
  return (
    <div className="space-y-5">
      {!configured && <NotConfiguredBanner />}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Google Ads → GA4 → Conversion Tracking Chain</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-center">
          {[
            { label: 'Google Ads', sub: 'Click tracking (auto-tagging gclid)', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Landing Page', sub: 'gclid stored in session', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            { label: 'GA4', sub: 'Conversion event fired', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: 'Ads Import', sub: 'Conversions imported back to Google Ads', color: 'bg-purple-50 border-purple-200 text-purple-800' },
          ].map((n, i) => (
            <div key={n.label} className="flex flex-col items-center gap-1">
              <div className={`w-full border rounded-xl p-3 ${n.color}`}>
                <p className="font-semibold text-xs">{n.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
              </div>
              {i < 3 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Required Credentials</h3>
          <div className="space-y-2 text-sm">
            {[
              { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', status: configured ? 'set' : 'missing', note: 'Required for all API calls' },
              { key: 'GOOGLE_ADS_CLIENT_ID', status: configured ? 'set' : 'missing', note: 'OAuth2 client ID' },
              { key: 'GOOGLE_ADS_CLIENT_SECRET', status: configured ? 'set' : 'missing', note: 'OAuth2 client secret' },
              { key: 'GOOGLE_ADS_CUSTOMER_ID', status: configured ? 'set' : 'missing', note: 'Your 10-digit account ID (no dashes)' },
              { key: 'GOOGLE_ADS_REFRESH_TOKEN', status: configured ? 'set' : 'missing', note: 'Long-lived OAuth2 refresh token' },
            ].map(c => (
              <div key={c.key} className="flex items-start gap-3">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${c.status === 'set' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {c.status}
                </span>
                <div>
                  <span className="font-mono text-xs text-gray-800">{c.key}</span>
                  <p className="text-xs text-gray-400">{c.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Connected Services</h3>
          <div className="space-y-3 text-sm">
            {[
              { service: 'Google Ads API v17', status: configured ? 'connected' : 'not connected', note: 'Campaign management' },
              { service: 'GA4 Measurement Protocol', status: 'requires setup', note: 'Conversion tracking' },
              { service: 'Ollama (llama3.2)', status: 'local', note: 'Keyword/copy AI assist' },
              { service: 'PostgreSQL', status: 'connected', note: 'Local campaign storage' },
            ].map(s => (
              <div key={s.service} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-gray-900">{s.service}</p>
                  <p className="text-xs text-gray-400">{s.note}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  s.status === 'connected' || s.status === 'local' ? 'bg-green-100 text-green-700' :
                  s.status === 'not connected' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-700'
                }`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GoogleAdsAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const configured = !!(typeof window !== 'undefined' && false); // client-side: always false; real check is server-side

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Google Ads</h1>
            <p className="text-sm text-gray-500 mt-1">
              Search · Display · Video · Shopping · Keyword Planner · Ollama AI
            </p>
          </div>
          <a
            href="https://ads.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Open Google Ads Console
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview'     && <OverviewTab configured={configured} />}
        {activeTab === 'campaigns'    && <CampaignsTab />}
        {activeTab === 'adgroups'     && <AdGroupsTab />}
        {activeTab === 'keywords'     && <KeywordsTab />}
        {activeTab === 'creatives'    && <CreativesTab />}
        {activeTab === 'ad-types'     && <AdTypesLibrary />}
        {activeTab === 'report'       && <ReportTab />}
        {activeTab === 'dashboard'    && <DashboardTab />}
        {activeTab === 'manual'       && <ManualTab />}
        {activeTab === 'pipeline'     && <PipelineTab />}
        {activeTab === 'agentic'      && <AgenticTab />}
        {activeTab === 'integrations' && <IntegrationsTab configured={configured} />}

      </div>
    </div>
  );
}
