'use client';
// /admin/mcp-gateway — the real MCP tool catalog (29 domain servers: 15
// internal + 14 external-platform), previously pure TypeScript domain code
// with a real Postgres schema and zero UI anywhere in the app. Two tools
// (github.search_repositories, stackoverflow.search_questions) are wired
// to real, working public APIs. Everything else is a real, well-defined
// tool manifest that honestly reports "not connected" when credentials
// aren't configured, rather than faking success.
//
// Restructured 2026-09-01 into Dashboard/Integrations/Bot Console/Reports
// tabs (Operational Portal Page & Tab Standard). The execute route now
// logs every real call to mcp_tool_call -- previously nothing was ever
// logged, so no report was possible.

import { useEffect, useState } from 'react';

interface Tool {
  name: string; description: string; tier: string; riskLevel: number;
  safetyNote?: string; tags?: string[]; executable: boolean;
}
interface Server {
  id: string; name: string; description: string; availability: string;
  backingServices: string[]; implementationNote?: string; tools: Tool[];
}
interface CallRow { tool_name: string; tier: string; status: string; duration_ms: number | null; error_message: string | null; created_at: string; server_name: string }
interface Catalog {
  summary: { serverCount: number; totalTools: number; approvalRequiredTools: number; highRiskToolCount: number };
  servers: Server[];
  recentCalls: CallRow[];
  callStats: Record<string, number>;
}

const TIER_STYLE: Record<string, string> = {
  auto: 'bg-green-100 text-green-700', staff: 'bg-blue-100 text-blue-700',
  customer_confirm: 'bg-cyan-100 text-cyan-700', staff_approval: 'bg-amber-100 text-amber-700',
  admin: 'bg-orange-100 text-orange-700', admin_destructive: 'bg-red-100 text-red-700',
};
const AVAILABILITY_STYLE: Record<string, string> = {
  official: 'bg-indigo-100 text-indigo-700', community: 'bg-purple-100 text-purple-700',
  custom: 'bg-teal-100 text-teal-700', none: 'bg-gray-100 text-gray-500',
};
const STATUS_STYLE: Record<string, string> = {
  success: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500', timeout: 'bg-amber-100 text-amber-700',
};
const TABS = ['Dashboard', 'Integrations', 'Bot Console', 'Reports'] as const;

export default function McpGatewayPage() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [filter, setFilter] = useState<'all' | 'external'>('all');
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [botQuery, setBotQuery] = useState('');
  const [botTool, setBotTool] = useState('');
  const [botLog, setBotLog] = useState<Array<{ role: 'user' | 'tool'; text: string }>>([]);

  const load = () => {
    fetch('/api/admin/mcp-gateway', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  };
  useEffect(load, []);

  const executableTools = data?.servers.flatMap(s => s.tools.filter(t => t.executable && t.tier === 'auto').map(t => ({ server: s, tool: t }))) ?? [];

  const runTool = async (server: Server, tool: Tool, queryText: string) => {
    setRunning(tool.name);
    try {
      const res = await fetch('/api/admin/mcp-gateway/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverSlug: server.id, toolName: tool.name, args: { query: queryText } }),
      });
      const body = await res.json();
      setResults(prev => ({ ...prev, [tool.name]: body }));
      return body;
    } finally {
      setRunning(null);
    }
  };

  const sendToBotConsole = async () => {
    if (!botQuery.trim() || !botTool) return;
    const match = executableTools.find(x => x.tool.name === botTool);
    if (!match) return;
    setBotLog(prev => [...prev, { role: 'user', text: botQuery }]);
    const q = botQuery;
    setBotQuery('');
    const result = await runTool(match.server, match.tool, q);
    setBotLog(prev => [...prev, { role: 'tool', text: JSON.stringify(result, null, 2) }]);
    load();
  };

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const servers = filter === 'external'
    ? data.servers.filter(s => s.id.endsWith('-mcp') && !['social-mcp', 'booking-mcp', 'customer-mcp', 'teacher-mcp', 'learning-mcp', 'marketing-mcp', 'finance-mcp', 'content-mcp', 'analytics-mcp', 'workflow-mcp', 'knowledge-mcp', 'admin-mcp', 'student-mcp', 'notification-mcp', 'campaign-mcp'].includes(s.id))
    : data.servers;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">MCP Gateway</h1>
        <p className="text-sm text-gray-500">
          {data.summary.serverCount} servers · {data.summary.totalTools} tools · {data.summary.approvalRequiredTools} require human approval · {data.summary.highRiskToolCount} high-risk
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Total Tools" value={data.summary.totalTools} />
            <Stat label="Executable Now" value={executableTools.length} />
            <Stat label="Approval Required" value={data.summary.approvalRequiredTools} />
            <Stat label="High Risk" value={data.summary.highRiskToolCount} />
          </div>
          <div className="app-card">
            <h2 className="mb-3 font-semibold text-gray-800">Real call outcomes (all time)</h2>
            {Object.keys(data.callStats).length ? (
              <div className="flex gap-3">
                {Object.entries(data.callStats).map(([status, count]) => (
                  <span key={status} className={`rounded-full px-3 py-1 text-sm ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}: {count}</span>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No tool has been called yet — try one from the Bot Console tab.</p>}
          </div>
        </div>
      )}

      {tab === 'Integrations' && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
            {(['all', 'external'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {f === 'external' ? 'External Platforms (14)' : 'All Servers'}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {servers.map(server => (
              <div key={server.id} className="rounded-xl border bg-white p-5">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="font-semibold text-gray-800">{server.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AVAILABILITY_STYLE[server.availability] ?? ''}`}>{server.availability}</span>
                </div>
                <p className="mb-2 text-sm text-gray-500">{server.description}</p>
                {server.implementationNote && <p className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-400">{server.implementationNote}</p>}
                {server.tools.length === 0 ? (
                  <p className="text-xs italic text-gray-400">No tools — see note above.</p>
                ) : (
                  <div className="space-y-2">
                    {server.tools.map(tool => (
                      <div key={tool.name} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-800">{tool.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tool.tier] ?? ''}`}>{tool.tier.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-gray-400">risk {tool.riskLevel}/5</span>
                            {tool.executable && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">real &amp; executable</span>}
                          </div>
                          <p className="mt-1 text-xs text-gray-600">{tool.description}</p>
                          {tool.safetyNote && <p className="mt-1 text-xs text-amber-700">⚠ {tool.safetyNote}</p>}
                          {results[tool.name] !== undefined ? (
                            <pre className="mt-2 max-h-40 overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(results[tool.name], null, 2)}</pre>
                          ) : null}
                        </div>
                        {tool.executable && tool.tier === 'auto' && (
                          <button
                            disabled={running === tool.name}
                            onClick={() => runTool(server, tool, tool.name.includes('question') ? 'yoga studio management software' : 'yoga studio management').then(load)}
                            className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {running === tool.name ? 'Running…' : 'Try it'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Bot Console' && (
        <div className="app-card space-y-3">
          <h2 className="font-semibold text-gray-800">Try a real, executable tool</h2>
          <p className="text-xs text-gray-500">Only tools with a genuine working implementation (no credentials needed) are offered here — everything else honestly requires configuration this environment doesn't have.</p>
          <select className="w-full rounded border p-2 text-sm" value={botTool} onChange={e => setBotTool(e.target.value)}>
            <option value="">Select a tool…</option>
            {executableTools.map(({ tool }) => <option key={tool.name} value={tool.name}>{tool.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border p-2 text-sm" placeholder="Type a query…" value={botQuery}
              onChange={e => setBotQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendToBotConsole()}
            />
            <button onClick={sendToBotConsole} disabled={!botTool || !botQuery.trim() || running !== null} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Send</button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-dashed p-3">
            {botLog.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <pre className={`inline-block max-w-full whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-xs ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.text}</pre>
              </div>
            ))}
            {!botLog.length && <p className="text-sm text-gray-400">No calls yet — pick a tool and send a query.</p>}
          </div>
        </div>
      )}

      {tab === 'Reports' && (
        <div className="app-card">
          <h2 className="mb-3 font-semibold text-gray-800">Real call history ({data.recentCalls.length})</h2>
          <div className="space-y-1">
            {data.recentCalls.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-gray-100 p-2 text-sm">
                <div>
                  <span className="font-mono text-xs font-medium">{c.tool_name}</span>
                  <span className="ml-2 text-xs text-gray-400">{c.server_name} · {new Date(c.created_at).toLocaleString()}{c.duration_ms !== null ? ` · ${c.duration_ms}ms` : ''}</span>
                  {c.error_message && <p className="mt-0.5 text-xs text-red-600">{c.error_message}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
              </div>
            ))}
            {!data.recentCalls.length && <p className="text-sm text-gray-400">No tool calls logged yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
