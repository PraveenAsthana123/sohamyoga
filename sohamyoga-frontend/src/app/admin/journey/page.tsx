'use client';

import { useCallback, useEffect, useState } from 'react';

interface Journey {
  id: string;
  customer_id: string;
  current_phase: string;
  status: string;
  weekly_target_minutes: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_session_count: number;
  total_minutes: number;
  joined_at: string;
  last_practice_at: string | null;
  updated_at: string;
  touchpoint_count: string;
}

interface AuditRow {
  id: string;
  action: string;
  actor: string;
  customer_id: string | null;
  legal_basis: string | null;
  created_at: string;
}

interface Summary {
  total: string;
  active: string;
  completed: string;
  avg_touchpoints: string;
}

type TabKey = 'Overview' | 'Active Journeys' | 'Touchpoints' | 'Audit';
const TABS: TabKey[] = ['Overview', 'Active Journeys', 'Touchpoints', 'Audit'];

const VALID_STATUSES = ['new', 'active', 'paused', 'completed', 'churned'];

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-gray-100 text-gray-700',
  churned: 'bg-red-100 text-red-700',
};

const PHASE_COLOR: Record<string, string> = {
  onboarding: 'bg-purple-100 text-purple-700',
  habit_forming: 'bg-blue-100 text-blue-700',
  deepening: 'bg-indigo-100 text-indigo-700',
  community: 'bg-teal-100 text-teal-700',
  ambassador: 'bg-green-100 text-green-700',
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

export default function JourneyAdminPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/journey', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setJourneys(data.journeys ?? []);
      setAudit(data.audit ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      await fetch('/api/admin/journey', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      load();
    },
    [load],
  );

  const active = journeys.filter((j) => ['new', 'active'].includes(j.status));
  const byPhase: Record<string, number> = {};
  journeys.forEach((j) => { byPhase[j.current_phase] = (byPhase[j.current_phase] ?? 0) + 1; });

  const totalTouchpoints = journeys.reduce((sum, j) => sum + Number(j.touchpoint_count), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Customer Journey</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Per-contact journey phases, touchpoints, and audit trail from customer_journey + journey_touchpoint.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Journeys" value={summary?.total ?? '—'} color="blue" />
          <KpiCard label="Active / New" value={summary?.active ?? '—'} color="green" />
          <KpiCard label="Completed" value={summary?.completed ?? '—'} color="gray" />
          <KpiCard label="Avg Sessions" value={summary?.avg_touchpoints ?? '—'} sub="per journey" color="blue" />
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
          <div className="py-12 text-center text-sm text-gray-400">Loading journeys…</div>
        ) : tab === 'Overview' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">By Phase</h3>
              {Object.entries(byPhase).map(([phase, count]) => (
                <div key={phase} className="mb-2 flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLOR[phase] ?? 'bg-gray-100 text-gray-600'}`}>
                    {phase.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium text-gray-700">{count}</span>
                </div>
              ))}
              {!Object.keys(byPhase).length && <p className="text-sm text-gray-400">No journey data yet.</p>}
            </div>
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">By Status</h3>
              {VALID_STATUSES.map((s) => {
                const count = journeys.filter((j) => j.status === s).length;
                return (
                  <div key={s} className="mb-2 flex items-center justify-between text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s]}`}>
                      {s}
                    </span>
                    <span className="font-medium text-gray-700">{count}</span>
                  </div>
                );
              })}
              <p className="mt-4 text-xs text-gray-500">Total recorded touchpoints: {totalTouchpoints}</p>
            </div>
          </div>
        ) : tab === 'Active Journeys' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Customer ID', 'Phase', 'Status', 'Streak', 'Sessions', 'Touchpoints', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {journeys.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-gray-500">{j.customer_id}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLOR[j.current_phase] ?? 'bg-gray-100 text-gray-600'}`}>
                        {j.current_phase.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={j.status}
                        onChange={(e) => updateStatus(j.id, e.target.value)}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {VALID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{j.current_streak_days}d</td>
                    <td className="px-3 py-2 text-gray-700">{j.total_session_count}</td>
                    <td className="px-3 py-2 text-gray-700">{j.touchpoint_count}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(j.joined_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{j.last_practice_at ? new Date(j.last_practice_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {!journeys.length && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">No journeys recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'Touchpoints' ? (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-800">Touchpoint Summary by Customer</h3>
            <p className="mb-4 text-sm text-gray-500">
              Touchpoints are recorded in journey_touchpoint keyed by contact_identifier (customer email or ID). Search individual contacts from the customer journey lookup tool.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Customer ID</th>
                    <th className="px-3 py-2 text-left">Phase</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Sessions</th>
                    <th className="px-3 py-2 text-left">Total Minutes</th>
                    <th className="px-3 py-2 text-left">Touchpoints</th>
                    <th className="px-3 py-2 text-left">Last Practice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {journeys.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-gray-500">{j.customer_id}</td>
                      <td className="px-3 py-2 text-gray-600">{j.current_phase.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-600'}`}>{j.status}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{j.total_session_count}</td>
                      <td className="px-3 py-2 text-gray-700">{j.total_minutes}min</td>
                      <td className="px-3 py-2 font-medium text-gray-700">{j.touchpoint_count}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{j.last_practice_at ? new Date(j.last_practice_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {!journeys.length && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400">No data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Audit tab */
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Action', 'Actor', 'Customer', 'Legal Basis', 'Time'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audit.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{a.action}</td>
                    <td className="px-3 py-2 text-gray-600">{a.actor}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-gray-500">{a.customer_id ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{a.legal_basis ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!audit.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No audit entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
