'use client';
// Was previously a fully fabricated dashboard: a hardcoded CONNECTIONS array
// claimed 14 services (incl. Keycloak, Qdrant) were "connected" with made-up
// health/call/error numbers, plus fake webhook/API-key/log tables. Replaced
// with real live health checks against /api/admin/integrations/health for the
// services this repo actually runs — everything else is honestly labeled, not
// invented.

import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Connections', 'Webhooks', 'API Keys', 'Logs'] as const;
type Tab = typeof TABS[number];

interface IntegrationResult {
  name: string; category: string;
  status: 'connected' | 'degraded' | 'not_configured' | 'error';
  latencyMs: number | null; detail: string;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', gray: 'bg-gray-50 border-gray-200 text-gray-600' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', gray: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.gray}`}>{children}</span>;
}

function statusColor(status: IntegrationResult['status']): string {
  return status === 'connected' ? 'green' : status === 'degraded' ? 'amber' : status === 'error' ? 'red' : 'gray';
}

function NotYetWiredCard({ tabName }: { tabName: string }) {
  return (
    <div className="border rounded-lg p-6 text-center">
      <p className="text-sm text-gray-500">
        No real {tabName.toLowerCase()} data source is wired into this app yet — this tab previously showed
        fabricated example rows, which have been removed. Build a real {tabName.toLowerCase()} tracking system
        here once one is actually needed, rather than displaying invented data.
      </p>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [results, setResults] = useState<IntegrationResult[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/health', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setResults(d?.integrations ?? []); setCheckedAt(d?.checkedAt ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const connected = results?.filter(r => r.status === 'connected').length ?? 0;
  const notConfigured = results?.filter(r => r.status === 'not_configured').length ?? 0;
  const errored = results?.filter(r => r.status === 'error' || r.status === 'degraded').length ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live health checks against real services this app runs. {checkedAt && `Last checked: ${new Date(checkedAt).toLocaleString()}`}
        </p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="border rounded-lg p-6 text-center text-sm text-gray-400">Checking live status…</div> : <>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Connected" value={String(connected)} sub="Real, live-checked" color="green" />
            <KpiCard label="Not Configured" value={String(notConfigured)} sub="Honest — no env vars set" color="gray" />
            <KpiCard label="Errors" value={String(errored)} sub="Configured but unreachable" color={errored > 0 ? 'rose' : 'blue'} />
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Service Status</h3>
            {(results ?? []).map(r => (
              <div key={r.name} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="font-medium">{r.name} <span className="text-xs text-gray-400">({r.category})</span></span>
                <div className="flex items-center gap-2">
                  {r.latencyMs !== null && <span className="text-xs text-gray-500">{r.latencyMs}ms</span>}
                  <Badge color={statusColor(r.status)}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Connections' && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">All Checked Services ({results?.length ?? 0})</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Service', 'Category', 'Status', 'Latency', 'Detail'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(results ?? []).map(r => (
                <tr key={r.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2"><Badge>{r.category}</Badge></td>
                  <td className="px-3 py-2"><Badge color={statusColor(r.status)}>{r.status}</Badge></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.latencyMs !== null ? `${r.latencyMs}ms` : '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 text-xs text-gray-400">
            Only services with real, checkable client code in this repo appear here (Postgres, Ollama, OpenBao, Postiz,
            Activepieces). Other tools mentioned elsewhere in this codebase (Keycloak, Qdrant, Mautic, Skyvern, Asterisk,
            etc.) aren&apos;t wired into this specific health-check yet — add a real check function in
            <code className="mx-1 rounded bg-gray-100 px-1">src/lib/integrationHealth.ts</code> before showing them here.
          </div>
        </div>
      )}

      {tab === 'Webhooks' && <NotYetWiredCard tabName="Webhooks" />}
      {tab === 'API Keys' && <NotYetWiredCard tabName="API Keys" />}
      {tab === 'Logs' && <NotYetWiredCard tabName="Logs" />}
      </>}
    </div>
  );
}
