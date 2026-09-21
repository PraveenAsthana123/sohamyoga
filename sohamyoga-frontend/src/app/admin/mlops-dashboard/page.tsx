'use client';

import { useEffect, useState } from 'react';

interface MlModel { id: number; model_name: string; model_type: string | null; version: string | null; accuracy: number | null; f1_score: number | null; training_date: string | null; last_evaluated: string | null; drift_score: number; status: string; champion: boolean; created_at: string; }
interface ModelMetric { id: number; model_name?: string; metric_name: string | null; metric_value: number | null; recorded_at: string; }
interface Summary { totalModels: number; championModels: number; driftAlerts: number; }
interface ApiData { models: MlModel[]; metrics: ModelMetric[]; summary: Summary; }

const TABS = ['Model Registry', 'Metrics', 'Drift Alerts', 'AI Analysis'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function pct(n: number | null | undefined) { return n != null ? `${(Number(n) * 100).toFixed(1)}%` : '—'; }
function badge(s: string) {
  if (s === 'production') return 'bg-green-100 text-green-800';
  if (s === 'staging') return 'bg-blue-100 text-blue-800';
  if (s === 'retired') return 'bg-gray-100 text-gray-600';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function MlopsDashboardPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Model Registry');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/mlops-dashboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  async function generateAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: `As an MLOps expert, analyze this model performance issue and suggest remediation: ${aiPrompt}`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { models, metrics, summary } = data;
  const driftModels = models.filter(m => Number(m.drift_score ?? 0) > 0.1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm">ML</div>
        <div><h1 className="text-2xl font-bold text-gray-900">MLOps Dashboard</h1><p className="text-sm text-gray-500">Model registry, drift detection, champion/challenger</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Models Registered" value={fmtNum(summary.totalModels)} color="text-gray-900" />
        <KpiCard label="Champions" value={fmtNum(summary.championModels)} color="text-violet-700" />
        <KpiCard label="Drift Alerts" value={fmtNum(summary.driftAlerts)} color={summary.driftAlerts > 0 ? 'text-red-600' : 'text-green-700'} />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Model Registry' && (
          <div className="overflow-x-auto">
            {models.length === 0 ? <Empty msg="No models registered yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Model', 'Type', 'Version', 'Accuracy', 'F1', 'Drift', 'Champion', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {models.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.model_name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.model_type ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{m.version ?? '—'}</td>
                      <td className="px-4 py-3">{pct(m.accuracy)}</td>
                      <td className="px-4 py-3">{pct(m.f1_score)}</td>
                      <td className="px-4 py-3"><span className={Number(m.drift_score ?? 0) > 0.1 ? 'text-red-600 font-medium' : 'text-green-600'}>{pct(m.drift_score)}</span></td>
                      <td className="px-4 py-3">{m.champion ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">Champion</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(m.status)}`}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Metrics' && (
          <div className="overflow-x-auto">
            {metrics.length === 0 ? <Empty msg="No metrics recorded yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Model', 'Metric', 'Value', 'Recorded'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {metrics.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{m.model_name ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{m.metric_name ?? '—'}</td>
                      <td className="px-4 py-3">{m.metric_value != null ? Number(m.metric_value).toFixed(4) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(m.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Drift Alerts' && (
          <div className="p-6 space-y-3">
            {driftModels.length === 0
              ? <div className="py-12 text-center text-green-600"><p className="text-2xl mb-2">✓</p><p className="font-medium">No drift alerts — all models within threshold</p></div>
              : driftModels.map(m => (
                <div key={m.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-900">{m.model_name} <span className="text-xs font-normal">v{m.version}</span></p>
                    <p className="text-sm text-red-700">Drift score: {pct(m.drift_score)} (threshold: 10%)</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(m.status)}`}>{m.status}</span>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'AI Analysis' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI MLOps Analysis</h2>
            <p className="text-sm text-gray-500">Describe a model performance concern for AI-powered diagnosis.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Describe the issue (e.g. 'recommendation model accuracy dropped from 87% to 72% after new product catalog update')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Analysis</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
