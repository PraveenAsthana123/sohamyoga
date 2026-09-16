'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IcpProfile {
  id: string;
  profile_name: string;
  industry: string;
  company_size: string;
  revenue_range: string;
  geography: string;
  job_titles: string[];
  pain_points: string[];
  goals: string[];
  buying_triggers: string[];
  objections: string[];
  channels: string[];
  budget_range: string;
  sales_cycle_days: number;
  is_primary: boolean;
  ai_summary: string;
}

interface AcquisitionChannel {
  id: string;
  channel_name: string;
  status: string;
  monthly_budget_cad: number;
  monthly_spend_cad: number;
  leads_generated_30d: number;
  cost_per_lead: number;
  conversion_rate: number;
  roi: number;
  attribution_model: string;
  notes: string;
}

interface DemandGenCampaign {
  id: string;
  name: string;
  channel: string;
  campaign_type: string;
  target_audience: string;
  budget_cad: number;
  spend_cad: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  ctr: number;
  cpl: number;
  status: string;
}

interface Influencer {
  id: string;
  name: string;
  platform: string;
  handle: string;
  profile_url: string;
  followers: number;
  avg_engagement_rate: number;
  niche: string[];
  location: string;
  email: string;
  status: string;
  rate_per_post_cad: number;
  posts_completed: number;
  total_reach: number;
  total_leads: number;
  notes: string;
}

interface DashboardData {
  kpis: {
    totalLeads: number;
    avgCPL: number;
    bestChannel: string;
    totalSpend: number;
    avgROI: number;
  };
  funnel: {
    impressions: number;
    clicks: number;
    leads: number;
    sqls: number;
    customers: number;
  };
  icpProfiles: IcpProfile[];
  channels: AcquisitionChannel[];
  campaigns: DemandGenCampaign[];
  influencers: Influencer[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ['dashboard', 'icp', 'demand-gen', 'display-retargeting', 'influencers', 'community-geo', 'attribution'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  icp: 'ICP',
  'demand-gen': 'Demand Gen',
  'display-retargeting': 'Display & Retargeting',
  influencers: 'Influencers',
  'community-geo': 'Community & GEO/AEO',
  attribution: 'Attribution & Analytics',
};

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCad(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}
function roiColor(roi: number): string {
  if (roi >= 3) return 'text-green-700 font-semibold';
  if (roi >= 1) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}
function roiBg(roi: number): string {
  if (roi >= 3) return 'bg-green-100 text-green-800';
  if (roi >= 1) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}
function bar(value: number, max: number, width = 20): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
function channelLabel(name: string): string {
  const map: Record<string, string> = {
    seo: 'SEO', google_ads: 'Google Ads', linkedin_ads: 'LinkedIn Ads',
    facebook_ads: 'Facebook/Meta', tiktok_ads: 'TikTok Ads', display: 'Display',
    retargeting: 'Retargeting', influencer: 'Influencer', community: 'Community',
    referral: 'Referral', email: 'Email', cold_outbound: 'Cold Outbound',
    events: 'Events', content: 'Content', geo_aeo: 'GEO/AEO',
  };
  return map[name] ?? name;
}
function platformIcon(p: string): string {
  const icons: Record<string, string> = {
    instagram: '📸', tiktok: '🎵', youtube: '▶️', linkedin: '💼', twitter: '🐦',
  };
  return icons[p] ?? '🌐';
}
function statusBadge(s: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    prospect: 'bg-gray-100 text-gray-600',
    outreach: 'bg-blue-100 text-blue-700',
    negotiating: 'bg-amber-100 text-amber-700',
    completed: 'bg-purple-100 text-purple-700',
    paused: 'bg-orange-100 text-orange-600',
    awareness: 'bg-sky-100 text-sky-700',
    consideration: 'bg-indigo-100 text-indigo-700',
    conversion: 'bg-green-100 text-green-700',
    retargeting: 'bg-amber-100 text-amber-700',
    lookalike: 'bg-purple-100 text-purple-700',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
    red: 'border-l-4 border-red-500 bg-red-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ data }: { data: DashboardData }) {
  const { kpis, funnel, channels } = data;
  const maxImpressions = funnel.impressions;

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Leads (30d)" value={fmt(kpis.totalLeads)} color="blue" />
        <KpiCard label="Avg Cost Per Lead" value={fmtCad(kpis.avgCPL)} color="amber" />
        <KpiCard label="Best Channel" value={channelLabel(kpis.bestChannel)} color="green" />
        <KpiCard label="Total Spend (30d)" value={fmtCad(kpis.totalSpend)} color="purple" />
        <KpiCard label="Avg ROI" value={`${kpis.avgROI.toFixed(2)}x`} color="teal" />
        <KpiCard label="Pipeline Value" value={fmtCad(kpis.totalLeads * 420)} sub="est. $420/lead" color="blue" />
      </div>

      {/* Channel performance table */}
      <div>
        <SectionTitle title="Channel Performance" sub="All active acquisition channels, sorted by leads generated (30d)" />
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Channel','Status','Budget/mo','Spend/mo','Leads (30d)','CPL','Conv Rate','ROI'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {channels.map(ch => (
                <tr key={ch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{channelLabel(ch.channel_name)}</td>
                  <td className="px-4 py-3"><Badge label={ch.status} colorClass={statusBadge(ch.status)} /></td>
                  <td className="px-4 py-3 text-gray-600">{fmtCad(ch.monthly_budget_cad)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtCad(ch.monthly_spend_cad)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(ch.leads_generated_30d)}</td>
                  <td className="px-4 py-3">{fmtCad(ch.cost_per_lead)}</td>
                  <td className="px-4 py-3">{fmtPct(ch.conversion_rate)}</td>
                  <td className={`px-4 py-3 ${roiColor(Number(ch.roi))}`}>
                    {ch.roi != null ? `${Number(ch.roi).toFixed(2)}x` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-200"></span> ROI &gt; 3x</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-200"></span> ROI 1–3x</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-200"></span> ROI &lt; 1x</span>
        </div>
      </div>

      {/* Funnel visualization */}
      <div>
        <SectionTitle title="Acquisition Funnel" sub="Aggregate across all demand gen campaigns" />
        <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm text-green-400 space-y-3">
          {[
            { label: 'Impressions', value: funnel.impressions, pct: null },
            { label: 'Clicks     ', value: funnel.clicks, pct: funnel.impressions > 0 ? funnel.clicks / funnel.impressions : 0, suffix: 'CTR' },
            { label: 'Leads      ', value: funnel.leads, pct: funnel.clicks > 0 ? funnel.leads / funnel.clicks : 0, suffix: 'Lead Rate' },
            { label: 'SQLs       ', value: funnel.sqls, pct: funnel.leads > 0 ? funnel.sqls / funnel.leads : 0, suffix: 'SQL Rate' },
            { label: 'Customers  ', value: funnel.customers, pct: funnel.sqls > 0 ? funnel.customers / funnel.sqls : 0, suffix: 'Close Rate' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-28 text-gray-300">{row.label}:</span>
              <span className="w-16 text-right text-white">{row.value.toLocaleString()}</span>
              <span className="text-green-500">{bar(row.value, maxImpressions)}</span>
              {row.pct != null && (
                <span className="text-gray-400 text-xs ml-1">{(row.pct * 100).toFixed(1)}% {row.suffix}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ROI legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Top ROI Channel', value: [...channels].sort((a, b) => Number(b.roi) - Number(a.roi))[0], color: 'green' },
          { label: 'Lowest CPL Channel', value: [...channels].sort((a, b) => Number(a.cost_per_lead) - Number(b.cost_per_lead))[0], color: 'teal' },
          { label: 'Highest Volume Channel', value: [...channels].sort((a, b) => b.leads_generated_30d - a.leads_generated_30d)[0], color: 'blue' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg p-4 border-l-4 ${card.color === 'green' ? 'border-green-500 bg-green-50' : card.color === 'teal' ? 'border-teal-500 bg-teal-50' : 'border-blue-500 bg-blue-50'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-xl font-bold mt-1">{channelLabel(card.value?.channel_name ?? '')}</p>
            <p className="text-sm text-gray-600 mt-1">
              {card.label.includes('ROI') && `${Number(card.value?.roi).toFixed(2)}x ROI`}
              {card.label.includes('CPL') && `${fmtCad(card.value?.cost_per_lead)} CPL`}
              {card.label.includes('Volume') && `${fmt(card.value?.leads_generated_30d)} leads`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: ICP ─────────────────────────────────────────────────────────────────

function TabICP({ profiles, onRefresh }: { profiles: IcpProfile[]; onRefresh: () => void }) {
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ business_type: '', product_service: '', current_customers_desc: '' });
  const [generated, setGenerated] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [targetMatch, setTargetMatch] = useState('');
  const [matchResult, setMatchResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/icp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json() as { icp?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Generation failed');
      setGenerated(json.icp ?? null);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generated) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        profile_name: `${form.business_type} ICP`,
        ...generated,
        channels: generated.preferred_channels ?? generated.channels ?? [],
        sales_cycle_days: generated.sales_cycle ? parseInt(String(generated.sales_cycle)) || 30 : 30,
      };
      const res = await fetch('/api/admin/customer-acquisition/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setShowWizard(false);
      setStep(1);
      setGenerated(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function analyzeTarget() {
    if (!targetMatch.trim()) return;
    setAnalyzing(true);
    setMatchResult('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/icp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: targetMatch,
          product_service: 'enterprise digital marketing and wellness solutions',
          current_customers_desc: profiles.map(p => p.profile_name).join(', '),
        }),
      });
      const json = await res.json() as { icp?: Record<string, unknown>; error?: string };
      if (res.ok && json.icp) {
        const icp = json.icp;
        setMatchResult(
          `Target companies: ${icp.industry ?? ''} sector, ${icp.company_size ?? ''} companies in ${icp.geography ?? 'Canada/USA'}. ` +
          `Decision makers: ${Array.isArray(icp.job_titles) ? icp.job_titles.join(', ') : ''}. ` +
          `Best channels: ${Array.isArray(icp.preferred_channels) ? (icp.preferred_channels as string[]).join(', ') : ''}.`
        );
      }
    } catch {
      setMatchResult('Analysis failed. Try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  const companySizeColor: Record<string, string> = {
    startup: 'bg-purple-100 text-purple-700',
    smb: 'bg-blue-100 text-blue-700',
    mid_market: 'bg-teal-100 text-teal-700',
    enterprise: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <SectionTitle title="Ideal Customer Profiles" sub="Define who you are selling to with precision" />
        <button
          onClick={() => { setShowWizard(true); setStep(1); setError(''); setGenerated(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Build ICP
        </button>
      </div>

      {/* ICP Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {profiles.map(p => (
          <div key={p.id} className={`rounded-lg border-2 p-5 ${p.is_primary ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                {p.is_primary && <span className="text-xs font-semibold text-blue-600 mb-1 block">⭐ Primary ICP</span>}
                <h3 className="font-bold text-gray-900 text-base">{p.profile_name}</h3>
                <p className="text-sm text-gray-500">{p.industry}</p>
              </div>
              <Badge label={p.company_size ?? ''} colorClass={companySizeColor[p.company_size] ?? 'bg-gray-100 text-gray-600'} />
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Geography:</span>
                <span className="text-gray-600 ml-1">{p.geography}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Revenue:</span>
                <span className="text-gray-600 ml-1">{p.revenue_range}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Decision Makers:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.job_titles?.slice(0, 3).map(t => (
                    <Badge key={t} label={t} colorClass="bg-gray-100 text-gray-700" />
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Top Pain Points:</span>
                <ul className="mt-1 space-y-0.5">
                  {p.pain_points?.slice(0, 3).map(pp => (
                    <li key={pp} className="text-gray-600 text-xs">• {pp}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium text-gray-700">Channels:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.channels?.map(c => (
                    <Badge key={c} label={c} colorClass="bg-teal-100 text-teal-700" />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>Budget: <strong className="text-gray-700">{p.budget_range}</strong></span>
                <span>Cycle: <strong className="text-gray-700">{p.sales_cycle_days}d</strong></span>
              </div>
              {p.ai_summary && (
                <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">{p.ai_summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      {profiles.length > 1 && (
        <div>
          <SectionTitle title="ICP Comparison" sub="Side-by-side view of all profiles" />
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimension</th>
                  {profiles.map(p => (
                    <th key={p.id} className="px-4 py-3 text-left text-xs font-medium text-gray-700">{p.profile_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {[
                  { label: 'Industry', key: 'industry' },
                  { label: 'Size', key: 'company_size' },
                  { label: 'Revenue', key: 'revenue_range' },
                  { label: 'Sales Cycle', key: 'sales_cycle_days' },
                  { label: 'Budget', key: 'budget_range' },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-medium text-gray-600">{row.label}</td>
                    {profiles.map(p => (
                      <td key={p.id} className="px-4 py-3 text-gray-700">
                        {row.key === 'sales_cycle_days' ? `${p.sales_cycle_days}d` : String((p as unknown as Record<string, unknown>)[row.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Find Companies Matching ICP */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <SectionTitle title="Find Companies Matching ICP" sub="AI-powered company targeting guidance" />
        <div className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Describe your business or product (e.g. yoga studio wellness platform)..."
            value={targetMatch}
            onChange={e => setTargetMatch(e.target.value)}
          />
          <button
            onClick={analyzeTarget}
            disabled={analyzing || !targetMatch.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {matchResult && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-indigo-200 text-sm text-gray-700">
            {matchResult}
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Build ICP — Step {step} of 3</h3>
              <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-blue-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Tell us about your business to generate an AI-powered ICP.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. yoga studio, SaaS wellness platform, fitness equipment retailer"
                    value={form.business_type}
                    onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product / Service</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. monthly yoga classes and wellness app subscription"
                    value={form.product_service}
                    onChange={e => setForm(f => ({ ...f, product_service: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Customers (optional)</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Describe who currently buys from you..."
                    value={form.current_customers_desc}
                    onChange={e => setForm(f => ({ ...f, current_customers_desc: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!form.business_type || !form.product_service}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Ready to generate an ICP for <strong>{form.business_type}</strong> selling <strong>{form.product_service}</strong>.
                </p>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                  The AI will create: industry, company size, job titles, 5 pain points, 4 goals, 3 buying triggers, 3 objections, preferred channels, budget range, sales cycle estimate.
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Back</button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'AI Generate ICP'}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && generated && (
              <div className="space-y-4">
                <p className="text-sm text-green-700 font-medium">ICP generated. Review and save.</p>
                <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 border border-gray-200">
                  {JSON.stringify(generated, null, 2)}
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Regenerate</button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save to Database'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Demand Gen ──────────────────────────────────────────────────────────

function TabDemandGen({ campaigns, channels }: { campaigns: DemandGenCampaign[]; channels: AcquisitionChannel[] }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', channel: '', campaign_type: 'awareness', target_audience: '', budget_cad: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalBudget = channels.reduce((s, c) => s + Number(c.monthly_budget_cad), 0);

  async function handleCreate() {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget_cad: Number(form.budget_cad) }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const cplByChannel = channels
    .filter(c => c.cost_per_lead)
    .sort((a, b) => Number(a.cost_per_lead) - Number(b.cost_per_lead));
  const maxCpl = Math.max(...cplByChannel.map(c => Number(c.cost_per_lead)), 1);

  const playbooks = [
    {
      stage: 'Top of Funnel (Awareness)',
      color: 'border-sky-500 bg-sky-50',
      items: ['Blog & SEO — target informational keywords', 'Social awareness campaigns (Facebook, TikTok)', 'YouTube pre-roll for brand reach', 'Podcast sponsorships in niche verticals'],
    },
    {
      stage: 'Middle of Funnel (Consideration)',
      color: 'border-amber-500 bg-amber-50',
      items: ['Retargeting — website visitors, blog readers', 'Email nurture sequences (5–7 touch points)', 'Webinars & live demos', 'Case study landing pages'],
    },
    {
      stage: 'Bottom of Funnel (Conversion)',
      color: 'border-green-500 bg-green-50',
      items: ['Demo request campaigns (Google Search + LinkedIn)', 'Free trial / freemium offer ads', 'Testimonial video campaigns', 'Competitive comparison content'],
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <SectionTitle title="Demand Generation" sub="Campaign management, budget allocation, and playbooks" />
        <button onClick={() => { setShowModal(true); setError(''); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Campaign
        </button>
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{c.target_audience}</p>
              </div>
              <Badge label={c.campaign_type} colorClass={statusBadge(c.campaign_type)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge label={channelLabel(c.channel)} colorClass="bg-gray-100 text-gray-700" />
              <Badge label={c.status} colorClass={statusBadge(c.status)} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-gray-500">Spend</p>
                <p className="font-bold text-gray-800">{fmtCad(c.spend_cad)}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-gray-500">Leads</p>
                <p className="font-bold text-gray-800">{fmt(c.leads)}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-gray-500">CPL</p>
                <p className="font-bold text-gray-800">{fmtCad(c.cpl)}</p>
              </div>
            </div>
            {c.impressions > 0 && (
              <p className="text-xs text-gray-400">{fmt(c.impressions)} impressions · {fmtPct(c.ctr)} CTR</p>
            )}
          </div>
        ))}
      </div>

      {/* CPL by channel bar chart */}
      <div>
        <SectionTitle title="CPL by Channel" sub="Lower is better — cost per lead across active channels" />
        <div className="bg-white rounded-lg border border-gray-200 p-5 font-mono text-sm space-y-2">
          {cplByChannel.map(ch => (
            <div key={ch.id} className="flex items-center gap-3">
              <span className="w-32 text-gray-600 text-xs">{channelLabel(ch.channel_name)}</span>
              <span className="text-green-600">{bar(maxCpl - Number(ch.cost_per_lead), maxCpl, 16)}</span>
              <span className="text-gray-800 font-semibold text-xs">{fmtCad(ch.cost_per_lead)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Budget allocation */}
      <div>
        <SectionTitle title="Budget Allocation" sub={`Total monthly budget: ${fmtCad(totalBudget)}`} />
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Budget/mo</th>
                <th className="px-4 py-3 text-left">% of Total</th>
                <th className="px-4 py-3 text-left">Allocation Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map(ch => {
                const pct = totalBudget > 0 ? (Number(ch.monthly_budget_cad) / totalBudget) * 100 : 0;
                return (
                  <tr key={ch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{channelLabel(ch.channel_name)}</td>
                    <td className="px-4 py-3">{fmtCad(ch.monthly_budget_cad)}</td>
                    <td className="px-4 py-3">{pct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="h-2 rounded-full bg-gray-100 w-48">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Playbooks */}
      <div>
        <SectionTitle title="Demand Gen Playbooks" sub="Strategy by funnel stage" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {playbooks.map(pb => (
            <div key={pb.stage} className={`rounded-lg border-l-4 p-5 ${pb.color}`}>
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">{pb.stage}</h4>
              <ul className="space-y-2">
                {pb.items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-gray-400">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">New Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              {(['name', 'channel', 'target_audience'] as const).map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field.replace('_', ' ')}</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.campaign_type}
                  onChange={e => setForm(f => ({ ...f, campaign_type: e.target.value }))}
                >
                  {['awareness', 'consideration', 'conversion', 'retargeting', 'lookalike'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget (CAD)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.budget_cad}
                  onChange={e => setForm(f => ({ ...f, budget_cad: e.target.value }))}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !form.name} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Display & Retargeting ───────────────────────────────────────────────

function TabDisplayRetargeting() {
  const segments = [
    { name: 'Website Visitors (All)', size: '~12,400', adType: 'Display awareness', platform: 'Google Display + Meta', days: 30 },
    { name: 'Product Page Visitors', size: '~3,200', adType: 'Dynamic product retargeting', platform: 'Meta + Google', days: 14 },
    { name: 'Cart Abandoners', size: '~840', adType: 'Urgency/offer retargeting', platform: 'Meta + Email', days: 7 },
    { name: 'Past Customers (90d+)', size: '~1,600', adType: 'Upsell / re-engagement', platform: 'Meta Lookalike + Email', days: 90 },
    { name: 'Email List — No Purchase 60d', size: '~2,100', adType: 'Nurture / testimonial', platform: 'Facebook Custom Audience', days: 60 },
  ];

  const adSpecs = [
    { platform: 'Google Display', sizes: ['300×250 (Medium Rectangle)', '728×90 (Leaderboard)', '160×600 (Wide Skyscraper)', '300×600 (Half Page)'] },
    { platform: 'Meta (Facebook/Instagram)', sizes: ['1080×1080 (Square)', '1200×628 (Landscape)', '1080×1920 (Story/Reel)'] },
    { platform: 'LinkedIn', sizes: ['1200×627 (Sponsored Content)', '100×100 (Sponsored Message)', '300×250 (Text Ad)'] },
  ];

  const checklist = [
    { item: 'Headline', spec: '≤ 30 characters', tip: 'Lead with the value prop' },
    { item: 'Body Copy', spec: '≤ 90 characters', tip: 'One clear benefit + CTA setup' },
    { item: 'CTA Button', spec: 'Action-oriented', tip: 'Start Now, Try Free, Book Demo' },
    { item: 'Visual', spec: 'High-contrast, no text overlay > 20%', tip: 'Faces outperform objects on Meta' },
    { item: 'Logo', spec: 'Visible in first 3 seconds', tip: 'Bottom-right preferred for display' },
    { item: 'Brand Colors', spec: 'Consistent with landing page', tip: 'Reduces cognitive load post-click' },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle title="Display & Retargeting" sub="Audience segments, ad specs, and creative checklist" />

      {/* Audience segments */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Retargeting Audience Segments</h3>
        <div className="space-y-3">
          {segments.map(seg => (
            <div key={seg.name} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{seg.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Lookback: {seg.days} days</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Est. Size</p>
                  <p className="font-semibold text-gray-800">{seg.size}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ad Type</p>
                  <p className="font-medium text-gray-700">{seg.adType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Platform</p>
                  <p className="font-medium text-gray-700">{seg.platform}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href="/admin/google-ads" className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Google Ads →</a>
                <a href="/admin/meta-integration" className="px-3 py-1.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200">Meta →</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ad specs */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Display Ad Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {adSpecs.map(spec => (
            <div key={spec.platform} className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">{spec.platform}</h4>
              <ul className="space-y-2">
                {spec.sizes.map(s => (
                  <li key={s} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">▪</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Creative checklist */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Ad Creative Checklist</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Element</th>
                <th className="px-4 py-3 text-left">Specification</th>
                <th className="px-4 py-3 text-left">Best Practice</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checklist.map(row => (
                <tr key={row.item} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.item}</td>
                  <td className="px-4 py-3 text-gray-600">{row.spec}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{row.tip}</td>
                  <td className="px-4 py-3"><Badge label="Review" colorClass="bg-amber-100 text-amber-700" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Influencers ─────────────────────────────────────────────────────────

function TabInfluencers({ influencers, onRefresh }: { influencers: Influencer[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverForm, setDiscoverForm] = useState({ niche: '', platform: 'instagram', min_followers: '10000', max_rate_cad: '1000' });
  const [suggestions, setSuggestions] = useState<Record<string, unknown>[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', platform: 'instagram', handle: '', email: '', followers: '', rate_per_post_cad: '', location: '', niche: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pipelineStatuses = ['prospect', 'outreach', 'negotiating', 'active', 'completed'];

  async function handleDiscover() {
    setDiscovering(true);
    setError('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/influencers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discoverForm, min_followers: Number(discoverForm.min_followers), max_rate_cad: Number(discoverForm.max_rate_cad) }),
      });
      const json = await res.json() as { suggestions?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Discovery failed');
      setSuggestions(json.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleAdd() {
    if (!addForm.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          followers: addForm.followers ? Number(addForm.followers) : null,
          rate_per_post_cad: addForm.rate_per_post_cad ? Number(addForm.rate_per_post_cad) : null,
          niche: addForm.niche ? addForm.niche.split(',').map(s => s.trim()) : [],
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setShowAdd(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const outreachTemplate = (inf: Influencer) =>
    `mailto:${inf.email}?subject=Collaboration%20Opportunity%20—%20${encodeURIComponent(inf.name)}&body=Hi%20${encodeURIComponent(inf.name)},%0D%0A%0D%0AI%20came%20across%20your%20profile%20and%20loved%20your%20content%20on%20${inf.platform}.%20We'd%20love%20to%20explore%20a%20collaboration.%0D%0A%0D%0AWould%20you%20be%20open%20to%20a%20quick%20call%3F%0D%0A%0D%0ABest%20regards`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <SectionTitle title="Influencer Management" sub="Roster, pipeline, outreach, and ROI tracking" />
        <div className="flex gap-3">
          <button onClick={() => { setShowDiscover(true); setSuggestions([]); setError(''); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            Discover Influencers
          </button>
          <button onClick={() => { setShowAdd(true); setError(''); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Influencer
          </button>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Pipeline View</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStatuses.map(status => {
            const inStatus = influencers.filter(i => i.status === status);
            return (
              <div key={status} className="min-w-48 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <Badge label={status} colorClass={statusBadge(status)} />
                  <span className="text-xs text-gray-400">{inStatus.length}</span>
                </div>
                <div className="space-y-2">
                  {inStatus.map(inf => (
                    <div key={inf.id} className="bg-white rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {inf.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-900">{inf.name}</p>
                          <p className="text-xs text-gray-400">{platformIcon(inf.platform)} {inf.handle}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{fmt(inf.followers)} followers</p>
                    </div>
                  ))}
                  {inStatus.length === 0 && <p className="text-xs text-gray-300 italic p-2">None</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roster table */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Full Roster</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Influencer', 'Platform', 'Followers', 'Engagement', 'Niche', 'Status', 'Rate/Post', 'Leads', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {influencers.map(inf => (
                <tr key={inf.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {inf.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{inf.name}</p>
                        <p className="text-xs text-gray-400">{inf.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{platformIcon(inf.platform)} {inf.platform}</td>
                  <td className="px-4 py-3 font-medium">{fmt(inf.followers)}</td>
                  <td className="px-4 py-3">{fmtPct(inf.avg_engagement_rate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {inf.niche?.slice(0, 2).map(n => <Badge key={n} label={n} colorClass="bg-gray-100 text-gray-600" />)}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge label={inf.status} colorClass={statusBadge(inf.status)} /></td>
                  <td className="px-4 py-3">{fmtCad(inf.rate_per_post_cad)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(inf.total_leads)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {inf.email && (
                        <a href={outreachTemplate(inf)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">📧 Outreach</a>
                      )}
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded cursor-pointer hover:bg-gray-200">📊 Track</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h4 className="font-semibold text-gray-800 mb-3">ROI by Influencer</h4>
          <div className="space-y-3">
            {influencers.filter(i => i.posts_completed > 0).map(inf => {
              const totalSpend = Number(inf.rate_per_post_cad) * inf.posts_completed;
              const roi = totalSpend > 0 ? (inf.total_leads * 420) / totalSpend : 0;
              return (
                <div key={inf.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{inf.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs">{fmtCad(totalSpend)} spend</span>
                    <span className={`font-semibold ${roi >= 2 ? 'text-green-600' : roi >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                      {roi.toFixed(1)}x
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h4 className="font-semibold text-gray-800 mb-3">Email Templates</h4>
          <div className="space-y-3">
            {[
              { label: 'Introduction Outreach', desc: 'First contact, brand intro, partnership exploration' },
              { label: 'Collab Proposal', desc: 'Campaign details, deliverables, timeline, compensation' },
              { label: 'Rate Negotiation', desc: 'Counter-offer, alternative structures (equity, gifting)' },
              { label: 'Follow-up (7d)', desc: 'Gentle reminder after no response' },
            ].map(t => (
              <div key={t.label} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <span className="text-blue-500 mt-0.5">📝</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Discover Modal */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Discover Influencers</h3>
              <button onClick={() => setShowDiscover(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { label: 'Niche', field: 'niche', placeholder: 'e.g. yoga, wellness, fitness' },
                { label: 'Platform', field: 'platform', placeholder: '' },
                { label: 'Min Followers', field: 'min_followers', placeholder: '10000' },
                { label: 'Max Rate (CAD/post)', field: 'max_rate_cad', placeholder: '1000' },
              ].map(f => (
                <div key={f.field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  {f.field === 'platform' ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={discoverForm.platform}
                      onChange={e => setDiscoverForm(d => ({ ...d, platform: e.target.value }))}
                    >
                      {['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder={f.placeholder}
                      value={discoverForm[f.field as keyof typeof discoverForm]}
                      onChange={e => setDiscoverForm(d => ({ ...d, [f.field]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>}
            <button
              onClick={handleDiscover}
              disabled={discovering || !discoverForm.niche}
              className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 mb-4"
            >
              {discovering ? 'Discovering...' : 'Find Influencer Personas'}
            </button>
            {suggestions.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{String(s.persona_name ?? '')}</h4>
                      <Badge label={`${fmtPct(Number(s.estimated_engagement_rate))} eng.`} colorClass="bg-green-100 text-green-700" />
                    </div>
                    <p className="text-xs text-gray-500 mb-1">Handle style: <strong>{String(s.handle_style ?? '')}</strong></p>
                    <p className="text-xs text-gray-600">{String(s.why_good_fit ?? '')}</p>
                    {Array.isArray(s.content_pillars) && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(s.content_pillars as string[]).map(cp => <Badge key={cp} label={cp} colorClass="bg-gray-100 text-gray-600" />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Influencer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add Influencer</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Name', field: 'name', required: true },
                { label: 'Handle', field: 'handle' },
                { label: 'Email', field: 'email' },
                { label: 'Location', field: 'location' },
                { label: 'Followers', field: 'followers' },
                { label: 'Rate/Post (CAD)', field: 'rate_per_post_cad' },
                { label: 'Niche (comma-separated)', field: 'niche' },
              ].map(f => (
                <div key={f.field} className={f.field === 'niche' ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}{f.required && ' *'}</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={addForm[f.field as keyof typeof addForm]}
                    onChange={e => setAddForm(fm => ({ ...fm, [f.field]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={addForm.platform}
                  onChange={e => setAddForm(fm => ({ ...fm, platform: e.target.value }))}
                >
                  {['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mt-4">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !addForm.name} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Add to Roster'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Community & GEO/AEO ─────────────────────────────────────────────────

function TabCommunityGEO() {
  const [geoInput, setGeoInput] = useState('');
  const [geoResult, setGeoResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [geoError, setGeoError] = useState('');

  async function analyzeGeo() {
    if (!geoInput.trim()) return;
    setAnalyzing(true);
    setGeoError('');
    setGeoResult('');
    try {
      const res = await fetch('/api/admin/customer-acquisition/icp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: geoInput,
          product_service: 'GEO readiness analysis for AI search engines',
          current_customers_desc: 'Analyze for GEO: list 5 specific improvements to appear in ChatGPT, Perplexity, and Claude search results.',
        }),
      });
      const json = await res.json() as { icp?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed');
      const icp = json.icp ?? {};
      setGeoResult(
        `GEO Priority Areas: ${Array.isArray(icp.pain_points) ? (icp.pain_points as string[]).join(' | ') : 'Analysis complete — review the JSON below.'}\n\nTop Channels for AI Visibility: ${Array.isArray(icp.preferred_channels) ? (icp.preferred_channels as string[]).join(', ') : ''}`
      );
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  const communities = [
    {
      platform: 'Reddit',
      icon: '🔴',
      strategy: 'Engage in r/yoga, r/wellness, r/entrepreneur with value-first posts',
      cadence: '3–5 posts/week',
      rules: ['No promo links in first 3 months', 'Comment before posting', 'Use karma as a trust signal'],
    },
    {
      platform: 'LinkedIn Groups',
      icon: '💼',
      strategy: 'Join HR Professional Network, Corporate Wellness leaders, SMB Marketing groups',
      cadence: 'Thought leadership post 2×/week',
      rules: ['Tag relevant people', 'Share stats + insights not ads', 'Reply to every comment within 24h'],
    },
    {
      platform: 'Discord / Slack',
      icon: '💬',
      strategy: 'Join niche wellness, startup, and marketing Slack/Discord communities',
      cadence: 'Daily presence, weekly value share',
      rules: ['Read pinned rules before posting', 'DM only after building rapport', 'Offer free resources first'],
    },
    {
      platform: 'Quora',
      icon: '❓',
      strategy: 'Answer questions: "How to reduce employee burnout", "Best yoga for beginners", "ROI of workplace wellness"',
      cadence: '5 answers/week',
      rules: ['Link to blog only where genuinely helpful', 'Long-form answers rank better', 'Upvotes = SEO juice'],
    },
    {
      platform: 'Product Hunt',
      icon: '🚀',
      strategy: 'Launch digital product, schedule for Tuesday, build supporter list in advance',
      cadence: '1 major launch/quarter',
      rules: ['Launch between 12:01 AM PST', 'Hunter with large following', 'Collect email list pre-launch'],
    },
  ];

  const geoChecklist = [
    { item: 'Structured Data (JSON-LD)', status: 'action', desc: 'FAQ, HowTo, Organization, Product schema' },
    { item: 'Authoritative Citations', status: 'action', desc: 'Link to and be cited by .edu, .gov, top-tier media' },
    { item: 'FAQ Pages', status: 'action', desc: 'Answer questions AI engines are asked about your category' },
    { item: 'Long-form Comprehensive Guides', status: 'action', desc: '2,500+ word guides — AI engines prefer exhaustive coverage' },
    { item: 'Wikipedia / Wikidata Presence', status: 'action', desc: 'AI engines heavily cite Wikipedia as source of truth' },
    { item: 'Press & PR Coverage', status: 'review', desc: 'TechCrunch, Forbes, niche trade publications as citation sources' },
    { item: 'Brand Mentions (Unlinked)', status: 'review', desc: 'Increase unlinked brand mentions — AI engines track them' },
  ];

  const aeoItems = [
    { title: 'Featured Snippets', desc: 'Format answers as numbered lists or tables for Position Zero targeting', tip: 'Use H2 as a question, answer in first paragraph in 40–60 words' },
    { title: 'People Also Ask', desc: 'Build content clusters answering PAA questions in your category', tip: 'Use Answer The Public + Google PAA boxes for question mining' },
    { title: 'Voice Search', desc: 'Optimize for conversational queries ("best yoga studio near me", "how do I reduce stress at work")', tip: 'Target long-tail question keywords, local intent, and natural language' },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle title="Community, GEO & AEO" sub="Organic community acquisition, AI search optimization, and answer engine strategy" />

      {/* Community channels */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Community Acquisition Channels</h3>
        <div className="space-y-4">
          {communities.map(c => (
            <div key={c.platform} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{c.platform}</h4>
                    <p className="text-xs text-gray-500">Cadence: {c.cadence}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-3">{c.strategy}</p>
              <div className="flex flex-wrap gap-2">
                {c.rules.map(r => (
                  <span key={r} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-3 py-1">⚠ {r}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GEO */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 rounded-lg bg-indigo-100">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Generative Engine Optimization (GEO)</h3>
            <p className="text-sm text-gray-600 mt-1">Optimize your content to appear in ChatGPT, Perplexity, Claude, and Bing Copilot answers — the next frontier of search visibility.</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100 mb-6">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">GEO Tactic</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {geoChecklist.map(item => (
                <tr key={item.item} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.item}</td>
                  <td className="px-4 py-3 text-gray-600">{item.desc}</td>
                  <td className="px-4 py-3">
                    <Badge label={item.status} colorClass={item.status === 'action' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm font-medium text-indigo-800 mb-3">Analyze GEO Readiness</p>
          <div className="flex gap-3">
            <input
              className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder="Describe your business (e.g. yoga studio digital platform Canada)..."
              value={geoInput}
              onChange={e => setGeoInput(e.target.value)}
            />
            <button
              onClick={analyzeGeo}
              disabled={analyzing || !geoInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze GEO'}
            </button>
          </div>
          {geoError && <p className="text-sm text-red-600 mt-2">{geoError}</p>}
          {geoResult && (
            <div className="mt-4 bg-white rounded-lg border border-indigo-200 p-4 text-sm text-gray-700 whitespace-pre-wrap">{geoResult}</div>
          )}
        </div>
      </div>

      {/* AEO */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Answer Engine Optimization (AEO)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aeoItems.map(item => (
            <div key={item.title} className="bg-white rounded-lg border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-2">{item.title}</h4>
              <p className="text-sm text-gray-600 mb-3">{item.desc}</p>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                <span className="font-medium">Tip: </span>{item.tip}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Attribution & Analytics ─────────────────────────────────────────────

function TabAttribution({ channels }: { channels: AcquisitionChannel[] }) {
  const [model, setModel] = useState<'last_click' | 'first_click' | 'linear' | 'time_decay' | 'position_based'>('last_click');
  const [cac, setCac] = useState('350');
  const [mrr, setMrr] = useState('42');

  const models = [
    { key: 'last_click', label: 'Last Click', desc: '100% credit to the last touchpoint before conversion. Simple but undervalues awareness channels.' },
    { key: 'first_click', label: 'First Click', desc: '100% credit to the first touchpoint. Good for measuring acquisition channels, undervalues nurture.' },
    { key: 'linear', label: 'Linear', desc: 'Equal credit distributed across all touchpoints. Balanced, good for long sales cycles.' },
    { key: 'time_decay', label: 'Time Decay', desc: 'More credit to recent touchpoints. Good for short-cycle B2C purchasing decisions.' },
    { key: 'position_based', label: 'Position-Based', desc: '40% first, 40% last, 20% middle. Best for B2B with content-heavy mid-funnel.' },
  ] as const;

  const journeys = [
    { path: 'Social → Blog → Email → Demo → Purchase', frequency: 'Most Common', cycle: '14d' },
    { path: 'Google Search → Landing Page → Purchase', frequency: 'High Volume', cycle: '1d' },
    { path: 'LinkedIn Ad → Webinar → Sales Call → Purchase', frequency: 'Enterprise', cycle: '60d' },
    { path: 'Referral → Trial → Email Nurture → Purchase', frequency: 'High LTV', cycle: '7d' },
    { path: 'TikTok → Instagram → Website → Email → Purchase', frequency: 'Gen Z', cycle: '21d' },
  ];

  const ltvByChannel = [
    { channel: 'Referral', ltv: 2840, cac: 9 },
    { channel: 'SEO', ltv: 2200, cac: 32 },
    { channel: 'Email', ltv: 2100, cac: 17 },
    { channel: 'Google Ads', ltv: 1680, cac: 55 },
    { channel: 'LinkedIn Ads', ltv: 2960, cac: 103 },
    { channel: 'Facebook Ads', ltv: 1420, cac: 41 },
  ];

  const cacN = parseFloat(cac) || 0;
  const mrrN = parseFloat(mrr) || 0;
  const paybackMonths = mrrN > 0 ? cacN / mrrN : 0;

  const selectedModel = models.find(m => m.key === model);

  return (
    <div className="space-y-8">
      <SectionTitle title="Attribution & Analytics" sub="Multi-touch attribution, customer journeys, LTV, and CAC payback" />

      {/* Attribution model selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Attribution Model</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {models.map(m => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${model === m.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {selectedModel && (
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <strong>{selectedModel.label}:</strong> {selectedModel.desc}
          </div>
        )}
      </div>

      {/* Channel attribution table */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Channel Attribution ({models.find(m => m.key === model)?.label})</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Role in Journey</th>
                <th className="px-4 py-3 text-left">Credit %</th>
                <th className="px-4 py-3 text-left">Leads Attributed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {channels.map(ch => {
                let credit = 0;
                const role = model === 'first_click'
                  ? (ch.channel_name === 'seo' || ch.channel_name === 'google_ads' ? 'Initiator' : 'Assist')
                  : model === 'last_click'
                  ? (ch.channel_name === 'retargeting' || ch.channel_name === 'cold_outbound' ? 'Closer' : 'Assist')
                  : model === 'linear'
                  ? 'Equal Touch'
                  : model === 'time_decay'
                  ? (ch.channel_name === 'retargeting' ? 'High Weight' : 'Decayed')
                  : 'Mixed';

                if (model === 'linear') credit = Math.round(100 / channels.length);
                else if (model === 'last_click') credit = ch.channel_name === 'retargeting' ? 40 : Math.round(60 / (channels.length - 1));
                else if (model === 'first_click') credit = ch.channel_name === 'seo' || ch.channel_name === 'google_ads' ? 35 : Math.round(65 / (channels.length - 2));
                else if (model === 'time_decay') credit = ch.channel_name === 'retargeting' ? 30 : ch.channel_name === 'google_ads' ? 25 : Math.round(45 / (channels.length - 2));
                else credit = Math.round(100 / channels.length);

                return (
                  <tr key={ch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{channelLabel(ch.channel_name)}</td>
                    <td className="px-4 py-3"><Badge label={role} colorClass={role === 'Initiator' || role === 'Closer' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-4 py-3 font-semibold">{credit}%</td>
                    <td className="px-4 py-3">{Math.round(ch.leads_generated_30d * (credit / 100))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer journey mapper */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">Customer Journey Paths</h3>
        <div className="space-y-3">
          {journeys.map(j => (
            <div key={j.path} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-mono text-gray-800">{j.path.split(' → ').map((step, i, arr) => (
                  <span key={i}>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{step}</span>
                    {i < arr.length - 1 && <span className="mx-1 text-gray-400">→</span>}
                  </span>
                ))}</p>
              </div>
              <div className="flex gap-4 text-sm flex-shrink-0">
                <div><p className="text-xs text-gray-500">Frequency</p><p className="font-semibold text-gray-800">{j.frequency}</p></div>
                <div><p className="text-xs text-gray-500">Avg Cycle</p><p className="font-semibold text-gray-800">{j.cycle}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LTV by channel */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">LTV by Acquisition Channel</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Customer LTV</th>
                <th className="px-4 py-3 text-left">CAC</th>
                <th className="px-4 py-3 text-left">LTV:CAC Ratio</th>
                <th className="px-4 py-3 text-left">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {ltvByChannel.sort((a, b) => (b.ltv / b.cac) - (a.ltv / a.cac)).map(row => {
                const ratio = row.cac > 0 ? row.ltv / row.cac : 0;
                return (
                  <tr key={row.channel} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.channel}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmtCad(row.ltv)}</td>
                    <td className="px-4 py-3">{fmtCad(row.cac)}</td>
                    <td className={`px-4 py-3 font-bold ${ratio >= 5 ? 'text-green-600' : ratio >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                      {ratio.toFixed(1)}x
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={ratio >= 5 ? 'Scale' : ratio >= 3 ? 'Healthy' : 'Review'}
                        colorClass={ratio >= 5 ? 'bg-green-100 text-green-700' : ratio >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAC Payback Calculator */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">CAC Payback Period Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Acquisition Cost (CAD)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={cac}
              onChange={e => setCac(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Revenue per Customer (CAD)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={mrr}
              onChange={e => setMrr(e.target.value)}
            />
          </div>
          <div className={`rounded-lg p-4 ${paybackMonths <= 12 ? 'bg-green-50 border border-green-200' : paybackMonths <= 24 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Payback Period</p>
            <p className={`text-3xl font-bold ${paybackMonths <= 12 ? 'text-green-700' : paybackMonths <= 24 ? 'text-amber-700' : 'text-red-700'}`}>
              {paybackMonths > 0 ? `${paybackMonths.toFixed(1)} mo` : '—'}
            </p>
            <p className="text-xs mt-1 text-gray-500">
              {paybackMonths <= 12 ? 'Excellent — scale confidently' : paybackMonths <= 24 ? 'Acceptable — optimise LTV' : 'Too long — reduce CAC or increase MRR'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerAcquisitionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/customer-acquisition');
      const json = await res.json() as DashboardData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Acquisition Hub</h1>
              <p className="text-sm text-gray-500 mt-0.5">ICP · Demand Gen · Display · Influencers · Community · GEO/AEO · Attribution</p>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Loading acquisition data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center">
            <p className="text-red-700 font-medium">Failed to load data</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
            <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {activeTab === 'dashboard' && <TabDashboard data={data} />}
            {activeTab === 'icp' && <TabICP profiles={data.icpProfiles} onRefresh={fetchData} />}
            {activeTab === 'demand-gen' && <TabDemandGen campaigns={data.campaigns} channels={data.channels} />}
            {activeTab === 'display-retargeting' && <TabDisplayRetargeting />}
            {activeTab === 'influencers' && <TabInfluencers influencers={data.influencers} onRefresh={fetchData} />}
            {activeTab === 'community-geo' && <TabCommunityGEO />}
            {activeTab === 'attribution' && <TabAttribution channels={data.channels} />}
          </>
        )}
      </div>
    </div>
  );
}
