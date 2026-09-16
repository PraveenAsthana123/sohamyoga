'use client';

import { useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface McpServer {
  id: string; name: string; is_enabled: boolean; call_count: number;
  description?: string; base_url?: string;
}
interface ToolCall {
  id: string; tool_name: string; tier: string; status: string; actor_role: string | null;
  duration_ms: number | null; error_message: string | null; flagged_for_review: boolean;
  prompt_injection_suspected: boolean; created_at: string; server_name: string | null;
}
interface Approval {
  id: string; tier: string; tier_label: string | null; status: string;
  created_at: string; resolved_at: string | null; tool_name?: string; reason?: string;
}
interface Tier {
  tier_key: string; display_name: string; sort_order: number;
  requires_human_review: boolean; auto_execute: boolean; description: string | null;
}
interface GatewayAudit { event_type: string; count: number; }
interface AiModule {
  id: string; module_key: string; name: string; description: string | null;
  built_status: string; app: string; input_desc: string | null; process_desc: string | null;
  output_desc: string | null; final_outcome: string | null; job_name: string | null;
  last_verified_at: string | null; verified_by: string | null; updated_at: string | null;
}
interface AuditEntry {
  id: string; action: string; entity_type: string | null; entity_id: string | null;
  performed_by: string | null; created_at: string; details: string | null;
}
interface ToolStat { total: number; failed: number; }
interface Summary {
  totalAiModels: number; activeAiJobs: number; aiCallsToday: number;
  governanceViolations: number; pendingApprovals: number; flaggedCalls: number;
  injectionAttempts: number; failedCalls: number; totalCalls: number; securityScore: number;
}
interface Data {
  servers: McpServer[]; toolCalls: ToolCall[]; approvals: Approval[]; tiers: Tier[];
  gatewayAudit: GatewayAudit[]; aiModules: AiModule[]; auditLog: AuditEntry[];
  toolStats: Record<string, ToolStat>; summary: Summary;
}

// ── Utilities ──────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'success' | 'failed' | 'rejected';
type FlaggedFilter = 'all' | 'yes' | 'no';

const TABS = [
  'Overview', 'ExplainableAI', 'ResponsibleAI', 'DebugAI',
  'AccountableAI', 'GovernanceAI', 'SecurityLayer', 'IPO', 'TxHistory',
] as const;
type TabKey = typeof TABS[number];

const TIER_RISK: Record<string, string> = {
  auto: 'Low', staff: 'Medium', customer_confirm: 'Medium',
  staff_approval: 'Medium', admin: 'High', admin_destructive: 'Critical',
};
const TIER_COLOR: Record<string, string> = {
  auto: 'bg-green-100 text-green-800', staff: 'bg-blue-100 text-blue-800',
  customer_confirm: 'bg-blue-100 text-blue-800', staff_approval: 'bg-amber-100 text-amber-800',
  admin: 'bg-orange-100 text-orange-800', admin_destructive: 'bg-red-100 text-red-800',
};
const STATUS_COLOR: Record<string, string> = {
  success: 'text-emerald-700', failed: 'text-red-600',
  rejected: 'text-red-600', pending: 'text-amber-600', approved: 'text-emerald-700',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString();
}
function Empty({ msg }: { msg: string }) {
  return <p className="py-8 text-center text-sm text-gray-400">{msg}</p>;
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: Data }) {
  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total AI Models" value={s.totalAiModels} sub="modules with job_name set" />
        <Kpi label="Active AI Jobs" value={s.activeAiJobs} sub="jobs scheduled" />
        <Kpi label="AI Calls Today" value={s.aiCallsToday} sub="mcp_tool_call since midnight" />
        <Kpi label="Governance Violations" value={s.governanceViolations} sub="rejected approvals" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pending Approvals" value={s.pendingApprovals} />
        <Kpi label="Flagged Calls" value={s.flaggedCalls} />
        <Kpi label="Injection Attempts" value={s.injectionAttempts} />
        <Kpi label="Security Score" value={`${s.securityScore}/100`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">MCP Servers ({data.servers.length})</h3>
          {data.servers.length === 0 ? <Empty msg="No servers registered" /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 uppercase">
                <th className="pb-2">Name</th><th className="pb-2">Calls</th><th className="pb-2">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.servers.map(sv => (
                  <tr key={sv.id}>
                    <td className="py-1.5">{sv.name}</td>
                    <td className="py-1.5">{sv.call_count}</td>
                    <td className="py-1.5">
                      <Badge label={sv.is_enabled ? 'Enabled' : 'Disabled'}
                        cls={sv.is_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">Gateway Audit (30d)</h3>
          {data.gatewayAudit.length === 0 ? <Empty msg="No gateway audit data" /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 uppercase">
                <th className="pb-2">Event Type</th><th className="pb-2">Count</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.gatewayAudit.map(g => (
                  <tr key={g.event_type}>
                    <td className="py-1.5 font-mono text-xs">{g.event_type}</td>
                    <td className="py-1.5 font-bold">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: ExplainableAI ─────────────────────────────────────────────────────────
function ExplainableAITab({ data }: { data: Data }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">AI Modules — What Each Does</h2>
        <p className="text-sm text-gray-500">Source: module_registry WHERE job_name IS NOT NULL. Shows inputs, outputs, and descriptions for each automated AI module.</p>
      </div>
      {data.aiModules.length === 0 ? <Empty msg="No AI modules with scheduled jobs found in module_registry" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Module', 'App', 'Job', 'What it does', 'Inputs', 'Outputs'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.aiModules.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.module_key}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.app}</td>
                  <td className="px-4 py-3 text-xs font-mono text-indigo-700">{m.job_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{m.description ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{m.input_desc ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{m.output_desc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-lg font-semibold">Decision Trail — Recent MCP Tool Calls</h2>
        <p className="text-sm text-gray-500">Every AI action taken through the MCP gateway, most recent first.</p>
      </div>
      {data.toolCalls.length === 0 ? <Empty msg="No tool calls recorded" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Tool', 'Server', 'Tier', 'Status', 'Duration', 'When'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.toolCalls.slice(0, 50).map(tc => (
                <tr key={tc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{tc.tool_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{tc.server_name ?? '—'}</td>
                  <td className="px-4 py-3"><Badge label={tc.tier} cls={TIER_COLOR[tc.tier] ?? 'bg-gray-100 text-gray-700'} /></td>
                  <td className={`px-4 py-3 text-xs font-semibold ${STATUS_COLOR[tc.status] ?? 'text-gray-600'}`}>{tc.status}</td>
                  <td className="px-4 py-3 text-xs">{tc.duration_ms != null ? `${tc.duration_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(tc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: ResponsibleAI ─────────────────────────────────────────────────────────
function ResponsibleAITab({ data }: { data: Data }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Responsible AI Checklist</h2>
        <p className="text-sm text-gray-500">Per-module responsible AI attributes. Source: module_registry.</p>
      </div>
      {data.aiModules.length === 0 ? <Empty msg="No AI modules found" /> : (
        <div className="space-y-3">
          {data.aiModules.map(m => (
            <div key={m.id} className="rounded-xl border bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">{m.name}</span>
                <span className="text-xs text-gray-400">({m.app})</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div className={`rounded p-2 ${m.input_desc ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-gray-400'}`}>
                  <p className="text-xs font-semibold mb-1">Data Source Transparency</p>
                  <p className="text-xs">{m.input_desc ?? 'Not documented'}</p>
                </div>
                <div className="rounded bg-blue-50 p-2 text-blue-800">
                  <p className="text-xs font-semibold mb-1">Process Description</p>
                  <p className="text-xs">{m.process_desc ?? 'Not documented'}</p>
                </div>
                <div className={`rounded p-2 ${m.job_name ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-400'}`}>
                  <p className="text-xs font-semibold mb-1">Human-in-Loop</p>
                  <p className="text-xs">{m.job_name ? `Automated via ${m.job_name}` : 'Manual only'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tier Approval Levels</h2>
        {data.tiers.length === 0 ? <Empty msg="No tier data in ref_mcp_tier" /> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Tier', 'Display Name', 'Auto-Execute', 'Human Review', 'Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.tiers.map(t => (
                  <tr key={t.tier_key}>
                    <td className="px-4 py-3"><Badge label={t.tier_key} cls={TIER_COLOR[t.tier_key] ?? 'bg-gray-100 text-gray-700'} /></td>
                    <td className="px-4 py-3 font-medium">{t.display_name}</td>
                    <td className="px-4 py-3">{t.auto_execute ? '✓' : '✗'}</td>
                    <td className="px-4 py-3">{t.requires_human_review ? '✓' : '✗'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Approval Requests</h2>
        {data.approvals.length === 0 ? <Empty msg="No approval requests" /> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['ID', 'Tier', 'Status', 'Created', 'Resolved'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.approvals.map(a => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-mono text-xs">{a.id}</td>
                    <td className="px-4 py-3"><Badge label={a.tier} cls={TIER_COLOR[a.tier] ?? 'bg-gray-100 text-gray-700'} /></td>
                    <td className={`px-4 py-3 text-xs font-semibold ${STATUS_COLOR[a.status] ?? 'text-gray-600'}`}>{a.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(a.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(a.resolved_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: DebugAI ───────────────────────────────────────────────────────────────
function DebugAITab({ data }: { data: Data }) {
  const failed = data.toolCalls.filter(tc => tc.status === 'failed' || tc.flagged_for_review);
  const errorRates = Object.entries(data.toolStats)
    .map(([tool, s]) => ({ tool, ...s, rate: s.total > 0 ? ((s.failed / s.total) * 100).toFixed(1) : '0.0' }))
    .sort((a, b) => b.failed - a.failed);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">AI Debugging Console</h2>
        <p className="text-sm text-gray-500">{failed.length} failed or flagged tool call(s) found.</p>
      </div>
      {failed.length === 0 ? <Empty msg="No failed or flagged calls — system healthy" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Tool', 'Server', 'Status', 'Error', 'Duration', 'Injection?', 'When'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {failed.map(tc => (
                <tr key={tc.id} className="bg-red-50/30">
                  <td className="px-4 py-3 font-mono text-xs">{tc.tool_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{tc.server_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-600">{tc.status}</td>
                  <td className="px-4 py-3 text-xs text-red-700 max-w-xs truncate" title={tc.error_message ?? undefined}>
                    {tc.error_message ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">{tc.duration_ms != null ? `${tc.duration_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {tc.prompt_injection_suspected
                      ? <Badge label="YES" cls="bg-red-100 text-red-700" />
                      : <span className="text-gray-400">No</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(tc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Error Rate by Tool</h2>
        {errorRates.length === 0 ? <Empty msg="No tool call data" /> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Tool Name', 'Total Calls', 'Failed', 'Error Rate %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errorRates.map(r => (
                  <tr key={r.tool}>
                    <td className="px-4 py-3 font-mono text-xs">{r.tool}</td>
                    <td className="px-4 py-3">{r.total}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{r.failed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded bg-gray-100 overflow-hidden">
                          <div
                            className={`h-2 rounded ${parseFloat(r.rate) > 20 ? 'bg-red-500' : parseFloat(r.rate) > 5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(100, parseFloat(r.rate))}%` }}
                          />
                        </div>
                        <span>{r.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: AccountableAI ─────────────────────────────────────────────────────────
function AccountableAITab({ data }: { data: Data }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">AI Accountability Trail</h2>
        <p className="text-sm text-gray-500">Who did what, when — actions filtered for AI/MCP/Ollama-related events from audit_log.</p>
      </div>
      {data.auditLog.length === 0 ? <Empty msg="No AI-related entries in audit_log" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Action', 'Entity', 'Who', 'When', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.auditLog.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{e.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{[e.entity_type, e.entity_id].filter(Boolean).join(':') || '—'}</td>
                  <td className="px-4 py-3 text-xs">{e.performed_by ?? 'system'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(e.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={e.details ?? undefined}>{e.details ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Gateway Audit Events (30d)</h2>
        {data.gatewayAudit.length === 0 ? <Empty msg="No gateway audit events" /> : (
          <div className="grid gap-3 sm:grid-cols-3">
            {data.gatewayAudit.map(g => (
              <div key={g.event_type} className="rounded-xl border bg-white p-4">
                <p className="font-mono text-xs text-gray-400">{g.event_type}</p>
                <p className="text-2xl font-bold">{g.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: GovernanceAI ──────────────────────────────────────────────────────────
function GovernanceAITab({ data, onRefresh }: { data: Data; onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const toggleServer = async (id: string, enabled: boolean) => {
    setBusy(id);
    try {
      await fetch('/api/admin/mcp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: id, is_enabled: enabled }),
      });
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const resolveApproval = async (id: string, action: 'approved' | 'rejected') => {
    setBusy(id);
    try {
      await fetch('/api/admin/mcp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: id, action }),
      });
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const pending = data.approvals.filter(a => a.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Governance Policy Framework</h2>
        <p className="text-sm text-gray-500">Tier escalation ladder: auto → staff → customer_confirm → staff_approval → admin → admin_destructive.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {['Tier', 'Display Name', 'Auto-Execute', 'Requires Human', 'Risk', 'Description'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.tiers.map(t => (
              <tr key={t.tier_key}>
                <td className="px-4 py-3"><Badge label={t.tier_key} cls={TIER_COLOR[t.tier_key] ?? 'bg-gray-100 text-gray-700'} /></td>
                <td className="px-4 py-3 font-medium">{t.display_name}</td>
                <td className="px-4 py-3">{t.auto_execute ? <span className="text-emerald-600">✓</span> : <span className="text-gray-400">✗</span>}</td>
                <td className="px-4 py-3">{t.requires_human_review ? <span className="text-amber-600">✓ Required</span> : <span className="text-gray-400">Not required</span>}</td>
                <td className="px-4 py-3 text-xs font-semibold">{TIER_RISK[t.tier_key] ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{t.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">MCP Server Enable/Disable</h2>
        {data.servers.length === 0 ? <Empty msg="No MCP servers" /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.servers.map(sv => (
              <div key={sv.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
                <div>
                  <p className="font-medium">{sv.name}</p>
                  <p className="text-xs text-gray-400">{sv.call_count} calls</p>
                </div>
                <button
                  disabled={busy === sv.id}
                  onClick={() => toggleServer(sv.id, !sv.is_enabled)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${sv.is_enabled
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                >
                  {busy === sv.id ? '…' : sv.is_enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Pending Approvals ({pending.length})</h2>
        {pending.length === 0 ? <Empty msg="No pending approvals" /> : (
          <div className="space-y-2">
            {pending.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border bg-amber-50 p-4">
                <div>
                  <p className="text-xs font-mono text-gray-600">ID: {a.id}</p>
                  <p className="text-sm"><Badge label={a.tier} cls={TIER_COLOR[a.tier] ?? 'bg-gray-100 text-gray-700'} /> {a.tier_label ?? a.tier}</p>
                  <p className="text-xs text-gray-400">{fmt(a.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={busy === a.id} onClick={() => resolveApproval(a.id, 'approved')}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">
                    {busy === a.id ? '…' : 'Approve'}
                  </button>
                  <button disabled={busy === a.id} onClick={() => resolveApproval(a.id, 'rejected')}
                    className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">
                    {busy === a.id ? '…' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: SecurityLayer ─────────────────────────────────────────────────────────
function SecurityLayerTab({ data }: { data: Data }) {
  const injections = data.toolCalls.filter(tc => tc.prompt_injection_suspected);
  const flagged = data.toolCalls.filter(tc => tc.flagged_for_review);
  const score = data.summary.securityScore;

  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Security Score</p>
          <p className={`text-4xl font-bold ${scoreColor}`}>{score}</p>
          <p className="text-xs text-gray-400">100 − (injections×10) − (flagged×5)</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Injection Attempts</p>
          <p className="text-4xl font-bold text-red-600">{injections.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Flagged Calls</p>
          <p className="text-4xl font-bold text-amber-600">{flagged.length}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold">Risk Level by Tier</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Tier', 'Risk Level', 'Auto-Execute', 'Requires Human Approval'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.tiers.map(t => (
                <tr key={t.tier_key}>
                  <td className="px-4 py-3"><Badge label={t.tier_key} cls={TIER_COLOR[t.tier_key] ?? 'bg-gray-100 text-gray-700'} /></td>
                  <td className="px-4 py-3 font-semibold">{TIER_RISK[t.tier_key] ?? '—'}</td>
                  <td className="px-4 py-3">{t.auto_execute ? '✓' : '✗'}</td>
                  <td className="px-4 py-3">{t.requires_human_review ? '✓ Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {injections.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-red-600">Suspected Prompt Injection Events</h2>
          <div className="overflow-x-auto rounded-xl border border-red-200">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-xs uppercase text-red-500">
                <tr>
                  {['Tool', 'Server', 'Status', 'Error Message', 'When'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {injections.map(tc => (
                  <tr key={tc.id} className="bg-red-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{tc.tool_name}</td>
                    <td className="px-4 py-3 text-xs">{tc.server_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-red-600">{tc.status}</td>
                    <td className="px-4 py-3 text-xs text-red-700 max-w-xs truncate">{tc.error_message ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(tc.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: IPO ───────────────────────────────────────────────────────────────────
function IPOTab({ data }: { data: Data }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Input / Process / Output — Per AI Job</h2>
        <p className="text-sm text-gray-500">Data flow for each module_registry entry with a scheduled job.</p>
      </div>
      {data.aiModules.length === 0 ? <Empty msg="No AI modules with jobs found" /> : (
        <div className="space-y-2">
          {data.aiModules.map(m => (
            <div key={m.id} className="rounded-xl border bg-white">
              <button
                onClick={() => setOpen(open === m.id ? null : m.id)}
                className="flex w-full items-center justify-between px-5 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.app}</span>
                  {m.job_name && <span className="font-mono text-xs text-indigo-600">{m.job_name}</span>}
                </div>
                <span className="text-gray-400">{open === m.id ? '▲' : '▼'}</span>
              </button>
              {open === m.id && (
                <div className="border-t px-5 py-4">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-blue-700">Input</p>
                      <p className="text-sm text-blue-900">{m.input_desc ?? 'Not documented'}</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-purple-700">Process</p>
                      <p className="text-sm text-purple-900">{m.process_desc ?? 'Not documented'}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Output</p>
                      <p className="text-sm text-emerald-900">{m.output_desc ?? 'Not documented'}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-amber-700">Final Outcome</p>
                      <p className="text-sm text-amber-900">{m.final_outcome ?? 'Not documented'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Last verified: {fmt(m.last_verified_at)}
                    {m.verified_by && ` by ${m.verified_by}`}
                    {m.updated_at && ` · Updated: ${fmt(m.updated_at)}`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: TxHistory ─────────────────────────────────────────────────────────────
function TxHistoryTab({ data }: { data: Data }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [flaggedFilter, setFlaggedFilter] = useState<FlaggedFilter>('all');

  const filtered = data.toolCalls.filter(tc => {
    if (statusFilter !== 'all' && tc.status !== statusFilter) return false;
    if (flaggedFilter === 'yes' && !tc.flagged_for_review) return false;
    if (flaggedFilter === 'no' && tc.flagged_for_review) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Transaction History</h2>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded border px-2 py-1 text-sm">
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={flaggedFilter} onChange={e => setFlaggedFilter(e.target.value as FlaggedFilter)}
          className="rounded border px-2 py-1 text-sm">
          <option value="all">All (flagged/unflagged)</option>
          <option value="yes">Flagged only</option>
          <option value="no">Not flagged</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} rows (of {data.toolCalls.length} total)</span>
        <button className="ml-auto rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200">
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? <Empty msg="No records match the current filters" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                {['ID', 'Tool', 'Server', 'Tier', 'Status', 'Actor', 'Duration', 'Error', 'Flagged', 'Injection', 'When'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 200).map(tc => (
                <tr key={tc.id} className={`hover:bg-gray-50 ${tc.prompt_injection_suspected ? 'bg-red-50/40' : tc.flagged_for_review ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-2 font-mono">{tc.id}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{tc.tool_name}</td>
                  <td className="px-3 py-2 text-gray-500">{tc.server_name ?? '—'}</td>
                  <td className="px-3 py-2"><Badge label={tc.tier} cls={TIER_COLOR[tc.tier] ?? 'bg-gray-100 text-gray-700'} /></td>
                  <td className={`px-3 py-2 font-semibold ${STATUS_COLOR[tc.status] ?? 'text-gray-600'}`}>{tc.status}</td>
                  <td className="px-3 py-2 text-gray-500">{tc.actor_role ?? '—'}</td>
                  <td className="px-3 py-2">{tc.duration_ms != null ? `${tc.duration_ms}ms` : '—'}</td>
                  <td className="px-3 py-2 text-red-600 max-w-[160px] truncate" title={tc.error_message ?? undefined}>{tc.error_message ?? '—'}</td>
                  <td className="px-3 py-2">{tc.flagged_for_review ? <Badge label="Yes" cls="bg-amber-100 text-amber-700" /> : '—'}</td>
                  <td className="px-3 py-2">{tc.prompt_injection_suspected ? <Badge label="Yes" cls="bg-red-100 text-red-700" /> : '—'}</td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmt(tc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AiControlTowerPage() {
  const [data, setData] = useState<Data | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/ai-control-tower', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: Data) => setData(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const TAB_LABELS: Record<TabKey, string> = {
    Overview: 'Overview',
    ExplainableAI: 'ExpAI',
    ResponsibleAI: 'ResAI',
    DebugAI: 'DebugAI',
    AccountableAI: 'AccountableAI',
    GovernanceAI: 'Governance',
    SecurityLayer: 'Security',
    IPO: 'IPO',
    TxHistory: 'Tx History',
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AI Control Tower</h1>
          <p className="text-sm text-gray-500">Master AI governance dashboard — explainability, accountability, security, and transaction audit across all MCP-powered modules.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load AI Control Tower data: {error}
        </div>
      )}

      {loading && !data && <p className="py-12 text-center text-sm text-gray-400">Loading AI governance data…</p>}

      {data && (
        <>
          {/* Tab Bar */}
          <div className="flex flex-wrap gap-1 border-b">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-t px-4 py-2 text-sm font-medium transition ${activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="pt-2">
            {activeTab === 'Overview' && <OverviewTab data={data} />}
            {activeTab === 'ExplainableAI' && <ExplainableAITab data={data} />}
            {activeTab === 'ResponsibleAI' && <ResponsibleAITab data={data} />}
            {activeTab === 'DebugAI' && <DebugAITab data={data} />}
            {activeTab === 'AccountableAI' && <AccountableAITab data={data} />}
            {activeTab === 'GovernanceAI' && <GovernanceAITab data={data} onRefresh={load} />}
            {activeTab === 'SecurityLayer' && <SecurityLayerTab data={data} />}
            {activeTab === 'IPO' && <IPOTab data={data} />}
            {activeTab === 'TxHistory' && <TxHistoryTab data={data} />}
          </div>
        </>
      )}
    </div>
  );
}
