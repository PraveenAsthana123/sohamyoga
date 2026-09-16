'use client';

import { useEffect, useState, useCallback } from 'react';

interface ProfileStats {
  total: number; activeThisWeek: number; pregnancyMode: number;
  seniorMode: number; kidsMode: number; doctorCleared: number;
}
interface HealthSnapshot {
  id: string; captured_at: string; revenue_last_24h: string;
  new_leads_last_24h: number; bookings_last_24h: number;
  db_reachable: boolean; db_query_ms: number | null;
}
interface WellnessStats { total: number; avgScore: number | null }
interface HealthData {
  profiles: ProfileStats; snapshots: HealthSnapshot[];
  snapshotsToday: number; wellness: WellnessStats;
}

type Tab = 'overview' | 'profiles' | 'snapshots' | 'wellness';

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function FitnessBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span><span>{value} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HealthDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load health data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'profiles', label: `Profiles (${data?.profiles.total ?? '…'})` },
    { key: 'snapshots', label: `Snapshots (${data?.snapshots.length ?? '…'})` },
    { key: 'wellness', label: 'Wellness' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Health Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Member health profiles, system health snapshots, and wellness scores</p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Profiles" value={data?.profiles.total ?? '—'} />
          <KpiCard label="Active This Week" value={data?.profiles.activeThisWeek ?? '—'} color="text-green-700" />
          <KpiCard label="Avg Wellness Score" value={data?.wellness.avgScore !== null && data?.wellness.avgScore !== undefined ? `${data.wellness.avgScore}/100` : '—'} />
          <KpiCard label="Snapshots Today" value={data?.snapshotsToday ?? '—'} sub="system health checks" />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-gray-400">Loading health data…</p>}

        {!loading && data && tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-4">Profile Breakdown</h2>
                <div className="space-y-3">
                  <FitnessBar label="Active This Week" value={data.profiles.activeThisWeek} max={data.profiles.total} />
                  <FitnessBar label="Doctor Cleared" value={data.profiles.doctorCleared} max={data.profiles.total} />
                  <FitnessBar label="Pregnancy Mode" value={data.profiles.pregnancyMode} max={data.profiles.total} />
                  <FitnessBar label="Senior Mode" value={data.profiles.seniorMode} max={data.profiles.total} />
                  <FitnessBar label="Kids Mode" value={data.profiles.kidsMode} max={data.profiles.total} />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-4">System Health Summary</h2>
                {data.snapshots.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Latest Snapshot</span>
                      <span className="text-sm font-medium">{new Date(data.snapshots[0].captured_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">DB Reachable</span>
                      <span className={`text-sm font-medium ${data.snapshots[0].db_reachable ? 'text-green-600' : 'text-red-600'}`}>
                        {data.snapshots[0].db_reachable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">DB Query Time</span>
                      <span className="text-sm font-medium">{data.snapshots[0].db_query_ms !== null ? `${data.snapshots[0].db_query_ms}ms` : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Revenue (24h)</span>
                      <span className="text-sm font-medium">${Number(data.snapshots[0].revenue_last_24h).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">New Leads (24h)</span>
                      <span className="text-sm font-medium">{data.snapshots[0].new_leads_last_24h}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-600">Bookings (24h)</span>
                      <span className="text-sm font-medium">{data.snapshots[0].bookings_last_24h}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No snapshots available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && data && tab === 'profiles' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Health Profile Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Profiles', value: data.profiles.total },
                { label: 'Active This Week', value: data.profiles.activeThisWeek },
                { label: 'Doctor Cleared', value: data.profiles.doctorCleared },
                { label: 'Pregnancy Mode', value: data.profiles.pregnancyMode },
                { label: 'Senior Mode', value: data.profiles.seniorMode },
                { label: 'Kids Mode', value: data.profiles.kidsMode },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{item.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">Health profiles are read-only — managed by members via the customer portal.</p>
          </div>
        )}

        {!loading && data && tab === 'snapshots' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">System Health Snapshots (last 50)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3">Captured At</th>
                    <th className="px-4 py-3">DB</th>
                    <th className="px-4 py-3">DB (ms)</th>
                    <th className="px-4 py-3">Revenue 24h</th>
                    <th className="px-4 py-3">Leads 24h</th>
                    <th className="px-4 py-3">Bookings 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(s.captured_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.db_reachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.db_reachable ? 'OK' : 'DOWN'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.db_query_ms !== null ? `${s.db_query_ms}ms` : '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">${Number(s.revenue_last_24h).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{s.new_leads_last_24h}</td>
                      <td className="px-4 py-3 text-gray-600">{s.bookings_last_24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.snapshots.length && <p className="text-center text-sm text-gray-400 py-8">No snapshots found.</p>}
            </div>
          </div>
        )}

        {!loading && data && tab === 'wellness' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Wellness Audit Data</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 rounded-lg p-5 text-center">
                <p className="text-4xl font-bold text-indigo-700">
                  {data.wellness.avgScore !== null ? data.wellness.avgScore : '—'}
                </p>
                <p className="text-sm text-indigo-600 mt-1">Average Wellness Score</p>
                {data.wellness.avgScore !== null && <p className="text-xs text-gray-500 mt-1">out of 100</p>}
              </div>
              <div className="bg-gray-50 rounded-lg p-5 text-center">
                <p className="text-4xl font-bold text-gray-800">{data.wellness.total.toLocaleString()}</p>
                <p className="text-sm text-gray-600 mt-1">Total Wellness Audits</p>
              </div>
            </div>
            {data.wellness.total === 0 && (
              <p className="text-sm text-gray-400 mt-4 text-center">No wellness audit data available yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
