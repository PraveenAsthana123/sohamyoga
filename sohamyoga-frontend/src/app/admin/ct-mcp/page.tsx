'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtMcpData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  connected_servers: number;
  active_tools: number;
  total_calls: number;
  error_rate: number;
  alerts: string[];
  updated_at: string;
}

interface ServerRow { id: number; name: string; url: string; status: 'connected' | 'disconnected' | 'error'; tools_count: number; last_ping: string | null; latency_ms: number; }
interface ToolRow { id: number; name: string; server_name: string; description: string; calls_today: number; error_rate: number; enabled: boolean; }

const TABS = ['Overview', 'Server Status', 'Tool Registry', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const SERVER_STATUS_COLOR: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-800',
  disconnected: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-800',
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

export default function CtMcpPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtMcpData | null>(null);
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-mcp').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'Server Status' && servers.length === 0) {
      setServersLoading(true);
      fetch('/api/admin/ct-mcp/servers').then(r => r.json()).then(d => setServers(d.servers ?? d ?? [])).finally(() => setServersLoading(false));
    }
    if (tab === 'Tool Registry' && tools.length === 0) {
      setToolsLoading(true);
      fetch('/api/admin/ct-mcp/tools').then(r => r.json()).then(d => setTools(d.tools ?? d ?? [])).finally(() => setToolsLoading(false));
    }
  }, [tab, servers.length, tools.length]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-mcp/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, connected_servers: data.connected_servers, active_tools: data.active_tools, total_calls: data.total_calls, error_rate: data.error_rate }),
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
              <h1 className="text-2xl font-bold text-gray-900">MCP Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Model Context Protocol · Server Connections · Tool Registry · Call Monitoring</p>
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
              <KpiCard label="Connected Servers" value={data?.connected_servers ?? 0} color="text-indigo-600" />
              <KpiCard label="Active Tools" value={data?.active_tools ?? 0} color="text-emerald-600" />
              <KpiCard label="Total Calls" value={data?.total_calls ?? 0} />
              <KpiCard label="Error Rate" value={`${Number(data?.error_rate ?? 0).toFixed(1)}%`} color={Number(data?.error_rate) < 5 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">MCP Infrastructure Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Protocol Version</span>
                    <span className="text-sm font-semibold text-gray-800">MCP 1.0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Connected Servers</span>
                    <span className="text-sm font-semibold text-emerald-600">{data?.connected_servers ?? 0} active</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Registered Tools</span>
                    <span className="text-sm font-semibold text-gray-800">{data?.active_tools ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Call Success Rate</span>
                    <span className={`text-sm font-semibold ${Number(data?.error_rate) < 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {(100 - Number(data?.error_rate ?? 0)).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Call Volume</h2>
                <div className="text-center py-2">
                  <p className="text-5xl font-bold text-indigo-600">{data?.total_calls ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-2">Total tool calls</p>
                  <div className="mt-4 flex gap-4 justify-center text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {(100 - Number(data?.error_rate ?? 0)).toFixed(0)}% success</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {Number(data?.error_rate ?? 0).toFixed(0)}% errors</span>
                  </div>
                </div>
              </div>
            </div>
            {data?.updated_at && <p className="text-xs text-gray-400">Last updated: {new Date(data.updated_at).toLocaleString()}</p>}
          </div>
        )}

        {/* Server Status */}
        {tab === 'Server Status' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">MCP Server Connections</h2>
            {serversLoading
              ? <p className="text-sm text-gray-400">Loading servers…</p>
              : servers.length === 0
                ? <p className="text-sm text-gray-400">No MCP servers configured.</p>
                : <div className="space-y-3">
                    {servers.map(s => (
                      <div key={s.id} className="border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SERVER_STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-700'}`}>{s.status}</span>
                            <span className="font-medium text-gray-800">{s.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500">{s.tools_count} tools</span>
                            {s.latency_ms > 0 && <span className="text-xs text-gray-400 ml-3">{s.latency_ms}ms</span>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 font-mono">{s.url}</p>
                        {s.last_ping && <p className="text-xs text-gray-300 mt-1">Last ping: {new Date(s.last_ping).toLocaleString()}</p>}
                      </div>
                    ))}
                  </div>
            }
          </div>
        )}

        {/* Tool Registry */}
        {tab === 'Tool Registry' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Registered MCP Tools</h2>
            {toolsLoading
              ? <p className="text-sm text-gray-400">Loading tools…</p>
              : tools.length === 0
                ? <p className="text-sm text-gray-400">No tools registered.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Tool Name</th><th className="pb-2">Server</th><th className="pb-2">Description</th><th className="pb-2">Calls Today</th><th className="pb-2">Error Rate</th><th className="pb-2">Status</th>
                    </tr></thead>
                    <tbody>
                      {tools.map(t => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800 font-mono text-xs">{t.name}</td>
                          <td className="py-2 text-gray-500 text-xs">{t.server_name}</td>
                          <td className="py-2 text-gray-500 text-xs max-w-xs truncate">{t.description}</td>
                          <td className="py-2 text-gray-600">{t.calls_today}</td>
                          <td className="py-2">
                            <span className={t.error_rate < 5 ? 'text-emerald-600' : t.error_rate < 15 ? 'text-amber-600' : 'text-red-600 font-semibold'}>
                              {Number(t.error_rate).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                              {t.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
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
                <h2 className="text-sm font-semibold text-gray-700">AI MCP Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">MCP infrastructure analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered MCP health analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
