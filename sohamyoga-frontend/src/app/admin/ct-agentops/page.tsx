'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtAgentopsData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  active_agents: number;
  total_runs: number;
  success_rate: number;
  avg_latency_ms: number;
  alerts: string[];
  updated_at: string;
}

interface AgentRow { id: number; name: string; type: string; status: 'active' | 'idle' | 'error' | 'stopped'; last_run: string | null; runs_today: number; success_rate: number; }
interface RunRow { id: number; agent_name: string; status: 'success' | 'failed' | 'running'; duration_ms: number; started_at: string; input_summary: string; }

const TABS = ['Overview', 'Agents', 'Run History', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const AGENT_STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  idle: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-800',
  stopped: 'bg-slate-100 text-slate-600',
};

const RUN_STATUS_COLOR: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
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

export default function CtAgentopsPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtAgentopsData | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-agentops').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'Agents' && agents.length === 0) {
      setAgentsLoading(true);
      fetch('/api/admin/ct-agentops/agents').then(r => r.json()).then(d => setAgents(d.agents ?? d ?? [])).finally(() => setAgentsLoading(false));
    }
    if (tab === 'Run History' && runs.length === 0) {
      setRunsLoading(true);
      fetch('/api/admin/ct-agentops/runs').then(r => r.json()).then(d => setRuns(d.runs ?? d ?? [])).finally(() => setRunsLoading(false));
    }
  }, [tab, agents.length, runs.length]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-agentops/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, active_agents: data.active_agents, total_runs: data.total_runs, success_rate: data.success_rate, avg_latency_ms: data.avg_latency_ms }),
      });
      const j = await res.json();
      setBrief(j.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header + Traffic Light */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AgentOps Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">AI Agent Monitoring · Run History · Success Rate · Latency Tracking</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Active Agents" value={data?.active_agents ?? 0} color="text-indigo-600" />
            <KpiCard label="Total Runs" value={data?.total_runs ?? 0} />
            <KpiCard label="Success Rate" value={`${Number(data?.success_rate ?? 0).toFixed(1)}%`} color={Number(data?.success_rate) >= 90 ? 'text-emerald-600' : 'text-amber-600'} />
            <KpiCard label="Avg Latency" value={data?.avg_latency_ms ?? 0} unit="ms" color={Number(data?.avg_latency_ms) < 2000 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
        )}

        {/* Agents */}
        {tab === 'Agents' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Registered Agents</h2>
            {agentsLoading
              ? <p className="text-sm text-gray-400">Loading agents…</p>
              : agents.length === 0
                ? <p className="text-sm text-gray-400">No agents registered.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Agent</th><th className="pb-2">Type</th><th className="pb-2">Status</th><th className="pb-2">Last Run</th><th className="pb-2">Runs Today</th><th className="pb-2">Success Rate</th>
                    </tr></thead>
                    <tbody>
                      {agents.map(a => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800">{a.name}</td>
                          <td className="py-2 text-gray-500 text-xs">{a.type}</td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AGENT_STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-700'}`}>{a.status}</span></td>
                          <td className="py-2 text-gray-400 text-xs">{a.last_run ? new Date(a.last_run).toLocaleString() : 'Never'}</td>
                          <td className="py-2 text-gray-600">{a.runs_today}</td>
                          <td className="py-2">
                            <span className={a.success_rate >= 90 ? 'text-emerald-600 font-semibold' : a.success_rate >= 70 ? 'text-amber-600' : 'text-red-600 font-semibold'}>
                              {Number(a.success_rate).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* Run History */}
        {tab === 'Run History' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Agent Runs</h2>
            {runsLoading
              ? <p className="text-sm text-gray-400">Loading run history…</p>
              : runs.length === 0
                ? <p className="text-sm text-gray-400">No run history available.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Agent</th><th className="pb-2">Status</th><th className="pb-2">Duration</th><th className="pb-2">Started</th><th className="pb-2">Input</th>
                    </tr></thead>
                    <tbody>
                      {runs.map(r => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800">{r.agent_name}</td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RUN_STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.status}</span></td>
                          <td className="py-2 text-gray-600">{r.duration_ms}ms</td>
                          <td className="py-2 text-gray-400 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                          <td className="py-2 text-gray-500 text-xs truncate max-w-xs">{r.input_summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI AgentOps Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Agent performance analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered agent operations health analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
