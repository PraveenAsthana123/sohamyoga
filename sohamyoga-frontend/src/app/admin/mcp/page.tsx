'use client';

import { useCallback, useEffect, useState } from 'react';

const TABS = ['Overview', 'Servers', 'Tool Calls', 'Approvals', 'Gateway Audit'] as const;
type Tab = typeof TABS[number];

interface Server {
  id: string; name: string; slug: string; version: string | null; endpoint: string | null;
  status: string | null; tool_count: number; is_enabled: boolean; description: string | null;
  last_checked_at: string | null; call_count: number;
}

interface ToolCall {
  id: string; tool_name: string; tier: string | null; status: string; actor_role: string | null;
  duration_ms: number | null; error_message: string | null; flagged_for_review: boolean;
  prompt_injection_suspected: boolean; created_at: string; server_name: string | null;
}

interface Approval {
  id: string; tier: string | null; tier_label: string | null; status: string;
  requested_by: string | null; created_at: string; resolved_at: string | null;
}

interface GatewayAuditRow { event_type: string; count: number; }

interface Summary {
  totalServers: number; activeServers: number; totalToolCalls: number;
  pendingApprovals: number; flaggedCalls: number;
}

interface ApiData {
  servers: Server[];
  toolCalls: ToolCall[];
  approvals: Approval[];
  gatewayAudit: GatewayAuditRow[];
  statusStats: Record<string, number>;
  summary: Summary;
}

function KpiCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700', red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
    </div>
  );
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600', purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.gray}`}>{children}</span>;
}

function statusColor(s: string) {
  return s === 'success' ? 'green' : s === 'failed' || s === 'error' ? 'red'
    : s === 'pending' || s === 'awaiting_approval' ? 'amber' : 'gray';
}

export default function McpPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/mcp', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: ApiData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleServer = async (id: string, enabled: boolean) => {
    setToggling(id);
    await fetch('/api/admin/mcp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_id: id, is_enabled: !enabled }),
    });
    setToggling(null);
    load();
  };

  const resolveApproval = async (id: string, action: string) => {
    await fetch('/api/admin/mcp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id: id, action }),
    });
    load();
  };

  const s = data?.summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MCP Gateway</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Model Context Protocol servers, tool calls, approval queue and gateway audit
        </p>
      </div>

      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading MCP data…</div>
      ) : (
        <>
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="MCP Servers" value={s?.totalServers ?? 0} color="blue" />
                <KpiCard label="Active Servers" value={s?.activeServers ?? 0} color="green" />
                <KpiCard label="Tool Calls (DB)" value={(s?.totalToolCalls ?? 0).toLocaleString()} color="purple" />
                <KpiCard label="Pending Approvals" value={s?.pendingApprovals ?? 0} color={s?.pendingApprovals ? 'amber' : 'blue'} />
                <KpiCard label="Flagged Calls" value={s?.flaggedCalls ?? 0} color={s?.flaggedCalls ? 'red' : 'blue'} />
              </div>

              {Object.keys(data?.statusStats ?? {}).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tool Call Status Breakdown</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {Object.entries(data?.statusStats ?? {}).map(([status, count]) => (
                      <div key={status} className="text-center bg-gray-50 rounded p-2">
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs text-gray-500">{status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Registered MCP Servers</h3>
                <div className="space-y-2">
                  {(data?.servers ?? []).map(srv => (
                    <div key={srv.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                      <div>
                        <span className="font-medium">{srv.name}</span>
                        {srv.version && <span className="text-gray-400 text-xs ml-2">v{srv.version}</span>}
                        {srv.description && <div className="text-xs text-gray-400">{srv.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{srv.call_count} calls</span>
                        <Badge color={srv.is_enabled ? 'green' : 'gray'}>{srv.is_enabled ? 'enabled' : 'disabled'}</Badge>
                      </div>
                    </div>
                  ))}
                  {(data?.servers ?? []).length === 0 && (
                    <p className="text-sm text-gray-400">No MCP servers registered yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'Servers' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">MCP Servers ({data?.servers.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Name', 'Version', 'Endpoint', 'Tools', 'Calls', 'Status', 'Toggle'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.servers ?? []).map(srv => (
                    <tr key={srv.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{srv.name}</div>
                        {srv.description && <div className="text-xs text-gray-400">{srv.description}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{srv.version ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{srv.endpoint ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{srv.tool_count}</td>
                      <td className="px-3 py-2 text-gray-500">{srv.call_count}</td>
                      <td className="px-3 py-2">
                        <Badge color={srv.is_enabled ? 'green' : 'gray'}>{srv.is_enabled ? 'enabled' : 'disabled'}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleServer(srv.id, srv.is_enabled)}
                          disabled={toggling === srv.id}
                          className={`text-xs px-3 py-1 rounded font-medium ${srv.is_enabled ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {toggling === srv.id ? '…' : srv.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.servers ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No MCP servers registered.</div>
              )}
            </div>
          )}

          {tab === 'Tool Calls' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">Recent Tool Calls ({data?.toolCalls.length ?? 0} shown)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Tool', 'Server', 'Tier', 'Actor', 'Duration', 'Status', 'Flags', 'Time'].map(h =>
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.toolCalls ?? []).map(tc => (
                      <tr key={tc.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium font-mono text-xs">{tc.tool_name}</td>
                        <td className="px-3 py-2 text-gray-500">{tc.server_name ?? '—'}</td>
                        <td className="px-3 py-2"><Badge>{tc.tier ?? 'standard'}</Badge></td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{tc.actor_role ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{tc.duration_ms ? `${tc.duration_ms}ms` : '—'}</td>
                        <td className="px-3 py-2">
                          <Badge color={statusColor(tc.status)}>{tc.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {tc.flagged_for_review && <Badge color="amber">flagged</Badge>}
                          {tc.prompt_injection_suspected && <Badge color="red">injection</Badge>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {new Date(tc.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data?.toolCalls ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No tool calls recorded yet.</div>
              )}
            </div>
          )}

          {tab === 'Approvals' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">Approval Queue ({data?.approvals.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Tier', 'Status', 'Requested By', 'Created', 'Resolved', 'Actions'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.approvals ?? []).map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2"><Badge>{a.tier_label ?? a.tier ?? 'standard'}</Badge></td>
                      <td className="px-3 py-2">
                        <Badge color={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{a.requested_by ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {a.resolved_at ? new Date(a.resolved_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {a.status === 'pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => resolveApproval(a.id, 'approved')}
                              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
                              Approve
                            </button>
                            <button onClick={() => resolveApproval(a.id, 'rejected')}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.approvals ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No approval requests.</div>
              )}
            </div>
          )}

          {tab === 'Gateway Audit' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Gateway Audit Events (last 30 days)
              </h3>
              {(data?.gatewayAudit ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No gateway audit events in the last 30 days.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Event Type</th>
                      <th className="px-3 py-2 text-left">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.gatewayAudit ?? []).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{row.event_type}</td>
                        <td className="px-3 py-2 font-semibold">{Number(row.count).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
