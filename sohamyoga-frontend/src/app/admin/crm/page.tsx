'use client';
import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Leads', 'Pipeline', 'Segmentation', 'CLV', 'Churn', 'Campaigns'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface OverviewData {
  totalContacts: number; activeLeads: number; conversionRatePct: number; avgClv: number; churnRatePct: number;
  leadSources: { source: string; count: number; pct: number }[];
}

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  useEffect(() => { fetchJson<OverviewData>('/api/crm/overview').then(setData); }, []);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Contacts"     value={(data?.totalContacts ?? 0).toLocaleString()} color="blue" />
        <KpiCard label="Active Leads"       value={(data?.activeLeads ?? 0).toLocaleString()}   color="green" />
        <KpiCard label="Conversion Rate"    value={`${data?.conversionRatePct ?? 0}%`} sub="Last 90 days" color="teal" />
        <KpiCard label="Avg CLV"            value={`$${(data?.avgClv ?? 0).toLocaleString()}`} color="purple" />
        <KpiCard label="Churn Risk"         value={`${data?.churnRatePct ?? 0}%`} sub="High/critical flagged" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Lead Sources (30 days)</h3>
        {!data?.leadSources.length ? <EmptyState message="No leads captured in the last 30 days." /> : data.leadSources.map(s => (
          <div key={s.source} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-28 text-gray-600 text-xs">{s.source}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-400 rounded" style={{ width: `${s.pct}%` }} /></div>
            <span className="w-8 text-right font-medium">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LeadRow { id: string; name: string; email: string; source: string; stage: string; score: number | null; temperature: string | null; added: string }

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<{ leads: LeadRow[] }>('/api/crm/leads').then(d => { setLeads(d?.leads ?? []); setLoading(false); }); }, []);
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Active Leads ({leads.length})</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Lead</button>
      </div>
      {loading ? <EmptyState message="Loading…" /> : leads.length === 0 ? <EmptyState message="No active leads yet." /> : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name', 'Email', 'Source', 'Stage', 'Score', 'Added'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{l.name}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{l.email}</td>
                <td className="px-3 py-2"><Badge color="blue">{l.source}</Badge></td>
                <td className="px-3 py-2"><Badge color={l.stage === 'demo_scheduled' ? 'purple' : l.stage === 'trial' ? 'teal' : 'gray'}>{l.stage}</Badge></td>
                <td className="px-3 py-2">
                  {l.score === null ? <span className="text-xs text-gray-400">not scored</span> : (
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-gray-100 rounded"><div className={`h-1.5 ${l.score > 80 ? 'bg-green-500' : l.score > 60 ? 'bg-amber-400' : 'bg-gray-400'} rounded`} style={{ width: `${l.score}%` }} /></div>
                      <span className="text-xs font-medium">{l.score}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{new Date(l.added).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface PipelineData { total: number; converted: number; conversionRatePct: number; avgDealDays: number | null; stages: { name: string; count: number }[] }

function PipelineTab() {
  const [data, setData] = useState<PipelineData | null>(null);
  useEffect(() => { fetchJson<PipelineData>('/api/crm/pipeline').then(setData); }, []);
  const STAGE_COLOR: Record<string, string> = {
    new: 'bg-gray-100 border-gray-300', contacted: 'bg-blue-100 border-blue-300', trial: 'bg-purple-100 border-purple-300',
    demo_scheduled: 'bg-amber-100 border-amber-300', proposal: 'bg-teal-100 border-teal-300', converted: 'bg-green-100 border-green-300',
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total in Pipeline (90d)" value={String(data?.total ?? 0)} color="blue" />
        <KpiCard label="Converted" value={String(data?.converted ?? 0)} sub={`${data?.conversionRatePct ?? 0}% conversion`} color="green" />
        <KpiCard label="Avg Deal Time" value={data?.avgDealDays != null ? `${data.avgDealDays} days` : '—'} color="purple" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {(data?.stages ?? []).map(stage => (
          <div key={stage.name} className={`border-2 rounded-lg p-3 ${STAGE_COLOR[stage.name] ?? 'bg-gray-100 border-gray-300'}`}>
            <div className="text-lg font-bold text-gray-800">{stage.count}</div>
            <div className="text-xs font-medium text-gray-600 mt-0.5 capitalize">{stage.name.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SegmentRow { name: string; count: number; desc: string }

function SegmentationTab() {
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  useEffect(() => { fetchJson<{ segments: SegmentRow[] }>('/api/crm/segments').then(d => setSegments(d?.segments ?? [])); }, []);
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Customer Segments</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Create Segment</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {segments.map(seg => (
          <div key={seg.name} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm">{seg.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{seg.desc}</div>
              </div>
              <span className="text-lg font-bold text-blue-600">{seg.count}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="text-xs text-blue-600 hover:underline">View</button>
              <button className="text-xs text-purple-600 hover:underline">Campaign</button>
              <button className="text-xs text-gray-500 hover:underline">Export</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ClvData { avgClv: number; top10PctClv: number; byTier: { tier: string; p25: number; median: number; p90: number }[] }

function CLVTab() {
  const [data, setData] = useState<ClvData | null>(null);
  useEffect(() => { fetchJson<ClvData>('/api/crm/clv').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Avg CLV"         value={`$${(data?.avgClv ?? 0).toLocaleString()}`}   sub="Per paying customer" color="purple" />
        <KpiCard label="Top 10% CLV"     value={`$${(data?.top10PctClv ?? 0).toLocaleString()}`} sub="90th percentile"   color="green" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">CLV Distribution by Tier</h3>
        {!data?.byTier.length ? <EmptyState message="No customer spend recorded yet." /> : data.byTier.map(t => (
          <div key={t.tier} className="py-2 border-b border-gray-50 text-sm">
            <div className="flex justify-between">
              <span className="font-medium w-20 capitalize">{t.tier}</span>
              <span className="text-gray-500 text-xs">P25: ${t.p25}</span>
              <span className="font-semibold text-purple-700">Median: ${t.median}</span>
              <span className="text-gray-500 text-xs">P90: ${t.p90}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChurnData {
  churnRatePct: number; membersFlagged: number;
  reasons: { reason: string; pct: number }[];
  atRisk: { name: string; lastClass: string | null; risk: string }[];
}

function ChurnTab() {
  const [data, setData] = useState<ChurnData | null>(null);
  useEffect(() => { fetchJson<ChurnData>('/api/crm/churn').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Churn Risk Rate"   value={`${data?.churnRatePct ?? 0}%`}  color="amber" />
        <KpiCard label="Members Flagged"   value={String(data?.membersFlagged ?? 0)} sub="High/critical risk" color="rose" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Top Churn Reasons (Ollama-flagged)</h3>
          {!data?.reasons.length ? <EmptyState message="No high-risk members flagged yet." /> : data.reasons.map(r => (
            <div key={r.reason} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-36 text-gray-600 text-xs truncate" title={r.reason}>{r.reason}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-rose-400 rounded" style={{ width: `${r.pct}%` }} /></div>
              <span className="w-8 text-right font-medium">{r.pct}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">At-Risk — Early Warning</h3>
          {!data?.atRisk.length ? <EmptyState message="No members currently flagged." /> : data.atRisk.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
              <div><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">Last class: {m.lastClass ? new Date(m.lastClass).toLocaleDateString() : 'never'}</div></div>
              <Badge color={m.risk === 'Critical' || m.risk === 'High' ? 'red' : m.risk === 'Medium' ? 'amber' : 'green'}>{m.risk}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CampaignRow { id: string; name: string; status: string; segment: string; sent: number; ctrPct: number; conversions: number }

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  useEffect(() => { fetchJson<{ campaigns: CampaignRow[] }>('/api/crm/campaigns').then(d => setCampaigns(d?.campaigns ?? [])); }, []);
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold">CRM Campaigns</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Campaign</button>
      </div>
      {campaigns.length === 0 ? <EmptyState message="No campaigns yet — create one in Marketing Automation." /> : (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Campaign', 'Segment', 'Impressions', 'Click Rate', 'Conversions', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {campaigns.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.segment}</td>
                <td className="px-3 py-2">{c.sent.toLocaleString()}</td>
                <td className="px-3 py-2">{c.ctrPct}%</td>
                <td className="px-3 py-2 font-bold text-green-700">{c.conversions}</td>
                <td className="px-3 py-2"><Badge color={c.status === 'active' ? 'green' : c.status === 'completed' ? 'blue' : 'gray'}>{c.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

export default function CRMAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM & Lifecycle</h1>
        <p className="text-sm text-gray-500 mt-1">Leads, pipeline, segmentation, CLV, churn analysis and campaigns</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'      && <OverviewTab />}
      {tab === 'Leads'         && <LeadsTab />}
      {tab === 'Pipeline'      && <PipelineTab />}
      {tab === 'Segmentation'  && <SegmentationTab />}
      {tab === 'CLV'           && <CLVTab />}
      {tab === 'Churn'         && <ChurnTab />}
      {tab === 'Campaigns'     && <CampaignsTab />}
    </div>
  );
}
