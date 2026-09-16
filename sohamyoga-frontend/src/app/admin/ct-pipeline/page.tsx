'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtPipelineData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  total_jobs: number;
  healthy_jobs: number;
  failed_jobs: number;
  alerts: string[];
  updated_at: string;
}

interface JobMetric {
  name: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  last_run: string | null;
  duration_ms: number;
  success_rate: number;
  run_count: number;
}

interface PingResult { job: string; status: string; message: string; latency_ms: number; }

const TABS = ['Overview', 'Job Metrics', 'Ping Job', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const STATUS_COLOR: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-800',
  degraded: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-700',
};

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

export default function CtPipelinePage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtPipelineData | null>(null);
  const [metrics, setMetrics] = useState<JobMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [pingJob, setPingJob] = useState('');
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-pipeline').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'Job Metrics' && metrics.length === 0) {
      setMetricsLoading(true);
      fetch('/api/admin/ct-pipeline/metrics').then(r => r.json()).then(d => setMetrics(d.jobs ?? d ?? [])).finally(() => setMetricsLoading(false));
    }
  }, [tab, metrics.length]);

  const runPing = async () => {
    if (!pingJob.trim()) return;
    setPinging(true); setPingResult(null);
    try {
      const res = await fetch(`/api/admin/ct-pipeline/${encodeURIComponent(pingJob.trim())}/ping`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setPingResult(await res.json());
    } finally { setPinging(false); }
  };

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-pipeline/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, total_jobs: data.total_jobs, healthy_jobs: data.healthy_jobs, failed_jobs: data.failed_jobs }),
      });
      const j = await res.json();
      setBrief(j.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';
  const uptimePct = data && data.total_jobs > 0 ? ((data.healthy_jobs / data.total_jobs) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header + Traffic Light */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipeline &amp; Jobs Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Cron Jobs · Scheduled Tasks · Pipeline Health · Uptime Monitoring</p>
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Jobs" value={data?.total_jobs ?? 0} />
              <KpiCard label="Healthy" value={data?.healthy_jobs ?? 0} color="text-emerald-600" />
              <KpiCard label="Failed" value={data?.failed_jobs ?? 0} color={Number(data?.failed_jobs) > 0 ? 'text-red-600' : 'text-gray-800'} />
              <KpiCard label="Uptime %" value={`${uptimePct}%`} color={Number(uptimePct) >= 90 ? 'text-emerald-600' : 'text-amber-600'} />
            </div>
            {/* Mini status bar */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Status Overview</h2>
              <div className="flex gap-2 mb-3">
                <div className="h-4 rounded-full bg-emerald-500 transition-all" style={{ width: `${uptimePct}%`, minWidth: '4px' }} />
                <div className="h-4 rounded-full bg-red-400 flex-1" />
              </div>
              <div className="flex gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {data?.healthy_jobs} healthy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {data?.failed_jobs} failed</span>
              </div>
            </div>
          </div>
        )}

        {/* Job Metrics */}
        {tab === 'Job Metrics' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Job Performance Metrics</h2>
            {metricsLoading
              ? <p className="text-sm text-gray-400">Loading metrics…</p>
              : metrics.length === 0
                ? <p className="text-sm text-gray-400">No job metrics available.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Job Name</th><th className="pb-2">Status</th><th className="pb-2">Last Run</th><th className="pb-2">Avg Duration</th><th className="pb-2">Success Rate</th><th className="pb-2">Runs</th>
                    </tr></thead>
                    <tbody>
                      {metrics.map(m => (
                        <tr key={m.name} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800 font-mono text-xs">{m.name}</td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[m.status] ?? 'bg-gray-100 text-gray-700'}`}>{m.status}</span></td>
                          <td className="py-2 text-gray-400 text-xs">{m.last_run ? new Date(m.last_run).toLocaleString() : 'Never'}</td>
                          <td className="py-2 text-gray-600">{m.duration_ms}ms</td>
                          <td className="py-2">
                            <span className={m.success_rate >= 90 ? 'text-emerald-600 font-semibold' : m.success_rate >= 70 ? 'text-amber-600' : 'text-red-600 font-semibold'}>
                              {m.success_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 text-gray-500">{m.run_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* Ping Job */}
        {tab === 'Ping Job' && (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Ping a Job</h2>
            <div className="flex gap-3">
              <input
                value={pingJob}
                onChange={e => setPingJob(e.target.value)}
                placeholder="Job name, e.g. PostizSocialAutoPublishJob"
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={runPing} disabled={pinging || !pingJob.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {pinging ? 'Pinging…' : 'Ping'}
              </button>
            </div>
            {pingResult && (
              <div className={`rounded-xl border p-5 ${pingResult.status === 'ok' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{pingResult.status === 'ok' ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{pingResult.job}</p>
                    <p className="text-xs text-gray-500">Latency: {pingResult.latency_ms}ms · Status: {pingResult.status}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{pingResult.message}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Pipeline Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Job health analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered pipeline health analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
