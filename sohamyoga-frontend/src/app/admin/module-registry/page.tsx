'use client';
// Module Understanding dashboard — the single UI the Module Understanding
// Standard policy requires: for every cataloged module (across BOTH
// sohamyoga apps), show user/admin/data flow, job, report, dashboard,
// schema, demo use cases, input/process/output, final outcome, and an
// honest built-vs-missing verdict. A module with no row here is NOT
// omitted — it counts against the "not yet cataloged" gap shown up top.

import { useEffect, useMemo, useState } from 'react';

interface ModuleRow {
  id: string; app: string; module_key: string; name: string; description: string; built_status: string;
  user_flow: string | null; admin_flow: string | null; data_flow: string | null; flowchart: string | null;
  user_story: string | null; input_desc: string | null; process_desc: string | null; output_desc: string | null;
  final_outcome: string | null; job_name: string | null; report_location: string | null; dashboard_location: string | null;
  schema_tables: string[]; demo_use_cases: Array<{ name: string; flow: string }>; integration_platforms: string[];
  missing_items: string | null; source_doc: string | null; last_verified_at: string | null;
  has_user_ui: boolean; has_admin_ui: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  real: 'bg-emerald-100 text-emerald-800', partial: 'bg-amber-100 text-amber-800',
  not_built: 'bg-red-100 text-red-700', not_yet_cataloged: 'bg-gray-100 text-gray-500',
};
const STATUS_LABELS: Record<string, string> = {
  real: 'Real', partial: 'Partial', not_built: 'Not built', not_yet_cataloged: 'Not yet cataloged',
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="mb-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm text-gray-800">{value}</p></div>;
}

export default function ModuleRegistryPage() {
  const [data, setData] = useState<{ modules: ModuleRow[]; tally: Record<string, number>; dimensionTally: Record<string, number>; catalogedCount: number; estimatedSohamyogaFrontendAdminSurfaces: number; note: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<'all' | 'sohamyoga-frontend' | 'market-research-portal'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'real' | 'partial' | 'not_built' | 'not_yet_cataloged'>('all');

  useEffect(() => {
    fetch('/api/admin/module-registry', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setData);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.modules.filter(m => (appFilter === 'all' || m.app === appFilter) && (statusFilter === 'all' || m.built_status === statusFilter));
  }, [data, appFilter, statusFilter]);

  const active = data?.modules.find(m => m.id === selected) ?? filtered[0] ?? null;

  if (!data) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Module Understanding Dashboard</h1>
        <p className="text-sm text-gray-500">One place to see, per module, what is actually built vs missing — user flow, admin flow, data flow, job, report, dashboard, schema, demo use cases. Backed by a real registry table, never hardcoded per module.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-400">Cataloged</p><p className="text-2xl font-bold">{data.catalogedCount}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-400">Real</p><p className="text-2xl font-bold text-emerald-700">{data.tally.real ?? 0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-400">Partial</p><p className="text-2xl font-bold text-amber-700">{data.tally.partial ?? 0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-400">Not built</p><p className="text-2xl font-bold text-red-700">{data.tally.not_built ?? 0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-400">Est. admin surfaces (sohamyoga-frontend)</p><p className="text-2xl font-bold text-gray-500">{data.estimatedSohamyogaFrontendAdminSurfaces}</p></div>
      </div>
      <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{data.note}</p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Mandatory per-dimension tallies (of {data.catalogedCount} cataloged)</p>
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">User Flow UI</p><p className="text-2xl font-bold">{data.dimensionTally.userFlowUI}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">Admin UI</p><p className="text-2xl font-bold">{data.dimensionTally.adminUI}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">Database</p><p className="text-2xl font-bold">{data.dimensionTally.database}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">Report</p><p className="text-2xl font-bold">{data.dimensionTally.report}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-400">Dashboard</p><p className="text-2xl font-bold">{data.dimensionTally.dashboard}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={appFilter} onChange={e => setAppFilter(e.target.value as any)} className="rounded border px-2 py-1 text-sm">
          <option value="all">All apps</option>
          <option value="sohamyoga-frontend">sohamyoga-frontend</option>
          <option value="market-research-portal">market-research-portal</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="rounded border px-2 py-1 text-sm">
          <option value="all">All statuses</option>
          <option value="real">Real</option>
          <option value="partial">Partial</option>
          <option value="not_built">Not built</option>
          <option value="not_yet_cataloged">Not yet cataloged</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-1 lg:col-span-1">
          {filtered.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)} className={`block w-full rounded-lg border p-3 text-left text-sm ${active?.id === m.id ? 'border-indigo-400 bg-indigo-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[m.built_status]}`}>{STATUS_LABELS[m.built_status]}</span>
              </div>
              <div className="text-xs text-gray-400">{m.app}</div>
            </button>
          ))}
          {!filtered.length && <p className="text-sm text-gray-400">No modules match this filter.</p>}
        </div>

        <div className="lg:col-span-2">
          {active ? (
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{active.name}</h2>
                  <p className="text-xs text-gray-400">{active.app} · key: {active.module_key}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[active.built_status]}`}>{STATUS_LABELS[active.built_status]}</span>
              </div>
              {active.description && <p className="mb-3 text-sm text-gray-600">{active.description}</p>}
              <div className="mb-3 flex gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 ${active.has_user_ui ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>User UI {active.has_user_ui ? '✓' : '✗'}</span>
                <span className={`rounded px-2 py-0.5 ${active.has_admin_ui ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>Admin UI {active.has_admin_ui ? '✓' : '✗'}</span>
                <span className={`rounded px-2 py-0.5 ${active.schema_tables?.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>Database {active.schema_tables?.length ? '✓' : '✗'}</span>
                <span className={`rounded px-2 py-0.5 ${active.report_location ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>Report {active.report_location ? '✓' : '✗'}</span>
                <span className={`rounded px-2 py-0.5 ${active.dashboard_location ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>Dashboard {active.dashboard_location ? '✓' : '✗'}</span>
              </div>

              <Field label="User story" value={active.user_story} />
              <Field label="User flow (end-to-end)" value={active.user_flow} />
              <Field label="Admin flow (end-to-end)" value={active.admin_flow} />
              <Field label="Data flow (end-to-end)" value={active.data_flow} />
              {active.flowchart && <div className="mb-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Flowchart</p><pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">{active.flowchart}</pre></div>}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Input" value={active.input_desc} />
                <Field label="Process" value={active.process_desc} />
                <Field label="Output" value={active.output_desc} />
              </div>
              <Field label="Final outcome" value={active.final_outcome} />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Job (Automatic Process)" value={active.job_name || 'None — see Missing/Notes'} />
                <Field label="Report location" value={active.report_location} />
                <Field label="Dashboard location" value={active.dashboard_location} />
                <Field label="Schema tables" value={active.schema_tables?.length ? active.schema_tables.join(', ') : null} />
              </div>

              {active.demo_use_cases?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Demo use cases</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    {active.demo_use_cases.map((u, i) => <li key={i}><strong>{u.name}:</strong> {u.flow}</li>)}
                  </ul>
                </div>
              )}

              {active.integration_platforms?.length > 0 && (
                <Field label="Integration platforms" value={active.integration_platforms.join(', ')} />
              )}

              {active.missing_items && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">What's still missing</p>
                  <p className="text-sm text-amber-900">{active.missing_items}</p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Source: {active.source_doc || 'not cited'}</span>
                <span>Last verified: {active.last_verified_at ? new Date(active.last_verified_at).toLocaleString() : 'never'}</span>
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">Select a module.</p>}
        </div>
      </div>
    </div>
  );
}
