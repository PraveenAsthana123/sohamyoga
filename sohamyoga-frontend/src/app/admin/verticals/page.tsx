'use client';
// Vertical Pack Framework Admin Page — vertical registry overview,
// KPI dimension coverage, and pipeline job status.
// This instance operates in one real vertical: Yoga & Wellness Education.
// No fabricated packs for other verticals exist in this build.

import { useEffect, useState } from 'react';

const TABS = ['Dashboard', 'Registry', 'Report', 'Pipeline'] as const;
type Tab = (typeof TABS)[number];

interface VerticalPack {
  id: string;
  vertical_key: string;
  name: string;
  business_model_category: string;
  real_kpi_dimensions: string[];
  notes: string;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  education: 'bg-blue-100 text-blue-700',
  ecommerce: 'bg-green-100 text-green-700',
  saas: 'bg-purple-100 text-purple-700',
  healthcare: 'bg-red-100 text-red-700',
  hospitality: 'bg-amber-100 text-amber-700',
  professional_services: 'bg-indigo-100 text-indigo-700',
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function VerticalsPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [verticals, setVerticals] = useState<VerticalPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/vertical-packs', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load vertical packs');
        setVerticals(d.verticalPacks ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const totalDimensions = verticals.reduce((s, v) => s + v.real_kpi_dimensions.length, 0);
  const categoryMap = verticals.reduce<Record<string, number>>((acc, v) => {
    acc[v.business_model_category] = (acc[v.business_model_category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Vertical Pack Framework</h1>
        <p className="text-sm text-gray-500">
          Business vertical registry — KPI dimensions, model category, and framework coverage
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Dashboard */}
      {tab === 'Dashboard' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Active Verticals" value={verticals.length} sub="in registry" />
            <KpiCard label="KPI Dimensions" value={totalDimensions} sub="across all verticals" />
            <KpiCard label="Business Categories" value={Object.keys(categoryMap).length} />
          </div>

          <div className="rounded-xl border border-blue-50 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">Honest Registry Policy</p>
            <p className="mt-1 text-xs text-blue-700">
              Only real verticals this business operates in are registered here.
              No fabricated packs for Dental/Restaurant/Real-Estate etc. — those verticals
              have no real data or business relationship in this instance.
            </p>
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            <div className="space-y-4">
              {verticals.map(v => (
                <div key={v.id} className="rounded-xl border bg-white p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <h2 className="font-semibold text-gray-800">{v.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[v.business_model_category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {v.business_model_category}
                    </span>
                    <span className="font-mono text-xs text-gray-400">{v.vertical_key}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {v.real_kpi_dimensions.map(d => (
                      <span key={d} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
                        {d.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  {v.notes && <p className="mt-3 text-xs text-gray-400">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registry */}
      {tab === 'Registry' && (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Vertical Pack Registry ({verticals.length})</h2>
            <button onClick={load} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            verticals.length === 0 ? <p className="text-sm text-gray-400">No verticals registered.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold text-gray-500">
                      <th className="pb-2 pr-4">Vertical</th>
                      <th className="pb-2 pr-4">Key</th>
                      <th className="pb-2 pr-4">Category</th>
                      <th className="pb-2 pr-4">KPI Dimensions</th>
                      <th className="pb-2">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verticals.map(v => (
                      <tr key={v.id} className="border-b border-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">{v.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-gray-500">{v.vertical_key}</td>
                        <td className="py-2 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[v.business_model_category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {v.business_model_category}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="text-xs text-gray-600">{v.real_kpi_dimensions.length} dimensions</span>
                        </td>
                        <td className="py-2 text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* Report */}
      {tab === 'Report' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Verticals" value={verticals.length} />
            <KpiCard label="Total KPI Dimensions" value={totalDimensions} />
            <KpiCard label="Avg Dimensions" value={verticals.length ? Math.round(totalDimensions / verticals.length) : 0} sub="per vertical" />
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">KPI Dimension Coverage</h2>
            {verticals.map(v => (
              <div key={v.id} className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-800">{v.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {v.real_kpi_dimensions.map(d => (
                    <span key={d} className="rounded-full bg-green-50 border border-green-100 px-2 py-0.5 text-xs text-green-700 capitalize">
                      {d.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {verticals.length === 0 && <p className="text-sm text-gray-400">No verticals in registry.</p>}
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Business Model Categories</h2>
            {Object.entries(categoryMap).map(([cat, count]) => (
              <div key={cat} className="mb-2 flex items-center justify-between text-sm">
                <span className="capitalize text-gray-700">{cat.replace(/_/g, ' ')}</span>
                <span className="font-medium text-gray-900">{count} vertical{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {Object.keys(categoryMap).length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
            <p className="font-medium">Audit job</p>
            <p className="mt-1">
              <span className="font-mono">VerticalRegistryAuditJob</span> runs weekly (Sunday 5am) and
              checks each vertical&apos;s KPI dimensions against actual kpi_snapshot activity.
              Stale verticals (no activity in 30 days) and dimension mismatches are logged as warnings.
            </p>
          </div>
        </div>
      )}

      {/* Pipeline */}
      {tab === 'Pipeline' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-gray-800">VerticalRegistryAuditJob</p>
                <p className="text-xs text-gray-500">Weekly — Sunday 5am</p>
                <p className="mt-1 text-sm text-gray-600">
                  Audits all registered vertical packs: checks which verticals have had kpi_snapshot
                  activity in the last 30 days, and flags any whose declared KPI dimensions are
                  missing from the snapshot table. Results logged to job_log.
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">active</span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
            <p className="font-medium">Adding a new vertical</p>
            <p className="mt-1">
              Insert a row into the <span className="font-mono">vertical_pack</span> table with the real
              <span className="font-mono"> vertical_key</span>, <span className="font-mono">name</span>,
              <span className="font-mono"> business_model_category</span>, and the actual
              <span className="font-mono"> real_kpi_dimensions</span> this vertical tracks.
              Never add a vertical for which no real data exists in this instance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
