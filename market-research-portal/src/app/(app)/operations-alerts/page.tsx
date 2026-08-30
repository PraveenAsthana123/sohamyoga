'use client';

// Operations & Failure Tracking — implements the mandatory Operational
// Portal Page & Tab Standard (8 tabs, 13-field process sub-structure) for
// this portal's own operational health, the same way PhaseTabs.tsx does
// for the 17 research phases. This is deliberately a real, non-AI,
// deterministic sweep — the AI-Exp/Governance/Risk/ResAI tabs say so
// honestly rather than fabricating model usage that isn't there.

import { useEffect, useState, useCallback } from 'react';

interface TrackedTable {
  source_table: string;
  display_name: string;
  description: string;
  open_count: string;
  acknowledged_count: string;
  resolved_count: string;
  last_seen_at: string | null;
}
interface Alert {
  id: string;
  source_table: string;
  source_display_name: string;
  entity_id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  status: 'open' | 'acknowledged' | 'resolved';
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
}
interface AlertEvent {
  id: number;
  alert_id: string;
  event_type: 'found' | 'reseen' | 'acknowledged' | 'resolved' | 'reopened';
  detail: string;
  actor: string;
  occurred_at: string;
}
interface JobRun {
  id: string;
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  result_summary: string | null;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process (Job)',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  info: 'bg-blue-100 text-blue-800 border-blue-300',
};
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-red-100 text-red-700', acknowledged: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700',
    queued: 'bg-gray-100 text-gray-600', running: 'bg-amber-100 text-amber-700', succeeded: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>}
      {children}
    </div>
  );
}
function fmt(ts: string | null | undefined): string { return ts ? new Date(ts).toLocaleString() : '—'; }

export default function OperationsAlertsPage() {
  const [tables, setTables] = useState<TrackedTable[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/operations-alerts', { cache: 'no-store' });
    const data = await res.json();
    setTables(data.tables ?? []); setAlerts(data.alerts ?? []); setEvents(data.events ?? []); setJobRuns(data.jobRuns ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (alertId: string, action: 'acknowledge' | 'resolve' | 'reopen') => {
    setBusy(alertId);
    await fetch('/api/admin/operations-alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertId, action }) });
    await load();
    setBusy(null);
  };

  const openAlerts = alerts.filter(a => a.status === 'open');
  const criticalOpen = openAlerts.filter(a => a.severity === 'critical');
  const totalOpen = tables.reduce((n, t) => n + Number(t.open_count), 0);
  const lastJobRun = jobRuns[0] ?? null;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Operations &amp; Failure Tracking</h1>
        <p className="text-sm text-gray-500">
          Mandatory policy: every real operation across this portal is tracked, table by table, in a reference
          catalog, and every failure becomes a trackable alert with a real timestamped lifecycle — not a status
          field that silently overwrites itself.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="Open alerts"><span className={`text-2xl font-bold ${totalOpen > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalOpen}</span></Card>
          <Card title="Critical (open)"><span className="text-2xl font-bold text-red-600">{criticalOpen.length}</span></Card>
          <Card title="Tracked tables">{tables.length}</Card>
          <Card title="Last sweep">{lastJobRun ? fmt(lastJobRun.started_at) : 'Cron not run yet — live on every page view'}</Card>
          <div className="sm:col-span-4">
            <Card title="Per-table breakdown">
              <div className="grid gap-3 sm:grid-cols-3">
                {tables.map(t => (
                  <div key={t.source_table} className="rounded border border-gray-100 p-3 text-sm">
                    <div className="font-medium">{t.display_name}</div>
                    <div className="mt-1 flex gap-3 text-xs">
                      <span className={Number(t.open_count) > 0 ? 'font-bold text-red-600' : 'text-gray-400'}>{t.open_count} open</span>
                      <span className="text-amber-600">{t.acknowledged_count} ack&apos;d</span>
                      <span className="text-gray-400">{t.resolved_count} resolved</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <Card title="Report — Operations Health">
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            <div className="space-y-2 text-sm text-gray-800">
              <p>As of {new Date().toLocaleString()}: {totalOpen} open alert{totalOpen === 1 ? '' : 's'} across {tables.filter(t => Number(t.open_count) > 0).length} of {tables.length} tracked tables.</p>
              {criticalOpen.length > 0 && (
                <p className="font-medium text-red-700">{criticalOpen.length} critical — requires immediate manual review (see Manual Process tab).</p>
              )}
              <ul className="list-disc space-y-1 pl-5">
                {tables.filter(t => Number(t.open_count) > 0).map(t => (
                  <li key={t.source_table}>{t.display_name}: {t.open_count} open — {t.description}</li>
                ))}
              </ul>
              {totalOpen === 0 && <p className="text-emerald-700">No open failures across any tracked table.</p>}
            </div>
          )}
        </Card>
      )}

      {(tab === 'manual' || tab === 'automatic') && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Goal">
              <p className="text-sm text-gray-800">
                {tab === 'manual'
                  ? 'Every open failure across this portal’s operational tables is reviewed and either resolved or explicitly accepted as known, by a human, in bounded time.'
                  : 'Failures are discovered automatically, without waiting for a human to notice — every tracked table is swept for new failures continuously.'}
              </p>
            </Card>
            <Card title="Objective">
              <p className="text-sm text-gray-800">
                {tab === 'manual' ? 'Zero unacknowledged critical alerts.' : 'Zero silent failures: every failing row in a tracked table produces an alert within one sweep cycle (10 minutes).'}
              </p>
            </Card>
          </div>

          <Card title="To-do list">
            <ul className="space-y-1.5 text-sm">
              {tab === 'manual' ? (
                criticalOpen.length === 0 ? (
                  <li className="flex items-center gap-2"><input type="checkbox" checked disabled /> <span className="text-gray-400 line-through">Review all critical alerts</span></li>
                ) : criticalOpen.map(a => (
                  <li key={a.id} className="flex items-center gap-2"><input type="checkbox" checked={false} disabled /> <span>Review: {a.title} ({a.source_display_name})</span></li>
                ))
              ) : (
                <>
                  <li className="flex items-center gap-2"><input type="checkbox" checked={jobRuns.length > 0} disabled /> <span className={jobRuns.length > 0 ? 'text-gray-400 line-through' : ''}>Register operations-alert-sweep in job_registry and run at least once</span></li>
                  <li className="flex items-center gap-2"><input type="checkbox" checked={lastJobRun?.status === 'succeeded'} disabled /> <span className={lastJobRun?.status === 'succeeded' ? 'text-gray-400 line-through' : ''}>Confirm the most recent scheduled run succeeded</span></li>
                </>
              )}
            </ul>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="Input">
              <p className="text-sm text-gray-800">
                {tab === 'manual' ? `${openAlerts.length} open alert(s) surfaced by the automatic sweep.` : `7 tracked tables: ${tables.map(t => t.source_table).join(', ')}.`}
              </p>
            </Card>
            <Card title="Process">
              <p className="text-sm text-gray-800">
                {tab === 'manual'
                  ? 'Admin reviews each open alert’s detail, investigates the underlying row, then marks it Acknowledge (investigating) or Resolve (fixed/accepted). Reopens automatically if the same failure recurs.'
                  : 'Every GET of this page, and every 10 minutes via cron (job "operations-alert-sweep"), the sweep queries each tracked table for failed/blocked rows and the shared Ollama client’s circuit-breaker state, then upserts operations_alert with a real event-log entry.'}
              </p>
            </Card>
            <Card title="Output">
              <p className="text-sm text-gray-800">
                {tab === 'manual' ? `${alerts.filter(a => a.status === 'acknowledged').length} acknowledged, ${tables.reduce((n, t) => n + Number(t.resolved_count), 0)} resolved to date.` : `${totalOpen} currently-open alert(s) maintained in operations_alert.`}
              </p>
            </Card>
          </div>

          <Card title="Visualization">
            <pre className="overflow-x-auto text-xs text-gray-700">{JSON.stringify(tables.map(t => ({ table: t.source_table, open: Number(t.open_count), ack: Number(t.acknowledged_count), resolved: Number(t.resolved_count) })), null, 2)}</pre>
          </Card>

          <Card title="Transactional history (timestamped)">
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {events.map(e => (
                <li key={e.id} className="border-b border-gray-50 pb-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs text-gray-400">{fmt(e.occurred_at)}</span>{' '}
                  <span className="font-medium text-gray-700">{e.event_type}</span>
                  <span className="text-gray-400"> · {e.actor}</span>
                  {e.detail && <span className="text-gray-600"> — {e.detail.slice(0, 120)}</span>}
                </li>
              ))}
              {!events.length && <li className="text-sm text-gray-400">No events recorded yet.</li>}
            </ul>
          </Card>

          <Card title="Checklist">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><input type="checkbox" checked={tables.every(t => Number(t.open_count) === 0)} disabled /> All tracked tables currently show zero open alerts</li>
              <li className="flex items-center gap-2"><input type="checkbox" checked={criticalOpen.length === 0} disabled /> No open critical-severity alerts</li>
              <li className="flex items-center gap-2"><input type="checkbox" checked={jobRuns.some(j => j.status === 'succeeded')} disabled /> Scheduled sweep has at least one successful run</li>
            </ul>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary">
              <p className="text-sm text-gray-800">Covers: marketing production jobs, marketing event log, voice calls/events, content-factory projects, pipeline job runs, and the shared Ollama circuit breaker.</p>
            </Card>
            <Card title="Exclusion boundary">
              <p className="text-sm text-gray-800">Does not yet cover: Playwright/e2e test results, API-route error rates, browser/UI console errors, or raw Postgres schema-migration failures — queued as the next tracked-operation catalog rows.</p>
            </Card>
          </div>

          <Card title="Task list">
            <ul className="space-y-1.5 text-sm">
              {openAlerts.slice(0, 10).map(a => (
                <li key={a.id} className="flex items-center justify-between"><span>{a.title}</span><span className="text-xs text-gray-400">unassigned · {a.status}</span></li>
              ))}
              {!openAlerts.length && <li className="text-gray-400">No open tasks.</li>}
            </ul>
          </Card>

          <Card title="Final outcome report">
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {tab === 'automatic' && lastJobRun
                ? `Last scheduled run: ${lastJobRun.status}${lastJobRun.duration_ms !== null ? ` in ${lastJobRun.duration_ms}ms` : ''}. ${lastJobRun.result_summary ?? ''}`
                : totalOpen === 0 ? 'All tracked operations currently healthy.' : `${totalOpen} open item(s) remain — see Manual Process to-do list.`}
            </p>
          </Card>

          {tab === 'manual' && (
            <Card title="Status (Completed / Pending / Running)">
              <div className="mb-2"><StatusBadge status={openAlerts.length === 0 ? 'succeeded' : criticalOpen.length > 0 ? 'failed' : 'running'} /></div>
              <div className="space-y-2">
                {openAlerts.map(a => (
                  <div key={a.id} className={`rounded-lg border p-3 ${severityColor[a.severity]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide">{a.severity} · {a.source_display_name} · {a.status}</div>
                        <div className="font-medium">{a.title}</div>
                        <div className="mt-1 text-xs opacity-80">{a.detail}</div>
                        <div className="mt-1 text-xs opacity-60">first seen {fmt(a.first_seen_at)} · last seen {fmt(a.last_seen_at)}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button disabled={busy === a.id} onClick={() => act(a.id, 'acknowledge')} className="rounded bg-white/70 px-2 py-1 text-xs font-medium hover:bg-white">Acknowledge</button>
                        <button disabled={busy === a.id} onClick={() => act(a.id, 'resolve')} className="rounded bg-white/70 px-2 py-1 text-xs font-medium hover:bg-white">Resolve</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab === 'automatic' && (
            <Card title="Status (Completed / Pending / Running) — job run history">
              <ul className="space-y-1">
                {jobRuns.map(j => (
                  <li key={j.id} className="text-xs text-gray-600"><span className="font-mono">{fmt(j.started_at)}</span> — <StatusBadge status={j.status} /> {j.duration_ms !== null && `(${j.duration_ms}ms)`} {j.error_message && `— ${j.error_message}`}</li>
                ))}
                {!jobRuns.length && <li className="text-sm text-gray-400">No scheduled run yet — the cron runner (`npm run cron`) registers &quot;operations-alert-sweep&quot; every 10 minutes once running.</li>}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['explainability', 'experiment', 'experience'] as const).map(s => (
              <button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
            ))}
          </div>
          {aiExpSub === 'explainability' && (
            <Card title="Explainability"><p className="text-sm text-gray-800">This tracker uses no AI model. Every alert is produced by a deterministic SQL query against a real table (see Automatic Process → Process). There is nothing for a model to explain — severity and title are hardcoded per source table, not inferred.</p></Card>
          )}
          {aiExpSub === 'experiment' && (
            <Card title="Experiment"><p className="text-sm text-gray-800">No models or prompts have been tried, because none are used. If AI-assisted triage (e.g. auto-summarizing an error message) is added later, its model/prompt history will be logged here for real.</p></Card>
          )}
          {aiExpSub === 'experience' && (
            <Card title="Experience"><p className="text-sm text-gray-800">Plain-language: this page runs a checklist of database queries every time you open it (and every 10 minutes automatically), and shows you anything that looks broken. No AI decides what counts as broken — that's defined per table in the reference catalog.</p></Card>
          )}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> none — this feature is deterministic SQL only.</p>
            <p><strong>Approval status:</strong> not applicable — no AI-generated content is produced by this operation.</p>
            <p><strong>Policy compliance:</strong> honestly declares non-AI status per the mandatory tab standard, rather than fabricating governance content for a model that isn't in use.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes (of the sweep itself, not an AI model):</strong> a table not yet registered in <code>ref_tracked_operation</code> fails silently — its failures are invisible until a catalog row and sweep clause are added (see Exclusion boundary, Manual/Automatic tabs).</p>
            <p><strong>Bias/hallucination risk:</strong> none — no generative model is in the loop.</p>
            <p><strong>Mitigations:</strong> the reference-table catalog makes coverage gaps explicit and auditable (query <code>ref_tracked_operation</code> vs. every real table in the schema) rather than hidden in application code.</p>
            <p><strong>Current risk level:</strong> {tables.length < 10 ? 'Elevated — only 7 of this portal’s real tables are tracked; testing/API/UI/schema layers are not yet covered.' : 'Low'}</p>
          </div>
        </Card>
      )}

      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['research-ai', 'responsible-ai'] as const).map(s => (
              <button key={s} onClick={() => setResAiSub(s)} className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s === 'research-ai' ? 'Research AI' : 'Responsible AI'}</button>
            ))}
          </div>
          {resAiSub === 'research-ai' && (
            <Card title="Research AI"><p className="text-sm text-gray-800">No research agent runs for this operation today. A natural extension: an Ollama-backed summarizer that reads open alert details and drafts a plain-English root-cause hypothesis for the Report tab — not yet built, listed honestly rather than implied here.</p></Card>
          )}
          {resAiSub === 'responsible-ai' && (
            <Card title="Responsible AI">
              <div className="space-y-2 text-sm text-gray-800">
                <p><strong>Data provenance:</strong> alert detail text is copied verbatim from real error messages / blocker strings already stored in this portal's own tables (e.g. ffmpeg stderr, job blocker reasons) — no external data.</p>
                <p><strong>Consent/privacy:</strong> voice_call alert details can include a customer phone reference; alert rows should be purged on the same retention schedule as the source voice_call row (not yet automated — tracked as a follow-up).</p>
                <p><strong>Bias checks:</strong> not applicable — deterministic only.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
