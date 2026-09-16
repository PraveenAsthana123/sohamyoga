'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtCsatData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  total_responses: number;
  avg_csat: number;
  avg_nps: number;
  promoters_pct: number;
  passives_pct: number;
  detractors_pct: number;
  alerts: string[];
  updated_at: string;
}

interface TrendRow { period: string; avg_csat: number; avg_nps: number; responses: number; }
interface DriverRow { driver: string; impact: string; score: number; }
interface AdvisorResp { brief: string; }

const TABS = ['Overview', 'Score Trends', 'Key Drivers', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

function KpiCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-gray-800'}`}>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function CtCsatPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtCsatData | null>(null);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-csat').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'Score Trends' && trends.length === 0) {
      setTrendsLoading(true);
      fetch('/api/admin/ct-csat/trends').then(r => r.json()).then(d => setTrends(d.trends ?? d ?? [])).finally(() => setTrendsLoading(false));
    }
    if (tab === 'Key Drivers' && drivers.length === 0) {
      setDriversLoading(true);
      fetch('/api/admin/ct-csat/drivers').then(r => r.json()).then(d => setDrivers(d.drivers ?? d ?? [])).finally(() => setDriversLoading(false));
    }
  }, [tab, trends.length, drivers.length]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-csat/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, avg_csat: data.avg_csat, avg_nps: data.avg_nps, promoters_pct: data.promoters_pct, detractors_pct: data.detractors_pct }),
      });
      const j: AdvisorResp = await res.json();
      setBrief(j.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';
  const responseRate = data ? Math.round((data.total_responses / Math.max(data.total_responses, 1)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header + Traffic Light */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CSAT &amp; NPS Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Customer Satisfaction · Net Promoter Score · Sentiment Health</p>
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

        {/* Alerts */}
        {(data?.alerts ?? []).length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Active Alerts</h3>
            <ul className="space-y-1">
              {data!.alerts.map((a, i) => <li key={i} className="text-yellow-700 text-sm">⚠️ {a}</li>)}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="CSAT Score" value={data?.avg_csat?.toFixed(1) ?? '--'} unit="/5" color="text-indigo-600" />
              <KpiCard label="NPS Score" value={data?.avg_nps?.toFixed(0) ?? '--'} color={Number(data?.avg_nps) >= 30 ? 'text-emerald-600' : 'text-red-600'} />
              <KpiCard label="Total Responses" value={data?.total_responses ?? 0} />
              <KpiCard label="Promoters" value={`${data?.promoters_pct?.toFixed(0) ?? 0}%`} color="text-emerald-600" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Promoters</p>
                <p className="text-4xl font-bold text-emerald-600">{data?.promoters_pct?.toFixed(1) ?? 0}%</p>
                <p className="text-xs text-gray-400 mt-1">Score 9-10</p>
              </div>
              <div className="bg-white rounded-xl border p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Passives</p>
                <p className="text-4xl font-bold text-amber-500">{data?.passives_pct?.toFixed(1) ?? 0}%</p>
                <p className="text-xs text-gray-400 mt-1">Score 7-8</p>
              </div>
              <div className="bg-white rounded-xl border p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Detractors</p>
                <p className="text-4xl font-bold text-red-600">{data?.detractors_pct?.toFixed(1) ?? 0}%</p>
                <p className="text-xs text-gray-400 mt-1">Score 0-6</p>
              </div>
            </div>
            {data?.updated_at && <p className="text-xs text-gray-400">Last updated: {new Date(data.updated_at).toLocaleString()}</p>}
          </div>
        )}

        {/* Score Trends */}
        {tab === 'Score Trends' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">CSAT &amp; NPS Over Time</h2>
            {trendsLoading
              ? <p className="text-sm text-gray-400">Loading trends…</p>
              : trends.length === 0
                ? <p className="text-sm text-gray-400">No trend data available.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Period</th><th className="pb-2">Avg CSAT</th><th className="pb-2">Avg NPS</th><th className="pb-2">Responses</th>
                    </tr></thead>
                    <tbody>
                      {trends.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800">{r.period}</td>
                          <td className="py-2 text-indigo-600 font-semibold">{Number(r.avg_csat).toFixed(1)}</td>
                          <td className="py-2">{Number(r.avg_nps).toFixed(0)}</td>
                          <td className="py-2 text-gray-500">{r.responses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* Key Drivers */}
        {tab === 'Key Drivers' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Key Satisfaction Drivers</h2>
            {driversLoading
              ? <p className="text-sm text-gray-400">Loading drivers…</p>
              : drivers.length === 0
                ? <p className="text-sm text-gray-400">No driver data available.</p>
                : <div className="space-y-3">
                    {drivers.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium text-gray-800">{d.driver}</p>
                          <p className="text-xs text-gray-400">{d.impact}</p>
                        </div>
                        <span className={`text-lg font-bold ${Number(d.score) >= 4 ? 'text-emerald-600' : Number(d.score) >= 3 ? 'text-amber-500' : 'text-red-600'}`}>
                          {Number(d.score).toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
            }
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI CSAT Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Satisfaction insights · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered CSAT &amp; NPS health analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
