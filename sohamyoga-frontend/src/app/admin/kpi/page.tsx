'use client';

import { useCallback, useEffect, useState } from 'react';

interface KpiDimension {
  id: string;
  dimension_key: string;
  formula_version: number;
  period_start: string;
  period_end: string;
  value: string;
  unit: string;
  sample_size: number;
  confidence: string;
  explanation: string;
  computed_at: string;
}

type TabKey = 'Overview' | 'Snapshots' | 'Trends';
const TABS: TabKey[] = ['Overview', 'Snapshots', 'Trends'];

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-orange-100 text-orange-700',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

const DIMENSION_LABELS: Record<string, string> = {
  acquisition: 'Acquisition',
  engagement: 'Engagement',
  retention: 'Retention',
  wellness_outcomes: 'Wellness Outcomes',
  referral_growth: 'Referral Growth',
  reputation: 'Reputation',
  revenue: 'Revenue',
  operational_health: 'Operational Health',
};

const DIMENSION_COLORS: Record<string, string> = {
  acquisition: 'bg-blue-50 border-blue-200',
  engagement: 'bg-purple-50 border-purple-200',
  retention: 'bg-green-50 border-green-200',
  wellness_outcomes: 'bg-teal-50 border-teal-200',
  referral_growth: 'bg-indigo-50 border-indigo-200',
  reputation: 'bg-amber-50 border-amber-200',
  revenue: 'bg-emerald-50 border-emerald-200',
  operational_health: 'bg-gray-50 border-gray-200',
};

export default function KpiPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [dimensions, setDimensions] = useState<KpiDimension[]>([]);
  const [snapshots, setSnapshots] = useState<KpiDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/kpi', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ dimensions: [] }));
      setDimensions(data.dimensions ?? []);
      // For snapshots tab, fetch more
      const res2 = await fetch('/api/admin/kpi?all=1', { cache: 'no-store' });
      const data2 = await res2.json().catch(() => ({ dimensions: [] }));
      setSnapshots(data2.dimensions ?? data.dimensions ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/kpi', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [load]);

  // Build trend data: group snapshots by dimension_key, ordered by period_end
  const trends: Record<string, { period: string; value: number }[]> = {};
  snapshots.forEach((s) => {
    if (!trends[s.dimension_key]) trends[s.dimension_key] = [];
    trends[s.dimension_key].push({ period: s.period_end, value: Number(s.value) });
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">KPI Engine</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              8 executive dimensions from kpi_snapshot — real SQL aggregations, never placeholder numbers.
            </p>
          </div>
          <button
            onClick={runNow}
            disabled={running}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? 'Computing…' : 'Compute (trailing 30d)'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

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
          <div className="py-12 text-center text-sm text-gray-400">Loading KPI data…</div>
        ) : tab === 'Overview' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!dimensions.length && (
              <p className="col-span-2 py-12 text-center text-gray-400">
                No KPI snapshots recorded yet — click &quot;Compute&quot; above to generate the first snapshot.
              </p>
            )}
            {dimensions.map((d) => (
              <div
                key={d.dimension_key}
                className={`rounded-lg border p-5 shadow-sm ${DIMENSION_COLORS[d.dimension_key] ?? 'bg-white border-gray-200'}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    {DIMENSION_LABELS[d.dimension_key] ?? d.dimension_key}
                  </h3>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[d.confidence] ?? 'bg-gray-100 text-gray-600'}`}>
                    {d.confidence}
                  </span>
                </div>
                <div className="mb-1 text-3xl font-bold text-gray-900">
                  {Number(d.value).toLocaleString()}{' '}
                  <span className="text-sm font-normal text-gray-500">{d.unit}</span>
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  Sample: {d.sample_size} rows · {d.period_start} to {d.period_end}
                </p>
                <p className="text-sm text-gray-600">{d.explanation}</p>
              </div>
            ))}
          </div>
        ) : tab === 'Snapshots' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Dimension', 'Value', 'Unit', 'Period Start', 'Period End', 'Sample', 'Confidence', 'Computed At'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {DIMENSION_LABELS[s.dimension_key] ?? s.dimension_key}
                    </td>
                    <td className="px-3 py-2 font-bold text-gray-900">{Number(s.value).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{s.unit}</td>
                    <td className="px-3 py-2 text-gray-500">{s.period_start}</td>
                    <td className="px-3 py-2 text-gray-500">{s.period_end}</td>
                    <td className="px-3 py-2 text-gray-600">{s.sample_size}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[s.confidence] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.confidence}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(s.computed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!snapshots.length && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      No KPI snapshots recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Trends tab */
          <div className="space-y-4">
            {!Object.keys(trends).length && (
              <p className="py-12 text-center text-gray-400">
                No trend data — multiple compute runs needed to show trends.
              </p>
            )}
            {Object.entries(trends).map(([key, series]) => (
              <div key={key} className="rounded-lg border bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold text-gray-800">{DIMENSION_LABELS[key] ?? key}</h3>
                <div className="flex gap-3 overflow-x-auto">
                  {series.map((pt) => (
                    <div key={pt.period} className="flex min-w-[80px] flex-col items-center rounded border bg-gray-50 p-2 text-center">
                      <span className="text-lg font-bold text-gray-900">{Number(pt.value).toLocaleString()}</span>
                      <span className="mt-1 text-xs text-gray-400">{pt.period}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
