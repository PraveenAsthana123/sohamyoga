'use client';

import { useCallback, useEffect, useState } from 'react';

interface IntegrationRow {
  id: string;
  integration_key: string;
  name: string;
  install_status: string;
  config_status: string;
  runtime_status: string;
  endpoint: string | null;
  enabled: boolean;
  requires_credentials: boolean;
  last_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CallCount {
  provider: string;
  call_count: string;
  success_count: string;
  error_count: string;
}

interface ScenarioRow {
  scenario_key: string;
  category: string;
  title: string;
  direction: string;
  execution_mode: string;
  status: string;
  created_at: string;
}

interface Summary {
  total: number;
  active: number;
  inactive: number;
  calls30d: number;
  scenarios: number;
}

type TabKey = 'Overview' | 'Integrations' | 'Calls' | 'Scenarios';
const TABS: TabKey[] = ['Overview', 'Integrations', 'Calls', 'Scenarios'];

const STATUS_COLOR: Record<string, string> = {
  installed: 'bg-green-100 text-green-700',
  not_installed: 'bg-gray-100 text-gray-500',
  error: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
};

const SCENARIO_STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  planned: 'bg-gray-100 text-gray-500',
};

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [callCounts, setCallCounts] = useState<CallCount[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setIntegrations(data.integrations ?? []);
      setCallCounts(data.callCounts ?? []);
      setScenarios(data.scenarios ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      load();
    },
    [load],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            integration_master registry, last-30d call metrics, and scenario catalog.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Integrations" value={summary?.total ?? '—'} color="blue" />
          <KpiCard label="Enabled" value={summary?.active ?? '—'} color="green" />
          <KpiCard label="Calls (30d)" value={summary?.calls30d ?? '—'} sub="across all providers" color="blue" />
          <KpiCard label="Scenarios" value={summary?.scenarios ?? '—'} color="gray" />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading integrations…</div>
        ) : tab === 'Overview' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">Enabled Integrations ({summary?.active ?? 0})</h3>
              {integrations.filter((i) => i.enabled).map((i) => (
                <div key={i.id} className="mb-2 flex items-center justify-between rounded border-b pb-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium text-gray-800">{i.name}</span>
                    <span className="ml-2 font-mono text-xs text-gray-400">{i.integration_key}</span>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[i.runtime_status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {i.runtime_status}
                  </span>
                </div>
              ))}
              {!integrations.filter((i) => i.enabled).length && (
                <p className="text-sm text-gray-400">No integrations enabled yet.</p>
              )}
            </div>
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">Top Providers by Calls (30d)</h3>
              {callCounts.slice(0, 8).map((c) => (
                <div key={c.provider} className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{c.provider}</span>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="text-green-600">✓ {c.success_count}</span>
                    <span className="text-red-600">✗ {c.error_count}</span>
                    <span className="font-bold text-gray-700">{c.call_count}</span>
                  </div>
                </div>
              ))}
              {!callCounts.length && (
                <p className="text-sm text-gray-400">No calls recorded in the last 30 days.</p>
              )}
            </div>
          </div>
        ) : tab === 'Integrations' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Name', 'Key', 'Install', 'Config', 'Runtime', 'Enabled', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {integrations.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{i.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{i.integration_key}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[i.install_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {i.install_status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[i.config_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {i.config_status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[i.runtime_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {i.runtime_status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i.enabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleEnabled(i.id, !i.enabled)}
                        className={`rounded px-2 py-1 text-xs font-medium ${i.enabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        {i.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!integrations.length && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">No integrations in registry.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'Calls' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">API Calls — Last 30 Days by Provider</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Provider', 'Total Calls', 'Successful', 'Errors', 'Success Rate'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {callCounts.map((c) => {
                  const total = Number(c.call_count);
                  const success = Number(c.success_count);
                  const rate = total > 0 ? Math.round((success / total) * 100) : 0;
                  return (
                    <tr key={c.provider} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{c.provider}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">{total.toLocaleString()}</td>
                      <td className="px-3 py-2 text-green-600">{success.toLocaleString()}</td>
                      <td className="px-3 py-2 text-red-600">{c.error_count}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${rate >= 90 ? 'bg-green-100 text-green-700' : rate >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!callCounts.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No call data for the last 30 days.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Scenarios tab */
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Key', 'Title', 'Category', 'Direction', 'Execution Mode', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scenarios.map((s) => (
                  <tr key={s.scenario_key} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{s.scenario_key}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{s.title}</td>
                    <td className="px-3 py-2 text-gray-500">{s.category}</td>
                    <td className="px-3 py-2 text-gray-500">{s.direction}</td>
                    <td className="px-3 py-2 text-gray-500">{s.execution_mode}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${SCENARIO_STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!scenarios.length && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No scenarios in registry.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
