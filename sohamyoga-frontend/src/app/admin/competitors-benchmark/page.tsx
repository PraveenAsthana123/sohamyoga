'use client';

import { useCallback, useEffect, useState } from 'react';

interface CompetitorRow {
  id: string;
  name: string;
  website: string | null;
  notes: string;
  created_at: string;
}

interface ScoreRow {
  id: string;
  competitor_id: string;
  competitor_name: string;
  dimension: string;
  score: number;
  observed_at: string;
  notes: string;
  created_at: string;
}

interface SummaryRow {
  competitor_id: string;
  competitor_name: string;
  avg_score: number | null;
  score_count: number;
  dimensions: Record<string, number>;
}

interface Stats {
  totalCompetitors: number;
  totalScores: number;
  overallAvgScore: number | null;
}

type TabKey = 'Overview' | 'Scores' | 'Competitors' | 'Add Score';
const TABS: TabKey[] = ['Overview', 'Scores', 'Competitors', 'Add Score'];

const DIMENSIONS = [
  'discoverability', 'website_quality', 'seo', 'local_presence',
  'reputation', 'social_presence', 'content_quality', 'pricing_competitiveness',
];

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

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700">{score}</span>
    </div>
  );
}

export default function CompetitorsBenchmarkPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ competitor_id: '', dimension: DIMENSIONS[0], score: '', notes: '', observed_at: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/competitors-benchmark', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCompetitors(data.competitors ?? []);
      setScores(data.scores ?? []);
      setSummary(data.summary ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/admin/competitors-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor_id: form.competitor_id,
          dimension: form.dimension,
          score: Number(form.score),
          observed_at: form.observed_at || undefined,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSubmitSuccess(true);
      setForm({ ...form, score: '', notes: '' });
      load();
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const sortedByScore = [...summary].sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
  const topCompetitor = sortedByScore[0];
  const bottomCompetitor = sortedByScore[sortedByScore.length - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Competitor Benchmark</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Real admin-entered scores across 8 dimensions per competitor from competitor_benchmark_score.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Competitors" value={stats?.totalCompetitors ?? '—'} color="blue" />
          <KpiCard
            label="Avg Score"
            value={stats?.overallAvgScore !== null && stats?.overallAvgScore !== undefined ? `${stats.overallAvgScore}/100` : '—'}
            sub="across all dimensions"
            color="green"
          />
          <KpiCard
            label="Top Ranked"
            value={topCompetitor?.competitor_name ?? '—'}
            sub={topCompetitor ? `avg ${topCompetitor.avg_score}/100` : undefined}
            color="green"
          />
          <KpiCard
            label="Lowest Ranked"
            value={bottomCompetitor && summary.length > 1 ? bottomCompetitor.competitor_name : '—'}
            sub={bottomCompetitor && summary.length > 1 ? `avg ${bottomCompetitor.avg_score}/100` : undefined}
            color="amber"
          />
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
          <div className="py-12 text-center text-sm text-gray-400">Loading benchmark data…</div>
        ) : tab === 'Overview' ? (
          <div className="space-y-4">
            {!summary.length && (
              <p className="py-12 text-center text-gray-400">
                No benchmark data yet. Add competitors via the Competitors page, then record scores using the &quot;Add Score&quot; tab.
              </p>
            )}
            {summary.map((s) => (
              <div key={s.competitor_id} className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{s.competitor_name}</h3>
                  <span className="text-sm font-bold text-indigo-600">
                    {s.avg_score !== null ? `${s.avg_score}/100 avg` : 'No scores'} · {s.score_count}/8 dimensions
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {DIMENSIONS.map((dim) => (
                    <div key={dim} className="rounded border bg-gray-50 p-2">
                      <p className="mb-1 text-xs text-gray-500">{dim.replace(/_/g, ' ')}</p>
                      {s.dimensions[dim] !== undefined ? (
                        <ScoreBar score={s.dimensions[dim]} />
                      ) : (
                        <p className="text-xs text-gray-300">not scored</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'Scores' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Competitor', 'Dimension', 'Score', 'Observed', 'Notes'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scores.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{s.competitor_name}</td>
                    <td className="px-3 py-2 text-gray-600">{s.dimension.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">
                      <ScoreBar score={s.score} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{s.observed_at}</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-gray-500">{s.notes || '—'}</td>
                  </tr>
                ))}
                {!scores.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No scores recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'Competitors' ? (
          <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Name', 'Website', 'Notes', 'Dimensions Scored', 'Avg Score', 'Added'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {competitors.map((c) => {
                  const s = summary.find((sm) => sm.competitor_id === c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{c.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {c.website ? (
                          <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[120px] block">
                            {c.website}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="max-w-xs px-3 py-2 text-xs text-gray-500">{c.notes || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{s?.score_count ?? 0}/8</td>
                      <td className="px-3 py-2 text-gray-700">{s?.avg_score !== null && s?.avg_score !== undefined ? `${s.avg_score}/100` : '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {!competitors.length && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No competitors yet — add via the Competitors admin page first.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Add Score tab */
          <div className="mx-auto max-w-lg rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-800">Record a New Benchmark Score</h3>
            {submitSuccess && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Score recorded (or updated for that competitor+dimension+date).
              </div>
            )}
            {submitError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Competitor</label>
                <select
                  value={form.competitor_id}
                  onChange={(e) => setForm({ ...form, competitor_id: e.target.value })}
                  className="w-full rounded border px-3 py-1.5 text-sm"
                >
                  <option value="">Select competitor…</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {!competitors.length && (
                  <p className="mt-1 text-xs text-gray-400">Add competitors first via the Competitors admin page.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Dimension</label>
                  <select
                    value={form.dimension}
                    onChange={(e) => setForm({ ...form, dimension: e.target.value })}
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  >
                    {DIMENSIONS.map((d) => (
                      <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Score (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.score}
                    onChange={(e) => setForm({ ...form, score: e.target.value })}
                    placeholder="0–100"
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Observed Date (optional)</label>
                <input
                  type="date"
                  value={form.observed_at}
                  onChange={(e) => setForm({ ...form, observed_at: e.target.value })}
                  className="w-full rounded border px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Notes (what you observed)</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Brief observation notes…"
                  className="w-full rounded border px-3 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.competitor_id || !form.dimension || !form.score}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Record Score'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
