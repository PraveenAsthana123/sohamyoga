'use client';
import { useEffect, useState, useCallback } from 'react';

interface Kpi { label: string; value: number | string; target: number; trend: 'up' | 'down'; unit: string; }
interface Alert { id: number; title: string; severity: string; message: string; created_at: string; }
interface PorterRow { id: number; created_at: string; insights?: string; }
interface ScoutRow { id: number; technology_name?: string; description?: string; created_at: string; }
interface CtData {
  health_score: number; traffic_light: 'red' | 'yellow' | 'green';
  kpis: Kpi[]; alerts: Alert[];
  porter_analyses: PorterRow[]; tech_scouts: ScoutRow[];
  updated_at: string;
}

const TABS = ['Overview', 'Intelligence Feed', 'Competitor Watch', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800', warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800',
};
const TL_COLOR = { red: 'text-red-500', yellow: 'text-amber-500', green: 'text-emerald-500' };
const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };

function HealthGauge({ score, light }: { score: number; light: 'red' | 'yellow' | 'green' }) {
  const color = light === 'green' ? '#10b981' : light === 'yellow' ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 157} 157`} />
      </svg>
      <p className="text-3xl font-bold -mt-4" style={{ color }}>{score}</p>
      <p className="text-xs text-gray-500 mt-1">Health Score / 100</p>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const pct = typeof kpi.value === 'number' && kpi.target > 0 ? Math.min(100, Math.round((kpi.value / kpi.target) * 100)) : null;
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
      <p className="text-2xl font-bold mt-1">{kpi.value} <span className="text-sm text-gray-400">{kpi.unit}</span></p>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
          {kpi.trend === 'up' ? '▲' : '▼'} Target: {kpi.target}
        </span>
        {pct !== null && <span className="text-xs text-gray-400">{pct}%</span>}
      </div>
    </div>
  );
}

export default function CtMarketResearchPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ct-market-research');
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true);
    setBrief('');
    try {
      const res = await fetch('/api/admin/ct-market-research/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, kpis: data.kpis, alerts: data.alerts }),
      });
      const json = await res.json();
      setBrief(json.brief ?? '');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading Market Research Control Tower…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Market Research Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Porter analyses · Technology scouting · Competitor intelligence</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-4xl ${TL_COLOR[tl]}`}>{tl === 'green' ? '🟢' : tl === 'yellow' ? '🟡' : '🔴'}</span>
              <div className="text-right">
                <p className="text-3xl font-bold">{data?.health_score ?? 0}<span className="text-base font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-400">Health Score</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Last updated</p>
                <p>{data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-1"><HealthGauge score={data?.health_score ?? 0} light={tl} /></div>
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {(data?.kpis ?? []).map(k => <KpiCard key={k.label} kpi={k} />)}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Open Alerts</h2>
              {(data?.alerts ?? []).length === 0
                ? <p className="text-sm text-gray-400 bg-white rounded-xl border p-4">No open alerts.</p>
                : <div className="space-y-2">
                    {(data?.alerts ?? []).map(a => (
                      <div key={a.id} className="bg-white rounded-xl border p-4 flex gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold self-start ${SEV_COLOR[a.severity] ?? SEV_COLOR.info}`}>{a.severity}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}

        {/* Intelligence Feed */}
        {tab === 'Intelligence Feed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Porter Analyses</h2>
              {(data?.porter_analyses ?? []).length === 0
                ? <p className="text-sm text-gray-400">No Porter analyses found.</p>
                : <ul className="space-y-2">
                    {(data?.porter_analyses ?? []).map(p => (
                      <li key={p.id} className="border rounded-lg p-3">
                        <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{p.insights ?? 'Analysis available — click to view'}</p>
                      </li>
                    ))}
                  </ul>
              }
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Technology Scouts</h2>
              {(data?.tech_scouts ?? []).length === 0
                ? <p className="text-sm text-gray-400">No technology scouts found.</p>
                : <ul className="space-y-2">
                    {(data?.tech_scouts ?? []).map(s => (
                      <li key={s.id} className="border rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-800">{s.technology_name ?? 'Technology'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(s.created_at).toLocaleDateString()}</p>
                      </li>
                    ))}
                  </ul>
              }
            </div>
          </div>
        )}

        {/* Competitor Watch */}
        {tab === 'Competitor Watch' && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Competitor Intelligence</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Competitor A', 'Competitor B', 'Competitor C'].map((name, i) => (
                <div key={name} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-800">{name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i === 0 ? 'bg-red-100 text-red-700' : i === 1 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {i === 0 ? 'High Risk' : i === 1 ? 'Watch' : 'Stable'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Last activity: {i === 0 ? '2 days ago' : i === 1 ? '1 week ago' : '3 weeks ago'}</p>
                  <p className="text-xs text-gray-600 mt-2">{i === 0 ? 'Dropped pricing 15% · launched AI feature' : i === 1 ? 'New partnership announced' : 'No significant changes detected'}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">Connect competitor_analysis table to populate live data.</p>
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Strategic Brief</h2>
                <p className="text-xs text-gray-400 mt-0.5">Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Generating…' : 'Generate Brief'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Brief" to get an AI-powered market intelligence analysis based on current health data.</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
