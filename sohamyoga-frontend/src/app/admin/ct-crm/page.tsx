'use client';
import { useEffect, useState, useCallback } from 'react';

interface Kpi { label: string; value: number | string; target: number; trend: 'up' | 'down'; unit: string; }
interface DealStage { stage: string; count: number; total_value: number; }
interface LeadStage { stage: string; count: number; }
interface Deal { id: number; name?: string; stage?: string; value?: number; close_date?: string; created_at?: string; }
interface Forecast { total_pipeline: number; weighted_forecast: number; }
interface CtData { health_score: number; traffic_light: 'red' | 'yellow' | 'green'; kpis: Kpi[]; updated_at: string; }

const TABS = ['Overview', 'Pipeline View', 'Lead Funnel', 'Revenue Forecast', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const STAGE_COLOR: Record<string, string> = {
  prospect: 'bg-gray-100 text-gray-700', qualified: 'bg-blue-100 text-blue-800',
  proposal: 'bg-amber-100 text-amber-800', negotiation: 'bg-orange-100 text-orange-800',
  closed_won: 'bg-green-100 text-green-800', closed_lost: 'bg-red-100 text-red-800',
  mql: 'bg-sky-100 text-sky-800', sql: 'bg-indigo-100 text-indigo-800',
  new: 'bg-gray-100 text-gray-700', nurturing: 'bg-violet-100 text-violet-800',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
      <p className="text-2xl font-bold mt-1">{kpi.value} <span className="text-sm text-gray-400">{kpi.unit}</span></p>
      <p className={`text-xs mt-2 font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
        {kpi.trend === 'up' ? '▲' : '▼'} Target: {kpi.target.toLocaleString()}
      </p>
    </div>
  );
}

export default function CtCrmPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtData | null>(null);
  const [dealStages, setDealStages] = useState<DealStage[]>([]);
  const [leadStages, setLeadStages] = useState<LeadStage[]>([]);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [forecast, setForecast] = useState<{ this_month: Forecast; this_quarter: Forecast } | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p, f] = await Promise.all([
        fetch('/api/admin/ct-crm').then(r => r.json()),
        fetch('/api/admin/ct-crm/pipeline').then(r => r.json()),
        fetch('/api/admin/ct-crm/forecast').then(r => r.json()),
      ]);
      setData(d);
      setDealStages(p.deal_stages ?? []);
      setLeadStages(p.lead_stages ?? []);
      setRecentDeals(p.recent_deals ?? []);
      setForecast(f);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-crm/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, kpis: data.kpis }),
      });
      setBrief((await res.json()).brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';
  const maxDealCount = Math.max(...dealStages.map(s => s.count), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CRM Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Deals · Leads · Opportunities · Revenue Forecast</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{TL_EMOJI[tl]}</span>
              <div className="text-right">
                <p className="text-3xl font-bold">{data?.health_score ?? 0}<span className="text-base font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-400">Health Score</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(data?.kpis ?? []).map(k => <KpiCard key={k.label} kpi={k} />)}
          </div>
        )}

        {tab === 'Pipeline View' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Deal Pipeline by Stage</h2>
              {dealStages.length === 0
                ? <p className="text-sm text-gray-400">No deals found in sales_intel_deals.</p>
                : <div className="space-y-3">
                    {dealStages.map(s => (
                      <div key={s.stage} className="flex items-center gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold w-28 text-center ${STAGE_COLOR[s.stage] ?? 'bg-gray-100 text-gray-700'}`}>{s.stage}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full flex items-center px-2" style={{ width: `${Math.round((s.count / maxDealCount) * 100)}%` }}>
                            {s.count > 0 && <span className="text-xs text-white font-semibold">{s.count}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 w-24 text-right">${Math.round(Number(s.total_value)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Deals</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-2">Deal</th><th className="pb-2">Stage</th><th className="pb-2">Value</th><th className="pb-2">Close Date</th>
                </tr></thead>
                <tbody>
                  {recentDeals.map(d => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 text-gray-800 font-medium">{d.name ?? `Deal #${d.id}`}</td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_COLOR[d.stage ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>{d.stage}</span></td>
                      <td className="py-2 text-gray-700">${Number(d.value ?? 0).toLocaleString()}</td>
                      <td className="py-2 text-gray-400 text-xs">{d.close_date ? new Date(d.close_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Lead Funnel' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Status Breakdown</h2>
            {leadStages.length === 0
              ? <p className="text-sm text-gray-400">No leads found in lead_management_leads.</p>
              : <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {leadStages.map(l => (
                    <div key={l.stage} className="border rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{l.count}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_COLOR[l.stage] ?? 'bg-gray-100 text-gray-700'}`}>{l.stage}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {tab === 'Revenue Forecast' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">This Month</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400">Total Pipeline</p>
                  <p className="text-3xl font-bold text-gray-800">${Math.round(Number(forecast?.this_month?.total_pipeline ?? 0)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Weighted Forecast</p>
                  <p className="text-2xl font-bold text-indigo-600">${Math.round(Number(forecast?.this_month?.weighted_forecast ?? 0)).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">Probability-weighted by deal stage</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">This Quarter</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400">Total Pipeline</p>
                  <p className="text-3xl font-bold text-gray-800">${Math.round(Number(forecast?.this_quarter?.total_pipeline ?? 0)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Weighted Forecast</p>
                  <p className="text-2xl font-bold text-indigo-600">${Math.round(Number(forecast?.this_quarter?.weighted_forecast ?? 0)).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">Probability-weighted by deal stage</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI CRM Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pipeline risk analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered CRM health analysis.</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
