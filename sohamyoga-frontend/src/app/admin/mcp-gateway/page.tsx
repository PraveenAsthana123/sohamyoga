'use client';
// /admin/mcp-gateway — the real MCP tool catalog (29 domain servers: 15
// internal + 14 external-platform), previously pure TypeScript domain code
// with a real Postgres schema and zero UI anywhere in the app. Two tools
// (github.search_repositories, stackoverflow.search_questions) are wired
// to real, working public APIs — try them below. Everything else is a
// real, well-defined tool manifest that honestly reports "not connected"
// when credentials aren't configured, rather than faking success.

import { useEffect, useState } from 'react';

interface Tool {
  name: string; description: string; tier: string; riskLevel: number;
  safetyNote?: string; tags?: string[]; executable: boolean;
}
interface Server {
  id: string; name: string; description: string; availability: string;
  backingServices: string[]; implementationNote?: string; tools: Tool[];
}
interface Catalog {
  summary: { serverCount: number; totalTools: number; approvalRequiredTools: number; highRiskToolCount: number };
  servers: Server[];
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

export default function McpGatewayPage() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'external'>('all');
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetch('/api/admin/mcp-gateway', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  const runTool = async (server: Server, tool: Tool) => {
    setRunning(tool.name);
    try {
      const query = tool.name.includes('question') ? 'yoga studio management software' : 'yoga studio management';
      const res = await fetch('/api/admin/mcp-gateway/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverSlug: server.id, toolName: tool.name, args: { query } }),
      });
      const body = await res.json();
      setResults(prev => ({ ...prev, [tool.name]: body }));
    } finally {
      setRunning(null);
    }
  };

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const servers = filter === 'external'
    ? data.servers.filter(s => s.id.endsWith('-mcp') && !['social-mcp','booking-mcp','customer-mcp','teacher-mcp','learning-mcp','marketing-mcp','finance-mcp','content-mcp','analytics-mcp','workflow-mcp','knowledge-mcp','admin-mcp','student-mcp','notification-mcp','campaign-mcp'].includes(s.id))
    : data.servers;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">MCP Gateway</h1>
        <p className="text-sm text-gray-500">
          {data.summary.serverCount} servers · {data.summary.totalTools} tools · {data.summary.approvalRequiredTools} require human approval · {data.summary.highRiskToolCount} high-risk
        </p>
      </header>

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
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-gray-800">{server.name}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AVAILABILITY_STYLE[server.availability] ?? ''}`}>{server.availability}</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">{server.description}</p>
            {server.implementationNote && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded p-2 mb-3">{server.implementationNote}</p>
            )}
            {server.tools.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No tools — see note above.</p>
            ) : (
              <div className="space-y-2">
                {server.tools.map(tool => (
                  <div key={tool.name} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-gray-800">{tool.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tool.tier] ?? ''}`}>{tool.tier.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">risk {tool.riskLevel}/5</span>
                        {tool.executable && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">real &amp; executable</span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{tool.description}</p>
                      {tool.safetyNote && <p className="text-xs text-amber-700 mt-1">⚠ {tool.safetyNote}</p>}
                      {results[tool.name] !== undefined ? (
                        <pre className="text-xs bg-gray-50 rounded p-2 mt-2 overflow-x-auto max-h-40">{JSON.stringify(results[tool.name], null, 2)}</pre>
                      ) : null}
                    </div>
                    {tool.executable && tool.tier === 'auto' && (
                      <button
                        disabled={running === tool.name}
                        onClick={() => runTool(server, tool)}
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
  );
}
