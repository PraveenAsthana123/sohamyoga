'use client';
import { useEffect, useState } from 'react';

const TABS = ['vs_industry', 'trends', 'improvement_plan'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  vs_industry: 'vs Industry',
  trends: 'Trends',
  improvement_plan: 'Improvement Plan',
};

interface MetricSet {
  client_retention_rate: number;
  avg_campaign_roi: number;
  avg_time_to_launch_days: number;
  client_satisfaction_score: number;
  mrr_growth_percent: number;
  avg_retainer_cad: number;
}

interface TrendRow {
  month: string;
  client_retention_rate: number;
  avg_campaign_roi: number;
  avg_time_to_launch_days: number;
  client_satisfaction_score: number;
  mrr_growth_percent: number;
  avg_retainer_cad: number;
}

interface BenchmarkData {
  agency: MetricSet;
  industry_avg: MetricSet;
  top_quartile: MetricSet;
  trends: TrendRow[];
}

const METRIC_DEFS: {
  key: keyof MetricSet;
  label: string;
  fmt: (v: number) => string;
  higherIsBetter: boolean;
}[] = [
  { key: 'client_retention_rate', label: 'Client Retention Rate', fmt: v => `${v}%`, higherIsBetter: true },
  { key: 'avg_campaign_roi', label: 'Avg Campaign ROI', fmt: v => `${v}x`, higherIsBetter: true },
  { key: 'avg_time_to_launch_days', label: 'Avg Time to Launch', fmt: v => `${v} days`, higherIsBetter: false },
  { key: 'client_satisfaction_score', label: 'Client Satisfaction', fmt: v => `${v}/5`, higherIsBetter: true },
  { key: 'mrr_growth_percent', label: 'MRR Growth', fmt: v => `${v}%`, higherIsBetter: true },
  { key: 'avg_retainer_cad', label: 'Avg Retainer (CAD)', fmt: v => `$${v.toLocaleString()}`, higherIsBetter: true },
];

function pctDiff(agency: number, benchmark: number, higherIsBetter: boolean): { label: string; positive: boolean } {
  if (benchmark === 0) return { label: '—', positive: true };
  const diff = ((agency - benchmark) / benchmark) * 100;
  const positive = higherIsBetter ? diff >= 0 : diff <= 0;
  const sign = diff >= 0 ? '+' : '';
  return { label: `${sign}${diff.toFixed(1)}%`, positive };
}

export default function AgencyBenchmarkPage() {
  const [tab, setTab] = useState<Tab>('vs_industry');
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    fetch('/api/admin/agency-benchmark', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load benchmark data.'); setLoading(false); });
  }, []);

  async function fetchAiPlan() {
    if (!data) return;
    setAiLoading(true);
    setAiError('');
    setAiText('');

    // Build gaps list vs top quartile
    const gaps = METRIC_DEFS
      .filter(m => {
        const agency = data.agency[m.key];
        const tq = data.top_quartile[m.key];
        if (m.higherIsBetter) return agency < tq;
        return agency > tq;
      })
      .map(m => {
        const agency = data.agency[m.key];
        const tq = data.top_quartile[m.key];
        return `${m.label}: agency is at ${m.fmt(agency)}, top quartile is ${m.fmt(tq)}`;
      });

    const prompt = gaps.length === 0
      ? 'We are a digital marketing agency that meets or exceeds top quartile benchmarks in all areas. Give 5 specific actionable improvements to stay ahead and grow. Be concise.'
      : `We are a digital marketing agency. Based on these gaps vs top quartile: ${gaps.join('; ')}, give 5 specific actionable improvements. Be concise.`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const d = await res.json();
      if (!res.ok) { setAiError(d.error ?? 'AI generation failed.'); }
      else { setAiText(d.text ?? ''); }
    } catch {
      setAiError('Failed to reach AI service.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Agency Performance Benchmarking</h1>
        <p className="mt-1 text-sm text-gray-500">Compare your agency metrics against industry averages and top-quartile performers.</p>
      </header>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">Loading benchmark data…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* VS INDUSTRY TAB */}
          {tab === 'vs_industry' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3 text-center">Your Agency</th>
                    <th className="px-4 py-3 text-center">Industry Avg</th>
                    <th className="px-4 py-3 text-center">Top Quartile</th>
                    <th className="px-4 py-3 text-center">vs Industry Avg</th>
                    <th className="px-4 py-3 text-center">vs Top Quartile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {METRIC_DEFS.map(m => {
                    const agency = data.agency[m.key];
                    const ind = data.industry_avg[m.key];
                    const tq = data.top_quartile[m.key];
                    const vsInd = pctDiff(agency, ind, m.higherIsBetter);
                    const vsTq = pctDiff(agency, tq, m.higherIsBetter);
                    return (
                      <tr key={m.key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">{m.fmt(agency)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{m.fmt(ind)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{m.fmt(tq)}</td>
                        <td className={`px-4 py-3 text-center font-medium ${vsInd.positive ? 'text-green-600' : 'text-red-600'}`}>
                          {vsInd.label}
                        </td>
                        <td className={`px-4 py-3 text-center font-medium ${vsTq.positive ? 'text-green-600' : 'text-amber-600'}`}>
                          {vsTq.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                Industry benchmarks sourced from agency performance data snapshot · Updated 2026-09-16
              </div>
            </div>
          )}

          {/* TRENDS TAB */}
          {tab === 'trends' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">6-month agency performance history. Upward trend across all key metrics.</p>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Month</th>
                      {METRIC_DEFS.map(m => (
                        <th key={m.key} className="px-4 py-3 text-center">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.trends.map((row, i) => {
                      const prev = i > 0 ? data.trends[i - 1] : null;
                      return (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{row.month}</td>
                          {METRIC_DEFS.map(m => {
                            const val = row[m.key];
                            const prevVal = prev?.[m.key] ?? null;
                            const improved = prevVal !== null
                              ? (m.higherIsBetter ? val > prevVal : val < prevVal)
                              : null;
                            return (
                              <td key={m.key} className="px-4 py-3 text-center">
                                <span className={improved === true ? 'text-green-600 font-medium' : improved === false ? 'text-red-500' : 'text-gray-600'}>
                                  {m.fmt(val)}
                                  {improved === true && ' ↑'}
                                  {improved === false && ' ↓'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Visual trend bars for retention and ROI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'client_retention_rate' as const, label: 'Client Retention Rate (%)', max: 100 },
                  { key: 'avg_campaign_roi' as const, label: 'Avg Campaign ROI (x)', max: 6 },
                ].map(({ key, label, max }) => (
                  <div key={key} className="bg-white rounded-lg border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-3 text-sm">{label}</h3>
                    <div className="space-y-2">
                      {data.trends.map(row => {
                        const val = row[key];
                        const barPct = Math.round((val / max) * 100);
                        return (
                          <div key={row.month} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 font-mono">{row.month}</span>
                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                              <div className="h-full bg-blue-500 rounded" style={{ width: `${barPct}%` }} />
                            </div>
                            <span className="text-xs font-medium w-10 text-right text-gray-700">
                              {key === 'client_retention_rate' ? `${val}%` : `${val}x`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IMPROVEMENT PLAN TAB */}
          {tab === 'improvement_plan' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">Gaps vs Top Quartile</h3>
                {METRIC_DEFS.filter(m => {
                  const agency = data.agency[m.key];
                  const tq = data.top_quartile[m.key];
                  return m.higherIsBetter ? agency < tq : agency > tq;
                }).length === 0 ? (
                  <p className="text-sm text-green-600 font-medium">Your agency meets or exceeds top quartile on all metrics.</p>
                ) : (
                  <ul className="space-y-2">
                    {METRIC_DEFS.filter(m => {
                      const agency = data.agency[m.key];
                      const tq = data.top_quartile[m.key];
                      return m.higherIsBetter ? agency < tq : agency > tq;
                    }).map(m => {
                      const agency = data.agency[m.key];
                      const tq = data.top_quartile[m.key];
                      const diff = pctDiff(agency, tq, m.higherIsBetter);
                      return (
                        <li key={m.key} className="flex items-center gap-3 text-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="font-medium text-gray-800">{m.label}:</span>
                          <span className="text-gray-600">{m.fmt(agency)} → top quartile is {m.fmt(tq)}</span>
                          <span className="text-amber-600 font-medium">{diff.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">AI-Generated Improvement Plan</h3>
                  <button
                    onClick={fetchAiPlan}
                    disabled={aiLoading}
                    className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {aiLoading ? 'Generating…' : aiText ? 'Regenerate' : 'Generate Plan'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Powered by local Ollama (llama3.2). Generates 5 actionable recommendations based on your gaps vs top quartile.</p>

                {aiError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    {aiError} — ensure Ollama is running at localhost:11434.
                  </div>
                )}

                {aiLoading && (
                  <div className="bg-blue-50 border border-blue-100 rounded p-4 text-sm text-blue-600 animate-pulse">
                    Consulting local AI model…
                  </div>
                )}

                {aiText && !aiLoading && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {aiText}
                  </div>
                )}

                {!aiText && !aiLoading && !aiError && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                    Click &ldquo;Generate Plan&rdquo; to get AI-powered recommendations.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
