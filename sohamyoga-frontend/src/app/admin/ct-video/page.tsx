'use client';
import { useEffect, useState, useCallback } from 'react';

interface Kpi { label: string; value: number | string; target: number; trend: 'up' | 'down'; unit: string; }
interface Job { type: string; id: string; status: string; created_at: string; }
interface Completed { id: string; status: string; updated_at: string; }
interface CtData {
  health_score: number; traffic_light: 'red' | 'yellow' | 'green';
  kpis: Kpi[]; active_jobs: Job[]; completed: Completed[]; updated_at: string;
}

const TABS = ['Overview', 'Production Pipeline', 'Output Library', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const STATUS_COLOR: Record<string, string> = {
  done: 'bg-green-100 text-green-800', queued: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-800', failed: 'bg-red-100 text-red-800',
};
const TYPE_COLOR: Record<string, string> = {
  post_production: 'bg-purple-100 text-purple-800', repurpose: 'bg-cyan-100 text-cyan-800',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
      <p className="text-2xl font-bold mt-1">{kpi.value} <span className="text-sm text-gray-400">{kpi.unit}</span></p>
      <p className={`text-xs mt-2 font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
        {kpi.trend === 'up' ? '▲' : '▼'} Target: {kpi.target}
      </p>
    </div>
  );
}

export default function CtVideoPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ct-video');
      setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-video/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, kpis: data.kpis }),
      });
      setBrief((await res.json()).brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Video Production Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Scripts · Storyboards · Post-production · Animation · Repurposing</p>
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

        <div className="flex gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(data?.kpis ?? []).map(k => <KpiCard key={k.label} kpi={k} />)}
            </div>
          </div>
        )}

        {tab === 'Production Pipeline' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Active Jobs</h2>
            {(data?.active_jobs ?? []).length === 0
              ? <p className="text-sm text-gray-400">No active production jobs. Queue is empty.</p>
              : <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2">Type</th><th className="pb-2">Job ID</th><th className="pb-2">Status</th><th className="pb-2">Created</th>
                  </tr></thead>
                  <tbody>
                    {(data?.active_jobs ?? []).map((j, i) => (
                      <tr key={`${j.id}-${i}`} className="border-b last:border-0">
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[j.type] ?? 'bg-gray-100 text-gray-700'}`}>{j.type.replace('_', ' ')}</span></td>
                        <td className="py-2 text-gray-600 font-mono text-xs">#{j.id}</td>
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-700'}`}>{j.status}</span></td>
                        <td className="py-2 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}

        {tab === 'Output Library' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Recently Completed</h2>
            {(data?.completed ?? []).length === 0
              ? <p className="text-sm text-gray-400">No completed videos yet.</p>
              : <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(data?.completed ?? []).map(c => (
                    <div key={c.id} className="border rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">Job #{c.id}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-700'}`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Completed: {new Date(c.updated_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Production Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bottleneck analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Generating…' : 'Generate Analysis'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Analysis" to get AI-powered production insights.</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
