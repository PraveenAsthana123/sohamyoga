'use client';
// /admin/platform-setup — Platform Setup & Integration Center. Built
// 2026-09-01 after a live audit found most third-party integrations
// (ads, email, calling, 35 social platforms, MCP) are genuinely
// credential-blocked, not code-broken. Real, mandatory checklist of
// exactly what each platform needs, with an actual credential-entry UI --
// for social platforms, saving credentials creates a real social_account
// row that FirstWaveDispatchJob/PostizSocialAutoPublishJob can use. For
// env-var-based services (Novu/Twilio/SMTP/Ads), the UI states plainly
// that a web form cannot inject real config into a running process --
// those need a real deployment change, not just a DB save.

import { useEffect, useState } from 'react';

interface CredField { field: string; description: string }
interface UseCase { title: string; description: string }
interface Platform {
  id: string; platform_key: string; platform_name: string; category: string; status: string; is_active: boolean;
  required_credentials: CredField[]; configured_fields: string[]; has_credentials: boolean;
  setup_instructions: string; code_reference: string | null; use_cases: UseCase[]; demo_scenario: string | null;
  automation_job: string | null; monitoring_query: string | null; last_verified_at: string | null; sociallyConnected: boolean;
  last_connection_test_at: string | null; last_connection_test_status: string | null;
  last_connection_test_detail: string | null; last_error_at: string | null; last_error_message: string | null;
}
interface SetupEvent { platform_key: string; event_type: string; outcome: string; detail: string | null; created_at: string }
interface Scenario {
  scenario_key: string; category: string; title: string; description: string; direction: string;
  asset_types: string[]; platform_keys: string[]; execution_mode: string; tracking_events: string[];
  required_capabilities: string[]; demo_steps: string[]; scale_profile: string; status: string;
}
interface Data {
  platforms: Platform[]; events: SetupEvent[]; scenarios: Scenario[];
  responseSummary: { threads: number; open_threads: number; events: number; needs_review: number };
  operationSummary: { status: string; count: number }[];
  assetSummary: { asset_type: string; status: string; count: number }[];
  tally: { total: number; configured: number; verified: number; active: number; connected: number };
}

const TABS = ['Dashboard', 'Setup Checklist', 'Integration Scenarios', 'Marketing Scenarios', 'Customer Responses', 'Demo Scenarios', 'Use Cases', 'Operations & Debug', 'Reports', 'Monitoring'] as const;
const STATUS_COLOR: Record<string, string> = {
  verified: 'bg-green-100 text-green-700', configured: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700', not_configured: 'bg-gray-100 text-gray-500',
};
const CATEGORY_LABEL: Record<string, string> = { ads: 'Ads', email: 'Email', calling: 'Calling', social: 'Social', mcp: 'MCP', other: 'Other' };
const ENV_VAR_CATEGORIES = new Set(['ads', 'email', 'calling', 'mcp', 'other']);

export default function PlatformSetupPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; detail?: string; reason?: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = () => { fetch('/api/admin/platform-setup', { cache: 'no-store' }).then(r => r.json()).then(setData); };
  useEffect(load, []);

  if (!data) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const platforms = categoryFilter === 'all' ? data.platforms : data.platforms.filter(p => p.category === categoryFilter);
  const categories = Array.from(new Set(data.platforms.map(p => p.category)));

  const openPlatform = (p: Platform) => {
    setExpanded(expanded === p.platform_key ? null : p.platform_key);
    // Secret values are write-only and are never loaded back into the browser.
    setFormValues({});
  };

  const testConnection = async (p: Platform) => {
    setTesting(p.platform_key);
    try {
      const res = await fetch('/api/admin/platform-setup/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformKey: p.platform_key }),
      });
      const body = await res.json();
      setTestResult(prev => ({ ...prev, [p.platform_key]: body }));
    } finally {
      setTesting(null);
    }
  };

  const save = async (p: Platform, isActive?: boolean) => {
    setSaving(p.platform_key);
    try {
      const credentialValues = Object.fromEntries(Object.entries(formValues).filter(([, value]) => value.trim()));
      const res = await fetch('/api/admin/platform-setup', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformKey: p.platform_key,
          ...(Object.keys(credentialValues).length ? { credentialValues } : {}),
          isActive: isActive ?? p.is_active,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(prev => ({ ...prev, [p.platform_key]: { ok: false, text: body.error || 'Save failed.' } }));
        return;
      }
      setFormValues({});
      setMessage(prev => ({ ...prev, [p.platform_key]: { ok: true, text: 'Saved securely in OpenBao; secret values were not returned to this page.' } }));
      load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Platform Setup &amp; Integration Center</h1>
        <p className="mt-1 text-sm text-gray-500">One secure console for parameters, write-only keys, connection evidence, activation, monitoring, and audit history across every registered integration.</p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="Total Platforms" value={data.tally.total} />
          <Stat label="Configured" value={data.tally.configured} />
          <Stat label="Verified" value={data.tally.verified} />
          <Stat label="Active" value={data.tally.active} />
          <Stat label="Connected Accounts" value={data.tally.connected} />
        </div>
      )}

      {tab === 'Setup Checklist' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setCategoryFilter('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All ({data.platforms.length})</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)} className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {CATEGORY_LABEL[c] ?? c} ({data.platforms.filter(p => p.category === c).length})
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {platforms.map(p => (
              <div key={p.platform_key} className="rounded-lg border border-gray-200 bg-white">
                <div className="flex cursor-pointer items-center justify-between p-3" onClick={() => openPlatform(p)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.platform_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[p.status]}`}>{p.status.replace('_', ' ')}</span>
                    {p.is_active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">active</span>}
                    {p.sociallyConnected && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">connected</span>}
                  </div>
                  <span className="text-xs text-gray-400">{expanded === p.platform_key ? '▲' : '▼'}</span>
                </div>
                {expanded === p.platform_key && (
                  <div className="space-y-3 border-t border-gray-100 p-4 text-sm">
                    <p className="text-gray-600">{p.setup_instructions}</p>
                    {p.code_reference && <p className="font-mono text-xs text-gray-400">{p.code_reference}</p>}
                    {ENV_VAR_CATEGORIES.has(p.category) && (
                      <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                        This is an environment-variable-based service. Saving values below updates this checklist record only — the running app still needs these set as real environment variables in the actual deployment before anything goes live.
                      </p>
                    )}
                    <div className="space-y-2">
                      {p.required_credentials.map(f => (
                        <div key={f.field}>
                          <label className="flex items-center justify-between text-xs font-medium text-gray-500">
                            <span>{f.field}</span>
                            <span className={p.configured_fields.includes(f.field) ? 'text-emerald-600' : 'text-amber-600'}>
                              {p.configured_fields.includes(f.field) ? 'stored securely' : 'required'}
                            </span>
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            className="mt-0.5 w-full rounded border p-2 text-sm"
                            placeholder={p.configured_fields.includes(f.field) ? 'Enter only to replace the stored value' : f.description}
                            value={formValues[f.field] ?? ''}
                            onChange={e => setFormValues({ ...formValues, [f.field]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled={testing === p.platform_key} onClick={() => testConnection(p)} className="rounded border border-blue-300 px-4 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">
                        {testing === p.platform_key ? 'Testing…' : 'Test connection'}
                      </button>
                      <button disabled={saving === p.platform_key} onClick={() => save(p)} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
                        {saving === p.platform_key ? 'Saving…' : 'Save keys securely'}
                      </button>
                      <button disabled={saving === p.platform_key} onClick={() => save(p, !p.is_active)} className="rounded border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                    {testResult[p.platform_key] && (
                      <p className={`rounded p-2 text-xs ${testResult[p.platform_key].ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {testResult[p.platform_key].ok ? `✓ ${testResult[p.platform_key].detail}` : `✗ ${testResult[p.platform_key].reason}`}
                      </p>
                    )}
                    {message[p.platform_key] && (
                      <p className={`rounded p-2 text-xs ${message[p.platform_key].ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message[p.platform_key].text}
                      </p>
                    )}
                    <div className="grid gap-2 rounded bg-gray-50 p-3 text-xs sm:grid-cols-2">
                      <p><span className="font-medium">Last test:</span> {p.last_connection_test_status ?? 'never'}</p>
                      <p><span className="font-medium">Tested at:</span> {p.last_connection_test_at ? new Date(p.last_connection_test_at).toLocaleString() : 'never'}</p>
                      <p className="sm:col-span-2"><span className="font-medium">Evidence:</span> {p.last_connection_test_detail ?? 'No connection evidence recorded.'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Use Cases' && (
        <div className="space-y-3">
          {data.platforms.filter(p => p.use_cases?.length).map(p => (
            <div key={p.platform_key} className="app-card">
              <h3 className="font-semibold text-gray-800">{p.platform_name}</h3>
              {p.use_cases.map((u, i) => (
                <div key={i} className="mt-2 rounded border border-gray-100 p-2 text-sm">
                  <p className="font-medium text-gray-700">{u.title}</p>
                  <p className="text-xs text-gray-500">{u.description}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'Integration Scenarios' && (
        <ScenarioList scenarios={data.scenarios.filter(s => ['integration', 'response', 'operations'].includes(s.category))} />
      )}

      {tab === 'Marketing Scenarios' && (
        <ScenarioList scenarios={data.scenarios.filter(s => ['marketing', 'creative', 'intelligence'].includes(s.category))} />
      )}

      {tab === 'Customer Responses' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Customer Threads" value={data.responseSummary.threads} />
            <Stat label="Open Threads" value={data.responseSummary.open_threads} />
            <Stat label="Channel Events" value={data.responseSummary.events} />
            <Stat label="Needs Review" value={data.responseSummary.needs_review} />
          </div>
          <div className="app-card text-sm text-gray-600">
            <h2 className="font-semibold text-gray-800">Two-way event coverage</h2>
            <p className="mt-2">The shared ledger tracks impressions, views, clicks, reactions, likes, follows, shares, saves, comments, replies, mentions, direct messages, email delivery/open/click/reply, forms, leads, conversions, notifications, bounces and complaints.</p>
            <p className="mt-2 text-amber-700">Counts remain zero until a platform webhook, polling adapter, email provider or internal tracking endpoint delivers a real event. Saving credentials alone never fabricates engagement.</p>
          </div>
        </div>
      )}

      {tab === 'Operations & Debug' && (
        <div className="space-y-4">
          <div className="app-card">
            <h2 className="font-semibold text-gray-800">Operation runs by status</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {data.operationSummary.map(row => <Stat key={row.status} label={row.status} value={row.count} />)}
              {data.operationSummary.length === 0 && <p className="text-sm text-gray-400">No operation runs recorded.</p>}
            </div>
          </div>
          <div className="app-card">
            <h2 className="font-semibold text-gray-800">Generated assets by type and status</h2>
            <div className="mt-3 space-y-1">
              {data.assetSummary.map(row => (
                <div key={`${row.asset_type}-${row.status}`} className="flex justify-between rounded border border-gray-100 p-2 text-sm">
                  <span>{row.asset_type} · {row.status}</span><span className="font-semibold">{row.count}</span>
                </div>
              ))}
              {data.assetSummary.length === 0 && <p className="text-sm text-gray-400">No generated marketing assets recorded.</p>}
            </div>
          </div>
          <div className="app-card text-sm text-gray-600">
            Every execution should create an <code>operation_run</code>, append stage-level <code>operation_event</code> rows, attach errors to <code>error_occurrence</code>, and use circuit-breaker state for retry protection. Correlation and trace IDs support troubleshooting across tenant, platform and asset pipelines.
          </div>
        </div>
      )}

      {tab === 'Demo Scenarios' && (
        <div className="space-y-2">
          {data.platforms.filter(p => p.demo_scenario).map(p => (
            <div key={p.platform_key} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.platform_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${p.demo_scenario?.toLowerCase().includes('not runnable') ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                  {p.demo_scenario?.toLowerCase().includes('not runnable') ? 'blocked' : 'runnable today'}
                </span>
              </div>
              <p className="mt-1 text-gray-600">{p.demo_scenario}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Reports' && (
        <div className="app-card">
          <h2 className="mb-3 font-semibold text-gray-800">Automation jobs wired per platform</h2>
          <div className="space-y-1">
            {data.platforms.filter(p => p.automation_job).map(p => (
              <div key={p.platform_key} className="flex justify-between rounded border border-gray-100 p-2 text-sm">
                <span>{p.platform_name}</span>
                <span className="font-mono text-xs text-gray-500">{p.automation_job}</span>
              </div>
            ))}
            {!data.platforms.some(p => p.automation_job) && <p className="text-sm text-gray-400">No automation jobs wired yet.</p>}
          </div>
        </div>
      )}

      {tab === 'Monitoring' && (
        <div className="space-y-4">
        <div className="app-card space-y-2">
          <h2 className="font-semibold text-gray-800">Real health-check queries per platform</h2>
          <p className="text-xs text-gray-500">Copy-paste real SQL to check live status — no fabricated health indicator.</p>
          {data.platforms.filter(p => p.monitoring_query).map(p => (
            <div key={p.platform_key} className="rounded border border-gray-100 p-2">
              <p className="text-sm font-medium">{p.platform_name}</p>
              <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">{p.monitoring_query}</pre>
            </div>
          ))}
        </div>
        <div className="app-card space-y-2">
          <h2 className="font-semibold text-gray-800">Recent integration events</h2>
          {data.events.length === 0 && <p className="text-sm text-gray-400">No setup or connection events recorded yet.</p>}
          {data.events.map((event, index) => (
            <div key={`${event.platform_key}-${event.created_at}-${index}`} className="rounded border border-gray-100 p-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{event.platform_key} · {event.event_type.replaceAll('_', ' ')}</span>
                <span className="text-gray-400">{new Date(event.created_at).toLocaleString()}</span>
              </div>
              {event.detail && <p className="mt-1 text-gray-600">{event.detail}</p>}
            </div>
          ))}
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

function ScenarioList({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div className="space-y-3">
      {scenarios.map(scenario => (
        <div key={scenario.scenario_key} className="app-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-800">{scenario.title}</h2>
            <div className="flex gap-1 text-xs">
              <span className="rounded bg-gray-100 px-2 py-1">{scenario.direction.replace('_', ' ')}</span>
              <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">{scenario.execution_mode.replace('_', ' ')}</span>
              <span className={`rounded px-2 py-1 ${scenario.status === 'available' ? 'bg-green-100 text-green-700' : scenario.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{scenario.status}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">{scenario.description}</p>
          <div className="grid gap-3 text-xs md:grid-cols-2">
            <TagGroup label="Assets" values={scenario.asset_types} />
            <TagGroup label="Platforms" values={scenario.platform_keys.length ? scenario.platform_keys : ['cross-platform/internal']} />
            <TagGroup label="Tracked events" values={scenario.tracking_events.length ? scenario.tracking_events : ['operation events']} />
            <TagGroup label="Required capabilities" values={scenario.required_capabilities} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Demo / execution flow</p>
            <ol className="mt-1 flex flex-wrap gap-1 text-xs">
              {scenario.demo_steps.map((step, index) => <li key={`${step}-${index}`} className="rounded bg-gray-50 px-2 py-1">{index + 1}. {step}</li>)}
            </ol>
          </div>
          <p className="text-xs text-gray-400">Scale profile: {scenario.scale_profile.replaceAll('_', ' ')}</p>
        </div>
      ))}
    </div>
  );
}

function TagGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div><p className="font-medium text-gray-500">{label}</p><div className="mt-1 flex flex-wrap gap-1">{values.map(value => <span key={value} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{value.replaceAll('_', ' ')}</span>)}</div></div>
  );
}
