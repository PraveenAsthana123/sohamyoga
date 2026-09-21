'use client';

import { useCallback, useEffect, useState } from 'react';

const TABS = ['Overview', 'Workflows', 'Approvals', 'History', 'Marketing Events'] as const;
type Tab = typeof TABS[number];

interface Workflow {
  id: number; name: string; description: string | null; trigger_type: string;
  is_active: boolean; run_count: number; last_run_at: string | null;
  last_run_status: string | null; run_count_actual: string; step_count: string;
}

interface WorkflowRun {
  id: number; workflow_id: number; workflow_name: string | null;
  status: string; started_at: string; ended_at: string | null; error: string | null;
}

interface Approval {
  id: number; request_type: string; status: string; requested_by: string | null;
  created_at: string; tier: string | null;
}

interface MktEvent { event_type: string; status: string; count: string; }

interface Summary {
  totalWorkflows: number; activeWorkflows: number;
  pendingApprovals: number; marketingEvents30d: number;
}

interface ApiData {
  summary: Summary;
  workflows: Workflow[];
  runs: WorkflowRun[];
  approvals: Approval[];
  marketingEventStats: MktEvent[];
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600', purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.gray}`}>{children}</span>;
}

function triggerColor(t: string) {
  if (t === 'schedule') return 'blue';
  if (t === 'new_order') return 'green';
  if (t === 'new_review') return 'purple';
  return 'gray';
}

function statusColor(s: string) {
  return s === 'success' ? 'green' : s === 'failed' ? 'red' : s === 'running' ? 'blue' : 'gray';
}

export default function WorkflowsPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/workflows', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: ApiData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleWorkflow = async (id: number, active: boolean) => {
    setToggling(id);
    await fetch('/api/admin/workflows', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !active }),
    });
    setToggling(null);
    load();
  };

  const s = data?.summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workflows & Automation</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform workflows, MCP approval queue, and marketing automation events
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
        <div className="text-center py-16 text-gray-400 text-sm">Loading workflow data…</div>
      ) : (
        <>
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Workflows" value={s?.totalWorkflows ?? 0} color="blue" />
                <KpiCard label="Active Workflows" value={s?.activeWorkflows ?? 0} color="green" />
                <KpiCard label="Pending Approvals" value={s?.pendingApprovals ?? 0} color={s?.pendingApprovals ? 'amber' : 'blue'} />
                <KpiCard label="Marketing Events (30d)" value={(s?.marketingEvents30d ?? 0).toLocaleString()} color="purple" />
              </div>

              {(data?.workflows ?? []).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Workflows</h3>
                  <div className="space-y-2">
                    {(data?.workflows ?? []).filter(w => w.is_active).map(w => (
                      <div key={w.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                        <div>
                          <span className="font-medium">{w.name}</span>
                          <Badge color={triggerColor(w.trigger_type)}>{w.trigger_type}</Badge>
                        </div>
                        <div className="text-xs text-gray-400">
                          {w.run_count_actual} runs · {w.step_count} steps
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(data?.marketingEventStats ?? []).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Marketing Event Types (30d)</h3>
                  <div className="space-y-1">
                    {(data?.marketingEventStats ?? []).slice(0, 8).map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="text-gray-700">{e.event_type} / {e.status}</span>
                        <span className="font-semibold text-gray-900">{Number(e.count).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Workflows' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold">Platform Workflows ({data?.workflows.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Name', 'Trigger', 'Steps', 'Runs', 'Last Run', 'Status', 'Toggle'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.workflows ?? []).map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{w.name}</div>
                        {w.description && <div className="text-xs text-gray-400">{w.description}</div>}
                      </td>
                      <td className="px-3 py-2"><Badge color={triggerColor(w.trigger_type)}>{w.trigger_type.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2 text-gray-500">{w.step_count}</td>
                      <td className="px-3 py-2 text-gray-500">{w.run_count_actual}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {w.last_run_at ? new Date(w.last_run_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {w.last_run_status && <Badge color={statusColor(w.last_run_status)}>{w.last_run_status}</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleWorkflow(w.id, w.is_active)}
                          disabled={toggling === w.id}
                          className={`text-xs px-3 py-1 rounded font-medium ${w.is_active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {toggling === w.id ? '…' : w.is_active ? 'Pause' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.workflows ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No workflows found.</div>
              )}
            </div>
          )}

          {tab === 'Approvals' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">MCP Pending Approvals ({data?.approvals.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Type', 'Tier', 'Status', 'Requested By', 'Created'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.approvals ?? []).map((a, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{a.request_type ?? '—'}</td>
                      <td className="px-3 py-2"><Badge>{a.tier ?? 'standard'}</Badge></td>
                      <td className="px-3 py-2"><Badge color={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>{a.status ?? 'pending'}</Badge></td>
                      <td className="px-3 py-2 text-gray-500">{a.requested_by ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.approvals ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No pending approvals.</div>
              )}
            </div>
          )}

          {tab === 'History' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">Recent Workflow Runs</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Workflow', 'Status', 'Started', 'Ended', 'Error'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.runs ?? []).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{r.workflow_name ?? `#${r.workflow_id}`}</td>
                      <td className="px-3 py-2"><Badge color={statusColor(r.status ?? '')}>{r.status ?? '—'}</Badge></td>
                      <td className="px-3 py-2 text-xs text-gray-400">{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{r.ended_at ? new Date(r.ended_at).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-xs text-red-500 max-w-xs truncate">{r.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.runs ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No workflow runs recorded yet.</div>
              )}
            </div>
          )}

          {tab === 'Marketing Events' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Marketing Workflow Events by Type (last 30 days) — {(s?.marketingEvents30d ?? 0).toLocaleString()} total
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>{['Event Type', 'Status', 'Count'].map(h =>
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(data?.marketingEventStats ?? []).map((e, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium">{e.event_type}</td>
                          <td className="px-3 py-2"><Badge color={e.status === 'success' ? 'green' : e.status === 'failed' ? 'red' : 'gray'}>{e.status}</Badge></td>
                          <td className="px-3 py-2 font-semibold">{Number(e.count).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
