'use client';

// The "what has actually been done" dashboard — one real, live-queried page
// so "have you done X platform/feature" always has a checkable answer
// instead of a fresh answer re-derived in chat every time.

import { useEffect, useState } from 'react';

interface Platform {
  platform: string;
  displayName: string;
  postizSupport: string;
  notes: string;
  connectedAccounts: number;
  status: 'connected' | 'capability_only';
}
interface Capability {
  name: string;
  status: 'real' | 'partial' | 'not_built' | 'not_connected' | 'blocked';
  evidence: string;
}
interface DemoShowcase {
  demoFamilies: string[];
  lastRun: { at: string | null; passed: number; failed: number; stale: boolean };
}
interface BuildStatus {
  platforms: Platform[];
  notBuilt: string[];
  capabilities: Capability[];
  demoShowcase: DemoShowcase;
  generatedAt: string;
}

const statusColor: Record<string, string> = {
  real: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  connected: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  partial: 'bg-amber-100 text-amber-800 border-amber-300',
  capability_only: 'bg-amber-100 text-amber-800 border-amber-300',
  blocked: 'bg-orange-100 text-orange-800 border-orange-300',
  not_connected: 'bg-gray-100 text-gray-600 border-gray-300',
  not_built: 'bg-red-100 text-red-700 border-red-300',
};
const statusLabel: Record<string, string> = {
  real: 'Real', connected: 'Connected', partial: 'Partial', capability_only: 'Capability only, 0 connected',
  blocked: 'Blocked (external dependency)', not_connected: 'Not connected', not_built: 'Not built',
};

export default function BuildStatusPage() {
  const [data, setData] = useState<BuildStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/build-status', { cache: 'no-store' })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading real build status…</div>;
  if (!data) return <div className="p-6 text-sm text-red-600">Failed to load.</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Build Status — What&apos;s Actually Done</h1>
        <p className="text-sm text-gray-500">
          Live-queried, not a static claim. Generated {new Date(data.generatedAt).toLocaleString()}.
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">
          End-to-end demo showcase — {data.demoShowcase.demoFamilies.length} real demo families
        </h2>
        <div className={`mb-3 rounded-lg border p-3 ${data.demoShowcase.lastRun.at ? (data.demoShowcase.lastRun.stale ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50') : 'border-gray-300 bg-gray-50'}`}>
          {data.demoShowcase.lastRun.at ? (
            <>
              <span className="font-semibold">{data.demoShowcase.lastRun.passed}</span> passed,{' '}
              <span className="font-semibold">{data.demoShowcase.lastRun.failed}</span> failed — last real run{' '}
              {new Date(data.demoShowcase.lastRun.at).toLocaleString()}
              {data.demoShowcase.lastRun.stale && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">STALE — re-run to confirm current state</span>}
            </>
          ) : (
            <span className="text-gray-500">No recorded run yet — these are spec files on disk, not yet proven passing.</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {data.demoShowcase.demoFamilies.map(name => (
            <div key={name} className="truncate rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700" title={name}>{name}</div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Core capabilities</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.capabilities.map(c => (
            <div key={c.name} className={`rounded-lg border p-3 ${statusColor[c.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold">{statusLabel[c.status]}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">{c.evidence}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Social platforms — {data.platforms.filter(p => p.status === 'connected').length} of {data.platforms.length} connected</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="p-2">Platform</th><th className="p-2">Path</th><th className="p-2">Status</th><th className="p-2">Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.platforms.map(p => (
                <tr key={p.platform}>
                  <td className="p-2 font-medium">{p.displayName}</td>
                  <td className="p-2 text-xs text-gray-500">{p.postizSupport}</td>
                  <td className="p-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor[p.status]}`}>{statusLabel[p.status]}{p.connectedAccounts > 0 ? ` (${p.connectedAccounts})` : ''}</span></td>
                  <td className="p-2 text-xs text-gray-500">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-red-700">Confirmed not built anywhere in this codebase</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <ul className="grid gap-1 sm:grid-cols-2">
            {data.notBuilt.map(item => (
              <li key={item} className="text-xs text-red-800">✗ {item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
