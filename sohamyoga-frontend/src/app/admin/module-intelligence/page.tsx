'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Module { module_key: string; name: string; built_status: string; }
interface TestPlan { id: string; module_key: string; module_name?: string; plan_name: string; version: string; status: string; total_cases: number; positive_cases: number; negative_cases: number; boundary_cases: number; environment: string; test_data_source: string; objective?: string; created_at: string; }
interface TestCase { id: string; module_key: string; case_key: string; name: string; test_level: string; polarity: string; scenario_type?: string; status: string; priority: string; api_endpoint?: string; http_method?: string; expected_status?: number; last_run_at?: string; duration_ms?: number; precondition?: string; steps?: { step: number; action: string; expected: string }[]; expected_result?: string; actual_result?: string; failure_reason?: string; test_data?: Record<string, unknown>; tags?: string[]; ui_field?: string; }
interface TestRun { id: string; module_key: string; module_name?: string; run_label?: string; trigger: string; status: string; total: number; passed: number; failed: number; skipped: number; pass_rate: number; duration_ms: number; runner?: string; started_at: string; completed_at?: string; }
interface TestResult { id: string; module_key: string; case_key?: string; case_name?: string; test_level?: string; polarity?: string; status: string; failure_reason?: string; http_status?: number; duration_ms?: number; run_at: string; run_label?: string; }
interface Scenario { id: string; module_key: string; module_name?: string; scenario_category: string; scenario_name: string; description?: string; actors?: string[]; steps?: { step: number; action: string; expected: string }[]; expected_outcome?: string; integration_platform?: string; is_automated: boolean; }
interface AlertScenario { id: string; module_key: string; module_name?: string; alert_name: string; trigger_condition: string; threshold?: string; severity: string; notification_channels?: string[]; auto_remediation?: string; is_configured: boolean; }
interface TenantScenario { id: string; module_key: string; module_name?: string; tenant_type: string; scenario_name: string; description?: string; data_isolation_notes?: string; custom_config?: Record<string, unknown>; test_tenant_seed_sql?: string; }
interface Dataset { id: string; module_key: string; module_name?: string; dataset_name: string; source: string; kaggle_ref?: string; record_count: number; schema_definition?: Record<string, string>; sample_rows?: Record<string, unknown>[]; status: string; generated_by?: string; created_at: string; }
interface NavMap { id: string; module_key: string; module_name?: string; portal: string; screen_name: string; route: string; parent_route?: string; tab?: string; ui_elements?: { label: string; type: string; required: boolean }[]; actions?: { action: string; api_endpoint: string; method: string }[]; breadcrumb?: string; }
interface CoverageRow { module_key: string; name: string; built_status: string; total_cases: number; pass_count: number; fail_count: number; skip_count: number; pending_count: number; last_run_at?: string; pass_rate: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS = ['overview','modules','test-plans','test-cases','test-runs','api-testing','ui-field-testing','test-data','scenarios','alerts','tenant-scenarios','navigation-map','test-logs','reports'] as const;
type Tab = typeof TABS[number];

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{text}</span>;
}

function statusColor(s: string) {
  if (s === 'pass' || s === 'active' || s === 'completed') return 'bg-green-100 text-green-800';
  if (s === 'fail' || s === 'error') return 'bg-red-100 text-red-800';
  if (s === 'skip' || s === 'skipped' || s === 'draft') return 'bg-gray-100 text-gray-700';
  if (s === 'blocked' || s === 'running') return 'bg-yellow-100 text-yellow-800';
  if (s === 'pending') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-600';
}

function polarityColor(p: string) {
  if (p === 'positive') return 'bg-green-100 text-green-800';
  if (p === 'negative') return 'bg-red-100 text-red-800';
  if (p === 'boundary') return 'bg-yellow-100 text-yellow-800';
  if (p === 'stress') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-600';
}

function levelColor(l: string) {
  if (l === 'api') return 'bg-blue-100 text-blue-800';
  if (l === 'e2e') return 'bg-purple-100 text-purple-800';
  if (l === 'ui') return 'bg-pink-100 text-pink-800';
  if (l === 'unit') return 'bg-indigo-100 text-indigo-800';
  if (l === 'integration') return 'bg-teal-100 text-teal-800';
  if (l === 'performance') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-600';
}

function severityColor(s: string) {
  if (s === 'critical') return 'bg-red-600 text-white';
  if (s === 'high') return 'bg-orange-500 text-white';
  if (s === 'medium') return 'bg-yellow-400 text-gray-900';
  if (s === 'low') return 'bg-blue-400 text-white';
  return 'bg-gray-300 text-gray-700';
}

function categoryColor(c: string) {
  const map: Record<string, string> = {
    user_flow: 'bg-green-100 text-green-800', admin_flow: 'bg-blue-100 text-blue-800',
    agentic: 'bg-purple-100 text-purple-800', integration: 'bg-teal-100 text-teal-800',
    alert: 'bg-red-100 text-red-800', job: 'bg-orange-100 text-orange-800',
    tenant: 'bg-yellow-100 text-yellow-800', report: 'bg-indigo-100 text-indigo-800',
    dashboard: 'bg-pink-100 text-pink-800',
  };
  return map[c] ?? 'bg-gray-100 text-gray-600';
}

function tenantColor(t: string) {
  if (t === 'yoga_studio') return 'bg-purple-100 text-purple-800';
  if (t === 'fitness_center') return 'bg-red-100 text-red-800';
  if (t === 'wellness_brand') return 'bg-green-100 text-green-800';
  if (t === 'corporate') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-600';
}

function coverageStatus(rate: number) {
  if (rate >= 80) return <Badge text="good" color="bg-green-100 text-green-800" />;
  if (rate >= 50) return <Badge text="warn" color="bg-yellow-100 text-yellow-800" />;
  if (rate > 0) return <Badge text="poor" color="bg-red-100 text-red-800" />;
  return <Badge text="no runs" color="bg-gray-100 text-gray-600" />;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4 flex flex-col gap-1">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleString() : '—'; }
function fmtMs(ms?: number) { return ms != null ? (ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`) : '—'; }

const KAGGLE_SUGGESTIONS = [
  { domain: 'Yoga/Wellness', ref: 'shivakumar8617/yoga-poses-dataset', label: 'Yoga Poses Dataset' },
  { domain: 'Yoga/Wellness', ref: 'gpreda/yoga-exercises', label: 'Yoga Exercises' },
  { domain: 'Fitness', ref: 'kukuroo3/body-performance-data', label: 'Body Performance Data' },
  { domain: 'Fitness', ref: 'mssmartypants/gym-exercise-dataset', label: 'Gym Exercise Dataset' },
  { domain: 'Marketing/Ads', ref: 'nicholasjhana/marketing-leads', label: 'Marketing Leads' },
  { domain: 'Marketing/Ads', ref: 'thesoundinsilence/digital-advertising-on-online-platform', label: 'Digital Advertising' },
  { domain: 'Ecommerce', ref: 'carrie1/ecommerce-data', label: 'E-Commerce Data' },
  { domain: 'Ecommerce', ref: 'mkechinov/ecommerce-behavior-data-from-multi-category-store', label: 'E-Commerce Behavior' },
  { domain: 'CRM/Customers', ref: 'blastchar/telco-customer-churn', label: 'Customer Churn' },
  { domain: 'CRM/Customers', ref: 'sakshigoyal7/credit-card-customers', label: 'Credit Card Customers' },
];

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ─── Tab components ──────────────────────────────────────────────────────────

function OverviewTab({ modules }: { modules: Module[] }) {
  const [stats, setStats] = useState({ plans: 0, cases: 0, scenarios: 0, seeded: false });
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);

  useEffect(() => {
    void apiFetch<{ test_plans: number; test_cases: number; scenarios: number }>('/api/admin/module-intelligence/seed?status=true')
      .then(d => setStats({ plans: d.test_plans, cases: d.test_cases, scenarios: d.scenarios, seeded: d.test_plans > 0 }))
      .catch(() => {});
    void apiFetch<{ coverage: CoverageRow[] }>('/api/admin/module-intelligence/coverage-report')
      .then(d => setCoverage(d.coverage.slice(0, 50)))
      .catch(() => {});
  }, []);

  const runSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await apiFetch<{ status: string; message?: string }>('/api/admin/module-intelligence/seed');
      setSeedMsg(res.message ?? 'Seed started! Refresh stats in ~30 seconds.');
    } catch (e) { setSeedMsg(`Error: ${(e as Error).message}`); }
    finally { setSeeding(false); }
  };

  const withPlans = coverage.filter(r => r.total_cases > 0).length;
  const pct = modules.length > 0 ? Math.round((withPlans / modules.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Modules" value={modules.length} sub="221 real + 16 partial" color="text-blue-700" />
        <KpiCard label="Test Plans" value={stats.plans} sub="one per module" color="text-purple-700" />
        <KpiCard label="Test Cases" value={stats.cases} sub="10 per module" color="text-green-700" />
        <KpiCard label="Scenarios" value={stats.scenarios} sub="8 per module" color="text-orange-700" />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-semibold text-gray-800">Seed Coverage</div>
            <div className="text-sm text-gray-500">{withPlans} / {modules.length} modules seeded ({pct}%)</div>
          </div>
          <button
            onClick={() => void runSeed()}
            disabled={seeding}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {seeding ? 'Seeding…' : 'Run Seed'}
          </button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        {seedMsg && <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded p-2">{seedMsg}</div>}
      </div>

      {coverage.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm">Module Health Table (top 50)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {['Module', 'Test Cases', 'Pass', 'Fail', 'Pending', 'Pass Rate', 'Last Run', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map(r => (
                  <tr key={r.module_key} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-medium">{r.module_key}</td>
                    <td className="px-3 py-2">{r.total_cases}</td>
                    <td className="px-3 py-2 text-green-700">{r.pass_count}</td>
                    <td className="px-3 py-2 text-red-700">{r.fail_count}</td>
                    <td className="px-3 py-2 text-gray-500">{r.pending_count}</td>
                    <td className="px-3 py-2">{r.pass_rate}%</td>
                    <td className="px-3 py-2">{r.last_run_at ? new Date(r.last_run_at).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2">{coverageStatus(r.pass_rate)}</td>
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

function ModulesTab({ modules }: { modules: Module[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'scenarios'|'test-cases'|'nav-map'|'alerts'|'tenant-scenarios'|'test-data'|'reports-dash'|'jobs'>('scenarios');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [navMap, setNavMap] = useState<NavMap[]>([]);
  const [alerts, setAlerts] = useState<AlertScenario[]>([]);
  const [tenants, setTenants] = useState<TenantScenario[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [runResult, setRunResult] = useState<Record<string, string>>({});

  const filtered = modules.filter(m => m.module_key.includes(search) || m.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      const [sc, tc, nm, al, ts, ds] = await Promise.all([
        apiFetch<Scenario[]>(`/api/admin/module-intelligence/scenarios?module_key=${selected}`).catch(() => []),
        apiFetch<{ rows: TestCase[] }>(`/api/admin/module-intelligence/cases?module_key=${selected}`).then(d => d.rows).catch(() => []),
        apiFetch<NavMap[]>(`/api/admin/module-intelligence/nav-map?module_key=${selected}`).catch(() => []),
        apiFetch<AlertScenario[]>(`/api/admin/module-intelligence/alerts?module_key=${selected}`).catch(() => []),
        apiFetch<TenantScenario[]>(`/api/admin/module-intelligence/tenant-scenarios?module_key=${selected}`).catch(() => []),
        apiFetch<Dataset[]>(`/api/admin/module-intelligence/datasets?module_key=${selected}`).catch(() => []),
      ]);
      setScenarios(sc); setCases(tc); setNavMap(nm); setAlerts(al); setTenants(ts); setDatasets(ds);
    };
    void load();
  }, [selected]);

  const runCase = async (caseKey: string) => {
    setRunResult(r => ({ ...r, [caseKey]: 'running…' }));
    try {
      const res = await apiFetch<{ status: string; http_status?: number; duration_ms?: number }>('/api/admin/module-intelligence/run-case', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_key: caseKey }),
      });
      setRunResult(r => ({ ...r, [caseKey]: `${res.status} (${res.http_status ?? '-'}, ${res.duration_ms ?? 0}ms)` }));
      // Refresh cases
      const tc = await apiFetch<{ rows: TestCase[] }>(`/api/admin/module-intelligence/cases?module_key=${selected}`).then(d => d.rows).catch(() => []);
      setCases(tc);
    } catch (e) { setRunResult(r => ({ ...r, [caseKey]: `error: ${(e as Error).message}` })); }
  };

  const toggleAlertConfigured = async (alertId: string, current: boolean) => {
    await apiFetch<AlertScenario>(`/api/admin/module-intelligence/alerts/${alertId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_configured: !current }),
    });
    setAlerts(a => a.map(al => al.id === alertId ? { ...al, is_configured: !current } : al));
  };

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'scenarios', label: 'Scenarios' }, { key: 'test-cases', label: 'Test Cases' },
    { key: 'nav-map', label: 'Nav Map' }, { key: 'alerts', label: 'Alerts' },
    { key: 'tenant-scenarios', label: 'Tenants' }, { key: 'test-data', label: 'Test Data' },
    { key: 'reports-dash', label: 'Reports & Dashboards' }, { key: 'jobs', label: 'Jobs' },
  ];

  const selMod = modules.find(m => m.module_key === selected);

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 600 }}>
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-white border rounded-lg overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <input className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Search modules…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(m => (
            <button key={m.module_key} onClick={() => setSelected(m.module_key)}
              className={`w-full text-left px-3 py-2 text-xs border-b hover:bg-blue-50 transition-colors ${selected === m.module_key ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700'}`}>
              <div className="font-medium truncate">{m.name}</div>
              <div className="text-gray-400 font-mono truncate">{m.module_key}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Select a module to view details</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="font-bold text-gray-800">{selMod?.name}</div>
              <div className="text-xs text-gray-500 font-mono">{selected}</div>
            </div>
            <div className="flex border-b overflow-x-auto">
              {subTabs.map(t => (
                <button key={t.key} onClick={() => setSubTab(t.key)}
                  className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${subTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {subTab === 'scenarios' && (
                <div>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {['all','user_flow','admin_flow','agentic','integration','alert','job','tenant','report'].map(c => (
                      <button key={c} onClick={() => setCatFilter(c)}
                        className={`px-2 py-1 rounded text-xs ${catFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
                    ))}
                  </div>
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50"><tr>{['Category','Name','Actors','Description','Automated'].map(h=><th key={h} className="px-2 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
                    <tbody>
                      {scenarios.filter(s => catFilter === 'all' || s.scenario_category === catFilter).map(s => (
                        <tr key={s.id} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-2"><Badge text={s.scenario_category} color={categoryColor(s.scenario_category)} /></td>
                          <td className="px-2 py-2 font-medium">{s.scenario_name}</td>
                          <td className="px-2 py-2 text-gray-500">{(s.actors ?? []).join(', ')}</td>
                          <td className="px-2 py-2 text-gray-600 max-w-xs truncate">{s.description}</td>
                          <td className="px-2 py-2">{s.is_automated ? <Badge text="yes" color="bg-green-100 text-green-800"/> : <Badge text="no" color="bg-gray-100 text-gray-600"/>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {subTab === 'test-cases' && (
                <div>
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50"><tr>{['Case Key','Name','Level','Polarity','Status','Last Run','Duration','Run'].map(h=><th key={h} className="px-2 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
                    <tbody>
                      {cases.map(tc => (
                        <>
                          <tr key={tc.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedCase(expandedCase === tc.id ? null : tc.id)}>
                            <td className="px-2 py-2 font-mono">{tc.case_key}</td>
                            <td className="px-2 py-2 font-medium">{tc.name}</td>
                            <td className="px-2 py-2"><Badge text={tc.test_level} color={levelColor(tc.test_level)} /></td>
                            <td className="px-2 py-2"><Badge text={tc.polarity} color={polarityColor(tc.polarity)} /></td>
                            <td className="px-2 py-2"><Badge text={tc.status} color={statusColor(tc.status)} /></td>
                            <td className="px-2 py-2">{tc.last_run_at ? new Date(tc.last_run_at).toLocaleDateString() : '—'}</td>
                            <td className="px-2 py-2">{fmtMs(tc.duration_ms)}</td>
                            <td className="px-2 py-2">
                              <button onClick={e => { e.stopPropagation(); void runCase(tc.case_key); }}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                {runResult[tc.case_key] ? runResult[tc.case_key] : 'Run'}
                              </button>
                            </td>
                          </tr>
                          {expandedCase === tc.id && (
                            <tr key={`${tc.id}-exp`} className="bg-blue-50">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div><strong>Precondition:</strong> {tc.precondition ?? '—'}</div>
                                  <div><strong>Expected:</strong> {tc.expected_result ?? '—'}</div>
                                  <div className="col-span-2"><strong>Steps:</strong>
                                    <ol className="list-decimal list-inside mt-1 space-y-0.5">
                                      {(tc.steps ?? []).map((s, i) => <li key={i}>{s.action} → <em>{s.expected}</em></li>)}
                                    </ol>
                                  </div>
                                  {tc.failure_reason && <div className="col-span-2 text-red-700"><strong>Failure:</strong> {tc.failure_reason}</div>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {subTab === 'nav-map' && (
                <div className="grid grid-cols-2 gap-4">
                  {['customer','admin'].map(portal => (
                    <div key={portal}>
                      <div className="font-semibold text-sm mb-2 capitalize">{portal} Portal</div>
                      {navMap.filter(n => n.portal === portal).map(n => (
                        <div key={n.id} className="bg-gray-50 rounded p-3 mb-2 text-xs border">
                          <div className="font-medium">{n.screen_name}</div>
                          <div className="text-blue-600"><a href={n.route} target="_blank" rel="noreferrer">{n.route}</a></div>
                          <div className="text-gray-500 mt-1">UI elements: {(n.ui_elements ?? []).length} · Actions: {(n.actions ?? []).length}</div>
                          {n.breadcrumb && <div className="text-gray-400">{n.breadcrumb}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {subTab === 'alerts' && (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50"><tr>{['Alert','Severity','Trigger','Threshold','Channels','Remediation','Configured'].map(h=><th key={h} className="px-2 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-2 font-medium">{a.alert_name}</td>
                        <td className="px-2 py-2"><Badge text={a.severity} color={severityColor(a.severity)} /></td>
                        <td className="px-2 py-2 max-w-xs truncate">{a.trigger_condition}</td>
                        <td className="px-2 py-2">{a.threshold ?? '—'}</td>
                        <td className="px-2 py-2">{(a.notification_channels ?? []).join(', ')}</td>
                        <td className="px-2 py-2 max-w-xs truncate">{a.auto_remediation ?? '—'}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => void toggleAlertConfigured(a.id, a.is_configured)}
                            className={`px-2 py-1 rounded text-xs ${a.is_configured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {a.is_configured ? 'Yes' : 'No'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {subTab === 'tenant-scenarios' && (
                <div className="grid grid-cols-1 gap-4">
                  {tenants.map(t => (
                    <div key={t.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge text={t.tenant_type} color={tenantColor(t.tenant_type)} />
                        <span className="font-semibold text-sm">{t.scenario_name}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{t.description}</p>
                      {t.data_isolation_notes && <div className="text-xs text-blue-700 mb-2"><strong>Isolation:</strong> {t.data_isolation_notes}</div>}
                      {t.test_tenant_seed_sql && <pre className="text-xs bg-gray-900 text-green-400 rounded p-2 overflow-x-auto">{t.test_tenant_seed_sql}</pre>}
                    </div>
                  ))}
                </div>
              )}

              {subTab === 'test-data' && (
                <div>
                  {datasets.map(d => (
                    <div key={d.id} className="border rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge text={d.source} color={d.source === 'kaggle' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'} />
                        <span className="font-semibold text-sm">{d.dataset_name}</span>
                        <span className="text-xs text-gray-500">{d.record_count} records</span>
                      </div>
                      {d.kaggle_ref && <div className="text-xs text-blue-600 mb-2">Kaggle: {d.kaggle_ref}</div>}
                      {d.schema_definition && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-gray-700 mb-1">Schema:</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(d.schema_definition).map(([k, v]) => <span key={k} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{k}: {v}</span>)}
                          </div>
                        </div>
                      )}
                      {d.sample_rows && d.sample_rows.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-1">Sample rows (first 3):</div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border">
                              <thead className="bg-gray-50"><tr>{Object.keys(d.sample_rows[0]).slice(0,6).map(k=><th key={k} className="px-2 py-1 text-left border-b">{k}</th>)}</tr></thead>
                              <tbody>{d.sample_rows.slice(0,3).map((row,i)=><tr key={i} className="border-t">{Object.values(row).slice(0,6).map((v,j)=><td key={j} className="px-2 py-1 font-mono truncate max-w-xs">{String(v)}</td>)}</tr>)}</tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {subTab === 'reports-dash' && (
                <div className="space-y-4">
                  {selMod && (
                    <>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="font-semibold text-sm mb-1">Report Location</div>
                        <div className="text-xs text-gray-600">Navigate to the module&#39;s analytics report page for aggregated metrics.</div>
                        <a href={`/admin/${selected}`} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline mt-1 block">/admin/{selected}</a>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="font-semibold text-sm mb-1">Dashboard Location</div>
                        <div className="text-xs text-gray-600">Admin dashboard view showing live KPIs for this module.</div>
                        <a href={`/admin/${selected}`} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline mt-1 block">/admin/{selected}</a>
                      </div>
                    </>
                  )}
                </div>
              )}

              {subTab === 'jobs' && (
                <div className="space-y-3">
                  <div className="bg-yellow-50 rounded-lg p-4 text-sm">
                    <div className="font-semibold mb-1">Scheduled Job</div>
                    <div className="text-xs text-gray-600">Job runs are managed by CronRegistry. Check the cron runner for last run + next run status.</div>
                    <a href="/admin/build-status" className="text-blue-600 text-sm hover:underline">View Build Status / Cron Monitor</a>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TestPlansTab() {
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ module_key: '', plan_name: '', objective: '', scope_in: '', environment: 'local', test_data_source: 'synthetic', status: 'draft' });

  const load = useCallback(async () => {
    const url = statusFilter !== 'all' ? `/api/admin/module-intelligence/plans?status=${statusFilter}` : '/api/admin/module-intelligence/plans';
    const data = await apiFetch<TestPlan[]>(url).catch(() => []);
    setPlans(data);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.module_key || !form.plan_name) return;
    await apiFetch('/api/admin/module-intelligence/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {['all','draft','active','completed','archived'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded text-xs ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+ Create Plan</button>
      </div>

      {showCreate && (
        <div className="bg-blue-50 rounded-lg border p-4 grid grid-cols-2 gap-3 text-sm">
          {[['module_key','Module Key'],['plan_name','Plan Name'],['objective','Objective'],['scope_in','Scope In']].map(([k,l]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
              <input className="w-full px-2 py-1.5 border rounded" value={(form as Record<string, string>)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select className="w-full px-2 py-1.5 border rounded" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {['draft','active','completed','archived'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex gap-2">
            <button onClick={() => void create()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Module','Plan Name','Version','Status','Cases','Positive','Negative','Boundary','Environment','Data Source','Created'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{p.module_key}</td>
                <td className="px-3 py-2 font-medium">{p.plan_name}</td>
                <td className="px-3 py-2">{p.version}</td>
                <td className="px-3 py-2"><Badge text={p.status} color={statusColor(p.status)} /></td>
                <td className="px-3 py-2">{p.total_cases}</td>
                <td className="px-3 py-2 text-green-700">{p.positive_cases}</td>
                <td className="px-3 py-2 text-red-700">{p.negative_cases}</td>
                <td className="px-3 py-2 text-yellow-700">{p.boundary_cases}</td>
                <td className="px-3 py-2">{p.environment}</td>
                <td className="px-3 py-2">{p.test_data_source}</td>
                <td className="px-3 py-2">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestCasesTab() {
  const [data, setData] = useState<{ rows: TestCase[]; total: number }>({ rows: [], total: 0 });
  const [filters, setFilters] = useState({ module_key: '', level: 'all', polarity: 'all', status: 'all' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.module_key) params.set('module_key', filters.module_key);
    if (filters.level !== 'all') params.set('level', filters.level);
    if (filters.polarity !== 'all') params.set('polarity', filters.polarity);
    if (filters.status !== 'all') params.set('status', filters.status);
    const d = await apiFetch<{ rows: TestCase[]; total: number }>(`/api/admin/module-intelligence/cases?${params}`).catch(() => ({ rows: [], total: 0 }));
    setData(d);
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const runCase = async (caseKey: string) => {
    setRunResult(r => ({ ...r, [caseKey]: 'running…' }));
    try {
      const res = await apiFetch<{ status: string; http_status?: number; duration_ms?: number }>('/api/admin/module-intelligence/run-case', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_key: caseKey }),
      });
      setRunResult(r => ({ ...r, [caseKey]: `${res.status} (${res.http_status ?? '-'}, ${res.duration_ms ?? 0}ms)` }));
      await load();
    } catch (e) { setRunResult(r => ({ ...r, [caseKey]: `err: ${(e as Error).message}` })); }
  };

  const pass = data.rows.filter(r => r.status === 'pass').length;
  const fail = data.rows.filter(r => r.status === 'fail').length;
  const pending = data.rows.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <input className="px-2 py-1.5 border rounded text-sm" placeholder="Module key…" value={filters.module_key} onChange={e => setFilters(f => ({ ...f, module_key: e.target.value }))} />
        {[['level',['all','unit','api','ui','e2e','integration','performance','security']],['polarity',['all','positive','negative','boundary','stress']],['status',['all','pending','pass','fail','blocked','skipped']]].map(([k,opts]) => (
          <select key={k as string} className="px-2 py-1.5 border rounded text-sm" value={(filters as Record<string, string>)[k as string]}
            onChange={e => setFilters(f => ({ ...f, [k as string]: e.target.value }))}>
            {(opts as string[]).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Filter</button>
        <button onClick={() => setShowCreate(!showCreate)} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">+ Create Case</button>
      </div>

      <div className="flex gap-3 text-sm">
        <span className="text-gray-600">Total: <strong>{data.total}</strong></span>
        <span className="text-green-700">Pass: <strong>{pass}</strong></span>
        <span className="text-red-700">Fail: <strong>{fail}</strong></span>
        <span className="text-gray-400">Pending: <strong>{pending}</strong></span>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Case Key','Module','Name','Level','Polarity','Status','Priority','API Endpoint','Last Run','Duration','Run'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {data.rows.map(tc => (
              <>
                <tr key={tc.id} className={`border-t hover:bg-gray-50 cursor-pointer ${tc.status === 'fail' ? 'bg-red-50' : ''}`} onClick={() => setExpanded(expanded === tc.id ? null : tc.id)}>
                  <td className="px-3 py-2 font-mono">{tc.case_key}</td>
                  <td className="px-3 py-2 text-gray-500">{tc.module_key}</td>
                  <td className="px-3 py-2 font-medium max-w-xs truncate">{tc.name}</td>
                  <td className="px-3 py-2"><Badge text={tc.test_level} color={levelColor(tc.test_level)} /></td>
                  <td className="px-3 py-2"><Badge text={tc.polarity} color={polarityColor(tc.polarity)} /></td>
                  <td className="px-3 py-2"><Badge text={tc.status} color={statusColor(tc.status)} /></td>
                  <td className="px-3 py-2"><Badge text={tc.priority} color={tc.priority==='critical'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2 font-mono text-blue-600 max-w-xs truncate">{tc.api_endpoint ?? '—'}</td>
                  <td className="px-3 py-2">{tc.last_run_at ? new Date(tc.last_run_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">{fmtMs(tc.duration_ms)}</td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => void runCase(tc.case_key)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                      {runResult[tc.case_key] ?? 'Run'}
                    </button>
                  </td>
                </tr>
                {expanded === tc.id && (
                  <tr key={`${tc.id}-exp`} className="bg-blue-50"><td colSpan={11} className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><strong>Precondition:</strong> {tc.precondition ?? '—'}</div>
                      <div><strong>Expected:</strong> {tc.expected_result ?? '—'}</div>
                      <div className="col-span-2"><strong>Steps:</strong><ol className="list-decimal list-inside mt-1 space-y-0.5">{(tc.steps ?? []).map((s, i)=><li key={i}>{s.action} → <em>{s.expected}</em></li>)}</ol></div>
                      {tc.actual_result && <div><strong>Actual:</strong> {tc.actual_result}</div>}
                      {tc.failure_reason && <div className="text-red-700"><strong>Failure:</strong> {tc.failure_reason}</div>}
                      {tc.test_data && <div className="col-span-2"><strong>Test Data:</strong> <code className="text-xs">{JSON.stringify(tc.test_data)}</code></div>}
                    </div>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestRunsTab() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult[]>>({});
  const [moduleKey, setModuleKey] = useState('');
  const [newRunModule, setNewRunModule] = useState('');
  const [newRunLevel, setNewRunLevel] = useState('api');

  useEffect(() => { void apiFetch<TestRun[]>('/api/admin/module-intelligence/runs').then(setRuns).catch(() => {}); }, []);

  const loadResults = async (sessionId: string) => {
    if (results[sessionId]) { setExpanded(expanded === sessionId ? null : sessionId); return; }
    const res = await apiFetch<TestResult[]>(`/api/admin/module-intelligence/runs?session_id=${sessionId}`).catch(() => []);
    setResults(r => ({ ...r, [sessionId]: res }));
    setExpanded(sessionId);
  };

  const startRun = async () => {
    if (!newRunModule) return;
    await apiFetch('/api/admin/module-intelligence/run-suite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_key: newRunModule, test_level: newRunLevel }),
    });
    setTimeout(() => void apiFetch<TestRun[]>('/api/admin/module-intelligence/runs').then(setRuns).catch(() => {}), 2000);
  };

  const filtered = runs.filter(r => !moduleKey || r.module_key.includes(moduleKey));

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg border p-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Module Key</label>
          <input className="px-2 py-1.5 border rounded text-sm" placeholder="e.g. crm" value={newRunModule} onChange={e => setNewRunModule(e.target.value)} /></div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Test Level</label>
          <select className="px-2 py-1.5 border rounded text-sm" value={newRunLevel} onChange={e => setNewRunLevel(e.target.value)}>
            {['api','e2e','unit','ui','integration'].map(l => <option key={l} value={l}>{l}</option>)}
          </select></div>
        <button onClick={() => void startRun()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">New Run</button>
        <div className="ml-auto"><input className="px-2 py-1.5 border rounded text-sm" placeholder="Filter by module…" value={moduleKey} onChange={e => setModuleKey(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Run Label','Module','Trigger','Status','Total','Passed','Failed','Pass Rate','Runner','Started'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => void loadResults(r.id)}>
                  <td className="px-3 py-2 font-medium">{r.run_label ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{r.module_key}</td>
                  <td className="px-3 py-2"><Badge text={r.trigger} color="bg-gray-100 text-gray-600" /></td>
                  <td className="px-3 py-2"><Badge text={r.status} color={statusColor(r.status)} /></td>
                  <td className="px-3 py-2">{r.total}</td>
                  <td className="px-3 py-2 text-green-700">{r.passed}</td>
                  <td className="px-3 py-2 text-red-700">{r.failed}</td>
                  <td className="px-3 py-2">{r.pass_rate}%</td>
                  <td className="px-3 py-2">{r.runner ?? '—'}</td>
                  <td className="px-3 py-2">{new Date(r.started_at).toLocaleString()}</td>
                </tr>
                {expanded === r.id && results[r.id] && (
                  <tr key={`${r.id}-exp`} className="bg-gray-50"><td colSpan={10} className="px-4 py-3">
                    <table className="min-w-full text-xs border">
                      <thead className="bg-gray-100"><tr>{['Case Key','Name','Level','Status','HTTP','Duration','Run At'].map(h=><th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                      <tbody>{results[r.id].map(res => (
                        <tr key={res.id} className={`border-t ${res.status==='pass'?'bg-green-50':res.status==='fail'?'bg-red-50':''}`}>
                          <td className="px-2 py-1 font-mono">{res.case_key ?? '—'}</td>
                          <td className="px-2 py-1">{res.case_name ?? '—'}</td>
                          <td className="px-2 py-1"><Badge text={res.test_level ?? '—'} color={levelColor(res.test_level ?? '')} /></td>
                          <td className="px-2 py-1"><Badge text={res.status} color={statusColor(res.status)} /></td>
                          <td className="px-2 py-1">{res.http_status ?? '—'}</td>
                          <td className="px-2 py-1">{fmtMs(res.duration_ms)}</td>
                          <td className="px-2 py-1">{new Date(res.run_at).toLocaleString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiTestingTab() {
  const [moduleKey, setModuleKey] = useState('');
  const [apiCases, setApiCases] = useState<TestCase[]>([]);
  const [endpoint, setEndpoint] = useState('/api/admin/module-intelligence/seed?status=true');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('{}');
  const [body, setBody] = useState('{}');
  const [response, setResponse] = useState<{ status: number; body: unknown; time: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<TestResult[]>([]);

  const loadCases = async () => {
    const d = await apiFetch<{ rows: TestCase[] }>(`/api/admin/module-intelligence/cases?module_key=${moduleKey}&level=api`).catch(() => ({ rows: [] }));
    setApiCases(d.rows);
    const hist = await apiFetch<TestResult[]>(`/api/admin/module-intelligence/logs?module_key=${moduleKey}&limit=20`).catch(() => []);
    setHistory(hist);
  };

  const send = async () => {
    setSending(true);
    const start = Date.now();
    try {
      let hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
      try { hdrs = { ...hdrs, ...JSON.parse(headers) as Record<string, string> }; } catch { /* ignore */ }
      const opts: RequestInit = { method, headers: hdrs };
      if (method !== 'GET' && method !== 'HEAD') { try { opts.body = body; } catch { /* ignore */ } }
      const res = await fetch(endpoint, opts);
      const time = Date.now() - start;
      let resBody: unknown;
      try { resBody = await res.json(); } catch { resBody = await res.text().catch(() => ''); }
      setResponse({ status: res.status, body: resBody, time });
    } catch (e) { setResponse({ status: 0, body: (e as Error).message, time: Date.now() - start }); }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Module Key</label>
          <input className="px-2 py-1.5 border rounded text-sm" placeholder="e.g. crm" value={moduleKey} onChange={e => setModuleKey(e.target.value)} /></div>
        <button onClick={() => void loadCases()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Load Cases</button>
      </div>

      {apiCases.length > 0 && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium">API Test Cases for {moduleKey}</div>
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50"><tr>{['Case Key','Name','Method','Endpoint','Expected','Status','Select'].map(h=><th key={h} className="px-3 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
            <tbody>{apiCases.map(tc=>(
              <tr key={tc.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{tc.case_key}</td>
                <td className="px-3 py-2">{tc.name}</td>
                <td className="px-3 py-2"><Badge text={tc.http_method ?? 'GET'} color="bg-blue-100 text-blue-800" /></td>
                <td className="px-3 py-2 font-mono text-blue-600">{tc.api_endpoint ?? '—'}</td>
                <td className="px-3 py-2">{tc.expected_status ?? '—'}</td>
                <td className="px-3 py-2"><Badge text={tc.status} color={statusColor(tc.status)} /></td>
                <td className="px-3 py-2"><button onClick={() => { setEndpoint(tc.api_endpoint ?? ''); setMethod(tc.http_method ?? 'GET'); }} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">Use</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4">
        <div className="font-semibold text-sm mb-3">Live API Tester</div>
        <div className="flex gap-3 mb-3">
          <select className="px-2 py-1.5 border rounded text-sm" value={method} onChange={e => setMethod(e.target.value)}>
            {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input className="flex-1 px-2 py-1.5 border rounded text-sm font-mono" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="/api/..." />
          <button onClick={() => void send()} disabled={sending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Headers (JSON)</label>
            <textarea className="w-full px-2 py-1.5 border rounded text-xs font-mono h-20" value={headers} onChange={e => setHeaders(e.target.value)} /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Body (JSON)</label>
            <textarea className="w-full px-2 py-1.5 border rounded text-xs font-mono h-20" value={body} onChange={e => setBody(e.target.value)} /></div>
        </div>
        {response && (
          <div className={`rounded-lg p-3 text-xs font-mono ${response.status < 400 ? 'bg-green-50 border-green-200 border' : 'bg-red-50 border-red-200 border'}`}>
            <div className="font-bold mb-1">HTTP {response.status} · {response.time}ms</div>
            <pre className="overflow-x-auto max-h-40">{JSON.stringify(response.body, null, 2)}</pre>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium">Last 20 API Test Results</div>
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50"><tr>{['Case','Status','HTTP','Duration','Run At','Failure'].map(h=><th key={h} className="px-3 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
            <tbody>{history.map(h=>(
              <tr key={h.id} className={`border-t ${h.status==='pass'?'bg-green-50':h.status==='fail'?'bg-red-50':''}`}>
                <td className="px-3 py-2 font-mono">{h.case_key ?? '—'}</td>
                <td className="px-3 py-2"><Badge text={h.status} color={statusColor(h.status)} /></td>
                <td className="px-3 py-2">{h.http_status ?? '—'}</td>
                <td className="px-3 py-2">{fmtMs(h.duration_ms)}</td>
                <td className="px-3 py-2">{new Date(h.run_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-red-700 max-w-xs truncate">{h.failure_reason ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UiFieldTestingTab() {
  const [moduleKey, setModuleKey] = useState('');
  const [cases, setCases] = useState<TestCase[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const d = await apiFetch<{ rows: TestCase[] }>(`/api/admin/module-intelligence/cases?module_key=${moduleKey}&level=ui`).catch(() => ({ rows: [] }));
    setCases(d.rows);
  };

  const bulkMark = (status: string) => {
    const updates: Record<string, string> = {};
    cases.forEach(tc => { updates[tc.id] = status; });
    setStatuses(s => ({ ...s, ...updates }));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Module Key</label>
          <input className="px-2 py-1.5 border rounded text-sm" placeholder="e.g. crm" value={moduleKey} onChange={e => setModuleKey(e.target.value)} /></div>
        <button onClick={() => void load()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Load UI Cases</button>
        {cases.length > 0 && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => bulkMark('pass')} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">Mark All Pass</button>
            <button onClick={() => bulkMark('skip')} className="px-3 py-1.5 bg-gray-400 text-white rounded text-sm hover:bg-gray-500">Mark All Skip</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Print Checklist</button>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {cases.length === 0 ? <div className="p-8 text-center text-gray-400">Enter a module key and load UI test cases</div> : (
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600"><tr>{['Field','Test Case','Validation Rule','Test Value','Expected Behavior','Status','Notes'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {cases.map(tc => (
                <tr key={tc.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{tc.ui_field ?? 'main form'}</td>
                  <td className="px-3 py-2">{tc.name}</td>
                  <td className="px-3 py-2 text-gray-500">{tc.precondition ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{tc.test_data ? JSON.stringify(tc.test_data).slice(0,50) : '—'}</td>
                  <td className="px-3 py-2">{tc.expected_result ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select className="px-1.5 py-1 border rounded text-xs" value={statuses[tc.id] ?? tc.status}
                      onChange={e => setStatuses(s => ({ ...s, [tc.id]: e.target.value }))}>
                      {['pending','pass','fail','skip'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input className="px-1.5 py-1 border rounded text-xs w-32" placeholder="notes…"
                    value={notes[tc.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [tc.id]: e.target.value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TestDataTab() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [genModule, setGenModule] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [kaggleRef, setKaggleRef] = useState('');
  const [kaggleModule, setKaggleModule] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  useEffect(() => { void apiFetch<Dataset[]>('/api/admin/module-intelligence/datasets').then(setDatasets).catch(() => {}); }, []);

  const generate = async () => {
    if (!genModule) return;
    setGenerating(true); setGenMsg('');
    try {
      const res = await apiFetch<Dataset>('/api/admin/module-intelligence/generate-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_key: genModule, count: genCount }),
      });
      setGenMsg(`Generated: ${res.dataset_name}`);
      setDatasets(d => [res, ...d]);
    } catch (e) { setGenMsg(`Error: ${(e as Error).message}`); }
    finally { setGenerating(false); }
  };

  const saveKaggle = async () => {
    if (!kaggleModule || !kaggleRef) return;
    try {
      const res = await apiFetch<Dataset>('/api/admin/module-intelligence/generate-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_key: kaggleModule, kaggle_ref: kaggleRef, source: 'kaggle' }),
      });
      setGenMsg(`Saved Kaggle ref: ${res.kaggle_ref ?? ''}`);
      setDatasets(d => [res, ...d]);
    } catch (e) { setGenMsg(`Error: ${(e as Error).message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border rounded-lg p-4">
          <div className="font-semibold text-sm mb-3">Generate Synthetic Data (Ollama)</div>
          <div className="space-y-2">
            <input className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Module key…" value={genModule} onChange={e => setGenModule(e.target.value)} />
            <select className="w-full px-2 py-1.5 border rounded text-sm" value={genCount} onChange={e => setGenCount(Number(e.target.value))}>
              {[10,50,100,500].map(n => <option key={n} value={n}>{n} records</option>)}
            </select>
            <button onClick={() => void generate()} disabled={generating} className="w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {generating ? 'Generating…' : 'Generate with Ollama llama3.2'}
            </button>
          </div>
        </div>
        <div className="bg-orange-50 border rounded-lg p-4">
          <div className="font-semibold text-sm mb-3">Kaggle Dataset Reference</div>
          <div className="space-y-2">
            <input className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Module key…" value={kaggleModule} onChange={e => setKaggleModule(e.target.value)} />
            <input className="w-full px-2 py-1.5 border rounded text-sm font-mono" placeholder="owner/dataset-name" value={kaggleRef} onChange={e => setKaggleRef(e.target.value)} />
            <button onClick={() => void saveKaggle()} className="w-full py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">Save Kaggle Reference</button>
          </div>
        </div>
      </div>

      {genMsg && <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{genMsg}</div>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm">Curated Kaggle Dataset Suggestions</div>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50"><tr>{['Domain','Dataset','Kaggle Reference','Use for Module'].map(h=><th key={h} className="px-3 py-2 text-left text-gray-600">{h}</th>)}</tr></thead>
          <tbody>{KAGGLE_SUGGESTIONS.map((s,i)=>(
            <tr key={i} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2"><Badge text={s.domain} color="bg-blue-100 text-blue-800" /></td>
              <td className="px-3 py-2 font-medium">{s.label}</td>
              <td className="px-3 py-2 font-mono text-xs text-blue-700">
                <button onClick={() => setKaggleRef(s.ref)} className="hover:underline">{s.ref}</button>
              </td>
              <td className="px-3 py-2 text-gray-500">{s.domain.split('/')[0].toLowerCase().replace(' ','-')} modules</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm">All Test Datasets</div>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Module','Dataset','Source','Records','Kaggle Ref','Status','Generated By','Created'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{datasets.map(d=>(
            <tr key={d.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{d.module_key}</td>
              <td className="px-3 py-2 font-medium">{d.dataset_name}</td>
              <td className="px-3 py-2"><Badge text={d.source} color={d.source==='kaggle'?'bg-orange-100 text-orange-800':'bg-blue-100 text-blue-800'} /></td>
              <td className="px-3 py-2">{d.record_count}</td>
              <td className="px-3 py-2 font-mono text-xs">{d.kaggle_ref ?? '—'}</td>
              <td className="px-3 py-2"><Badge text={d.status} color={statusColor(d.status)} /></td>
              <td className="px-3 py-2">{d.generated_by ?? '—'}</td>
              <td className="px-3 py-2">{new Date(d.created_at).toLocaleDateString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ScenariosTab() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [catFilter, setCatFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const url = catFilter !== 'all' ? `/api/admin/module-intelligence/scenarios?category=${catFilter}` : '/api/admin/module-intelligence/scenarios';
    void apiFetch<Scenario[]>(url).then(setScenarios).catch(() => {});
  }, [catFilter]);

  const cats = ['all','user_flow','admin_flow','agentic','integration','alert','job','tenant','report','dashboard'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {cats.map(c => <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded text-xs ${catFilter===c?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>)}
      </div>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Module','Category','Name','Actors','Description','Integration','Automated'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{scenarios.map(s=>(
            <>
              <tr key={s.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
                <td className="px-3 py-2 font-mono">{s.module_key}</td>
                <td className="px-3 py-2"><Badge text={s.scenario_category} color={categoryColor(s.scenario_category)} /></td>
                <td className="px-3 py-2 font-medium">{s.scenario_name}</td>
                <td className="px-3 py-2 text-gray-500">{(s.actors ?? []).join(', ')}</td>
                <td className="px-3 py-2 max-w-xs truncate">{s.description}</td>
                <td className="px-3 py-2">{s.integration_platform ?? '—'}</td>
                <td className="px-3 py-2">{s.is_automated?<Badge text="yes" color="bg-green-100 text-green-800"/>:<Badge text="no" color="bg-gray-100 text-gray-600"/>}</td>
              </tr>
              {expanded===s.id&&(
                <tr key={`${s.id}-exp`} className="bg-blue-50"><td colSpan={7} className="px-4 py-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div><strong>Expected Outcome:</strong> {s.expected_outcome ?? '—'}</div>
                    <div><strong>Integration:</strong> {s.integration_platform ?? '—'}</div>
                    <div className="col-span-2"><strong>Steps:</strong><ol className="list-decimal list-inside mt-1 space-y-0.5">{(s.steps ?? []).map((st,i)=><li key={i}>{st.action} → <em>{st.expected}</em></li>)}</ol></div>
                  </div>
                </td></tr>
              )}
            </>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertScenario[]>([]);
  const [severity, setSeverity] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (severity !== 'all') params.set('severity', severity);
    if (moduleFilter) params.set('module_key', moduleFilter);
    const d = await apiFetch<AlertScenario[]>(`/api/admin/module-intelligence/alerts?${params}`).catch(() => []);
    setAlerts(d);
  }, [severity, moduleFilter]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (id: string, current: boolean) => {
    await apiFetch<AlertScenario>(`/api/admin/module-intelligence/alerts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_configured: !current }),
    });
    setAlerts(a => a.map(al => al.id === id ? { ...al, is_configured: !current } : al));
  };

  const configureAll = async () => {
    await Promise.all(alerts.filter(a => !a.is_configured).map(a => toggle(a.id, false)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          {['all','critical','high','medium','low','info'].map(s=><button key={s} onClick={()=>setSeverity(s)} className={`px-3 py-1 rounded text-xs ${severity===s?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>)}
        </div>
        <input className="px-2 py-1.5 border rounded text-sm" placeholder="Module filter…" value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)} />
        <button onClick={() => void configureAll()} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">Configure All</button>
      </div>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Module','Alert','Severity','Trigger','Threshold','Channels','Remediation','Configured'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{alerts.map(a=>(
            <tr key={a.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{a.module_key}</td>
              <td className="px-3 py-2 font-medium">{a.alert_name}</td>
              <td className="px-3 py-2"><Badge text={a.severity} color={severityColor(a.severity)} /></td>
              <td className="px-3 py-2 max-w-xs truncate">{a.trigger_condition}</td>
              <td className="px-3 py-2">{a.threshold ?? '—'}</td>
              <td className="px-3 py-2">{(a.notification_channels??[]).join(', ')}</td>
              <td className="px-3 py-2 max-w-xs truncate">{a.auto_remediation ?? '—'}</td>
              <td className="px-3 py-2">
                <button onClick={()=>void toggle(a.id,a.is_configured)} className={`px-2 py-1 rounded text-xs font-medium ${a.is_configured?'bg-green-100 text-green-800':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {a.is_configured ? 'Yes' : 'No'}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TenantScenariosTab() {
  const [tenants, setTenants] = useState<TenantScenario[]>([]);
  const [tenantFilter, setTenantFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const url = tenantFilter !== 'all' ? `/api/admin/module-intelligence/tenant-scenarios?tenant_type=${tenantFilter}` : '/api/admin/module-intelligence/tenant-scenarios';
    void apiFetch<TenantScenario[]>(url).then(setTenants).catch(() => {});
  }, [tenantFilter]);

  const filters = ['all','yoga_studio','fitness_center','wellness_brand','corporate','b2b_agency'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map(f=><button key={f} onClick={()=>setTenantFilter(f)} className={`px-3 py-1 rounded text-xs ${tenantFilter===f?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f}</button>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map(t=>(
          <div key={t.id} className="bg-white border rounded-lg p-4 cursor-pointer hover:border-blue-300" onClick={()=>setExpandedId(expandedId===t.id?null:t.id)}>
            <div className="flex items-center gap-2 mb-1">
              <Badge text={t.tenant_type} color={tenantColor(t.tenant_type)} />
              <span className="font-semibold text-sm">{t.scenario_name}</span>
            </div>
            <div className="text-xs text-gray-600 font-mono mb-1">{t.module_key}</div>
            <p className="text-xs text-gray-500">{t.description}</p>
            {expandedId===t.id && (
              <div className="mt-3 space-y-2 text-xs">
                {t.data_isolation_notes && <div className="bg-blue-50 rounded p-2"><strong>Isolation:</strong> {t.data_isolation_notes}</div>}
                {t.custom_config && <div className="bg-gray-50 rounded p-2"><strong>Config:</strong> <code>{JSON.stringify(t.custom_config)}</code></div>}
                {t.test_tenant_seed_sql && <pre className="bg-gray-900 text-green-400 rounded p-2 overflow-x-auto text-xs">{t.test_tenant_seed_sql}</pre>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavigationMapTab() {
  const [navMap, setNavMap] = useState<NavMap[]>([]);
  const [portal, setPortal] = useState('both');

  useEffect(() => {
    const url = portal !== 'both' ? `/api/admin/module-intelligence/nav-map?portal=${portal}` : '/api/admin/module-intelligence/nav-map';
    void apiFetch<NavMap[]>(url).then(setNavMap).catch(() => {});
  }, [portal]);

  // Build tree
  const byParent: Record<string, NavMap[]> = {};
  navMap.forEach(n => { const p = n.parent_route ?? '/'; if (!byParent[p]) byParent[p] = []; byParent[p].push(n); });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['both','customer','admin'].map(p=><button key={p} onClick={()=>setPortal(p)} className={`px-3 py-1 rounded text-xs ${portal===p?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p}</button>)}
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Module','Portal','Screen','Route','Tab','UI Elements','Actions'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{navMap.slice(0,200).map(n=>(
            <tr key={n.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{n.module_key}</td>
              <td className="px-3 py-2"><Badge text={n.portal} color={n.portal==='customer'?'bg-green-100 text-green-800':'bg-blue-100 text-blue-800'} /></td>
              <td className="px-3 py-2 font-medium">{n.screen_name}</td>
              <td className="px-3 py-2"><a href={n.route} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono">{n.route}</a></td>
              <td className="px-3 py-2">{n.tab ?? '—'}</td>
              <td className="px-3 py-2">{(n.ui_elements ?? []).length}</td>
              <td className="px-3 py-2">{(n.actions ?? []).length}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {['customer','admin'].map(p => (
          <div key={p} className="bg-white border rounded-lg p-4">
            <div className="font-semibold text-sm mb-3 capitalize">{p} Portal Sitemap</div>
            <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
              {Object.entries(byParent).map(([parent, items]) => (
                <div key={parent}>
                  <div className="font-mono text-gray-500 font-medium">{parent}</div>
                  {items.filter(n=>n.portal===p).map(n=>(
                    <div key={n.id} className="ml-4 font-mono text-blue-600">
                      <a href={n.route} target="_blank" rel="noreferrer" className="hover:underline">{n.route}</a>
                      <span className="text-gray-400 ml-2">{n.screen_name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestLogsTab() {
  const [logs, setLogs] = useState<TestResult[]>([]);
  const [filters, setFilters] = useState({ module_key: '', status: 'all', since: '' });
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.module_key) params.set('module_key', filters.module_key);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.since) params.set('since', filters.since);
    const d = await apiFetch<TestResult[]>(`/api/admin/module-intelligence/logs?${params}`).catch(() => []);
    setLogs(d);
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const clearOld = async () => {
    setClearing(true);
    await apiFetch('/api/admin/module-intelligence/logs?days=30', { method: 'DELETE' }).catch(() => {});
    await load();
    setClearing(false);
  };

  const exportCsv = () => {
    const headers = ['case_key','module_key','status','http_status','duration_ms','run_at','failure_reason'];
    const rows = logs.map(r => headers.map(h => JSON.stringify((r as unknown as Record<string, unknown>)[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'test-logs.csv'; a.click();
  };

  const rowBg = (s: string) => {
    if (s === 'pass') return 'bg-green-50';
    if (s === 'fail') return 'bg-red-50';
    if (s === 'blocked') return 'bg-yellow-50';
    return '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <input className="px-2 py-1.5 border rounded text-sm" placeholder="Module key…" value={filters.module_key} onChange={e=>setFilters(f=>({...f,module_key:e.target.value}))} />
        <select className="px-2 py-1.5 border rounded text-sm" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
          {['all','pass','fail','skip','blocked'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="px-2 py-1.5 border rounded text-sm" value={filters.since} onChange={e=>setFilters(f=>({...f,since:e.target.value}))} />
        <button onClick={()=>void load()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Filter</button>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Export CSV</button>
          <button onClick={()=>void clearOld()} disabled={clearing} className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50">
            {clearing ? 'Clearing…' : 'Clear >30 days'}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600"><tr>{['Case','Module','Level','Status','HTTP','Duration','Run At','Failure'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{logs.map(l=>(
            <tr key={l.id} className={`border-t ${rowBg(l.status)}`}>
              <td className="px-3 py-2 font-mono">{l.case_key ?? '—'}</td>
              <td className="px-3 py-2 font-mono">{l.module_key}</td>
              <td className="px-3 py-2">{l.test_level ? <Badge text={l.test_level} color={levelColor(l.test_level)} /> : '—'}</td>
              <td className="px-3 py-2"><Badge text={l.status} color={statusColor(l.status)} /></td>
              <td className="px-3 py-2">{l.http_status ?? '—'}</td>
              <td className="px-3 py-2">{fmtMs(l.duration_ms)}</td>
              <td className="px-3 py-2">{fmtDate(l.run_at)}</td>
              <td className="px-3 py-2 text-red-700 max-w-xs truncate">{l.failure_reason ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [data, setData] = useState<{ coverage: CoverageRow[]; trend: { run_date: string; run_count: number; cases_executed: number; passed: number; pass_rate: number }[]; polarity: { module_key: string; positive: number; negative: number; boundary: number; stress: number }[] } | null>(null);

  useEffect(() => {
    void apiFetch<typeof data>('/api/admin/module-intelligence/coverage-report').then(setData).catch(() => {});
  }, []);

  const exportCsv = (rows: unknown[], filename: string) => {
    if (!rows.length) return;
    const first = rows[0] as Record<string, unknown>;
    const headers = Object.keys(first);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  if (!data) return <div className="p-8 text-center text-gray-400">Loading reports…</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="font-semibold text-sm">Module Testing Coverage Report</span>
          <button onClick={() => exportCsv(data.coverage as unknown[], 'coverage.csv')} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Export CSV</button>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0"><tr>{['Module','Name','Cases','Pass','Fail','Skip','Pending','Pass Rate','Last Run','Coverage'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{data.coverage.map(r=>(
              <tr key={r.module_key} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{r.module_key}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.total_cases}</td>
                <td className="px-3 py-2 text-green-700">{r.pass_count}</td>
                <td className="px-3 py-2 text-red-700">{r.fail_count}</td>
                <td className="px-3 py-2 text-gray-500">{r.skip_count}</td>
                <td className="px-3 py-2 text-blue-600">{r.pending_count}</td>
                <td className="px-3 py-2">{r.pass_rate}%</td>
                <td className="px-3 py-2">{r.last_run_at ? new Date(r.last_run_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">{coverageStatus(r.pass_rate)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="font-semibold text-sm">Test Execution Trend (Last 30 Days)</span>
          <button onClick={() => exportCsv(data.trend as unknown[], 'trend.csv')} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600"><tr>{['Date','Runs','Cases Executed','Passed','Pass Rate'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{data.trend.length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No test runs yet</td></tr> : data.trend.map((t,i)=>(
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{t.run_date}</td>
                <td className="px-3 py-2">{t.run_count}</td>
                <td className="px-3 py-2">{t.cases_executed}</td>
                <td className="px-3 py-2 text-green-700">{t.passed}</td>
                <td className="px-3 py-2">{t.pass_rate}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm">Polarity Coverage per Module</div>
        <div className="overflow-x-auto max-h-60">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0"><tr>{['Module','Positive','Negative','Boundary','Stress'].map(h=><th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{data.polarity.map(p=>(
              <tr key={p.module_key} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{p.module_key}</td>
                <td className="px-3 py-2 text-green-700">{p.positive}</td>
                <td className="px-3 py-2 text-red-700">{p.negative}</td>
                <td className="px-3 py-2 text-yellow-700">{p.boundary}</td>
                <td className="px-3 py-2 text-orange-700">{p.stress}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ModuleIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    void fetch('/api/admin/module-intelligence/seed?status=true')
      .then(() => {})
      .catch(() => {});
    // Load modules list
    void fetch('/api/admin/analytics?module_key=all').catch(() => {});
    void apiFetch<{ coverage: { module_key: string; name: string; built_status: string }[] }>('/api/admin/module-intelligence/coverage-report')
      .then(d => setModules(d.coverage.map(r => ({ module_key: r.module_key, name: r.name, built_status: r.built_status }))))
      .catch(() => {
        // Fallback: fetch from module_registry via plans endpoint
        void apiFetch<{ module_key: string; module_name: string }[]>('/api/admin/module-intelligence/plans')
          .then(plans => {
            const seen = new Set<string>();
            const mods: Module[] = [];
            plans.forEach(p => { if (!seen.has(p.module_key)) { seen.add(p.module_key); mods.push({ module_key: p.module_key, name: p.module_name ?? p.module_key, built_status: 'real' }); } });
            setModules(mods);
          }).catch(() => {});
      });
  }, []);

  const TAB_LABELS: Record<Tab, string> = {
    overview: 'Overview', modules: 'Modules', 'test-plans': 'Test Plans',
    'test-cases': 'Test Cases', 'test-runs': 'Test Runs', 'api-testing': 'API Testing',
    'ui-field-testing': 'UI Field Testing', 'test-data': 'Test Data', scenarios: 'Scenarios',
    alerts: 'Alerts', 'tenant-scenarios': 'Tenant Scenarios', 'navigation-map': 'Navigation Map',
    'test-logs': 'Test Logs', reports: 'Reports',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Module Intelligence Hub + Testing Command Center</h1>
            <p className="text-sm text-gray-500">All 237 modules · Test plans · Scenarios · API testing · Tenant isolation · Reports</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white border-b px-6 overflow-x-auto">
        <div className="flex">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {activeTab === 'overview' && <OverviewTab modules={modules} />}
        {activeTab === 'modules' && <ModulesTab modules={modules} />}
        {activeTab === 'test-plans' && <TestPlansTab />}
        {activeTab === 'test-cases' && <TestCasesTab />}
        {activeTab === 'test-runs' && <TestRunsTab />}
        {activeTab === 'api-testing' && <ApiTestingTab />}
        {activeTab === 'ui-field-testing' && <UiFieldTestingTab />}
        {activeTab === 'test-data' && <TestDataTab />}
        {activeTab === 'scenarios' && <ScenariosTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'tenant-scenarios' && <TenantScenariosTab />}
        {activeTab === 'navigation-map' && <NavigationMapTab />}
        {activeTab === 'test-logs' && <TestLogsTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
