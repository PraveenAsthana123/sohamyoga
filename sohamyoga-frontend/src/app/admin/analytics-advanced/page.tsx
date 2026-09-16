'use client';

import { useEffect, useState, useCallback } from 'react';

interface DataPoint { day: string; value: number; }
interface StatSummary { min: number; max: number; mean: number; median: number; std_dev: number; trend_pct: number; }
interface AnalyticsData {
  timeSeries: { orders: DataPoint[]; revenue: DataPoint[]; customers: DataPoint[]; pageviews: DataPoint[] };
  stats: { orders: StatSummary; revenue: StatSummary; customers: StatSummary; pageviews: StatSummary };
}

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type MetricKey = 'orders' | 'revenue' | 'customers' | 'pageviews';
type Tab = 'timeseries' | 'stats' | 'correlation' | 'forecast' | 'tests';

function pearson(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
}

function linReg(points: DataPoint[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  return { slope, intercept };
}

function BarChart({ data, maxH = 120, forecast = false }: { data: DataPoint[]; maxH?: number; forecast?: boolean }) {
  const vals = data.map((d) => d.value);
  const maxVal = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-0.5 overflow-x-auto" style={{ minHeight: maxH + 20 }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / maxVal) * maxH);
        const showLabel = i % 7 === 0;
        return (
          <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ width: 8 }}>
            <div
              title={`${d.day}: ${d.value.toFixed(1)}`}
              className={`w-full rounded-sm transition-all ${forecast ? 'bg-blue-300/30' : 'bg-blue-400/70'}`}
              style={{ height: Math.max(h, 1) }}
            />
            {showLabel && <span className="text-white/30 mt-1" style={{ fontSize: 8, transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>{d.day?.substring(5)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function corrColor(v: number): string {
  if (v > 0.7) return 'bg-blue-700 text-white';
  if (v > 0.3) return 'bg-blue-400/50 text-white';
  if (v < -0.7) return 'bg-red-700 text-white';
  if (v < -0.3) return 'bg-red-400/50 text-white';
  return 'bg-white/10 text-white/70';
}

export default function AnalyticsAdvancedPage() {
  const [tab, setTab] = useState<Tab>('timeseries');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>('orders');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics-advanced');
      const d = await res.json() as AnalyticsData;
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-6 flex items-center justify-center">
        <p className="text-white/60 text-lg">Loading analytics…</p>
      </div>
    );
  }

  const ts = data.timeSeries;
  const currentSeries = ts[metric];

  // Forecast
  const { slope, intercept } = linReg(currentSeries);
  const forecastPoints: DataPoint[] = Array.from({ length: 30 }, (_, i) => {
    const xIdx = currentSeries.length + i;
    const futureDate = new Date(Date.now() + i * 86400000).toISOString().substring(0, 10);
    return { day: futureDate, value: Math.max(0, slope * xIdx + intercept) };
  });

  // Outliers
  const s = data.stats[metric];
  const outliers = currentSeries.filter((p) => p.value > s.mean + 2 * s.std_dev);

  // Day-of-week seasonality for orders
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayTotals: Record<number, number[]> = {};
  ts.orders.forEach((p) => {
    const dow = new Date(p.day).getDay();
    if (!dayTotals[dow]) dayTotals[dow] = [];
    dayTotals[dow].push(p.value);
  });
  const dayAvgs = dayNames.map((name, i) => ({
    name,
    avg: dayTotals[i]?.length ? dayTotals[i].reduce((a, b) => a + b, 0) / dayTotals[i].length : 0,
  }));
  const maxDayAvg = dayAvgs.reduce((best, d) => d.avg > best.avg ? d : best, dayAvgs[0]);
  const minDayAvg = dayAvgs.reduce((best, d) => d.avg < best.avg ? d : best, dayAvgs[0]);

  // Correlation matrix
  const metrics: MetricKey[] = ['orders','revenue','customers','pageviews'];
  const getValues = (m: MetricKey) => ts[m].map((p) => p.value);
  const corrMatrix = metrics.map((a) => metrics.map((b) => {
    const av = getValues(a);
    const bv = getValues(b);
    const minLen = Math.min(av.length, bv.length);
    return pearson(av.slice(-minLen), bv.slice(-minLen));
  }));

  const statLabel = { orders: 'Orders', revenue: 'Revenue ($)', customers: 'New Customers', pageviews: 'Page Views' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-6">
      <h1 className="mb-6 text-3xl font-bold text-white">Advanced Analytics 📊</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['timeseries','stats','correlation','forecast','tests'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'timeseries' ? 'Time Series' : t === 'stats' ? 'Statistical Summary' : t === 'correlation' ? 'Correlation' : t === 'forecast' ? 'Forecasting' : 'Statistical Tests'}
          </button>
        ))}
      </div>

      {tab === 'timeseries' && (
        <div className={glass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-white">Time Series (90 days)</h2>
            <div className="flex gap-2">
              {metrics.map((m) => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`${tabBase} text-xs ${metric === m ? tabActive : tabInactive}`}>{m}</button>
              ))}
            </div>
          </div>
          <p className="text-sm text-white/50 mb-4">{statLabel[metric]}</p>
          {currentSeries.length > 0 ? <BarChart data={currentSeries} /> : <p className="text-white/40">No data available</p>}
        </div>
      )}

      {tab === 'stats' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {metrics.map((m) => {
            const st = data.stats[m];
            const trendUp = st.trend_pct >= 0;
            return (
              <div key={m} className={glass}>
                <h3 className="mb-3 text-lg font-semibold text-white capitalize">{statLabel[m]}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {[['Min', st.min], ['Max', st.max], ['Mean', st.mean.toFixed(2)], ['Median', st.median.toFixed(2)], ['Std Dev', st.std_dev.toFixed(2)]].map(([label, val]) => (
                    <div key={String(label)} className="rounded-lg bg-white/5 p-2">
                      <p className="text-xs text-white/40">{label}</p>
                      <p className="font-semibold text-white">{val}</p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-xs text-white/40">7d Trend</p>
                    <p className={`font-semibold ${trendUp ? 'text-green-300' : 'text-red-300'}`}>
                      {trendUp ? '↑' : '↓'} {Math.abs(st.trend_pct).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'correlation' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Pearson Correlation Matrix</h2>
          <p className="text-sm text-white/50 mb-4">Dark blue = strong positive correlation (1.0), white = no correlation (0.0), dark red = strong negative (-1.0)</p>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {metrics.map((m) => <th key={m} className="p-2 text-white/60 text-xs">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {corrMatrix.map((row, i) => (
                  <tr key={metrics[i]}>
                    <td className="p-2 text-white/60 text-xs pr-3">{metrics[i]}</td>
                    {row.map((v, j) => (
                      <td key={j} className={`p-2 text-center rounded text-xs font-semibold ${corrColor(v)}`} style={{ minWidth: 60 }}>
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'forecast' && (
        <div className={glass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-white">30-Day Forecast</h2>
            <div className="flex gap-2">
              {metrics.map((m) => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`${tabBase} text-xs ${metric === m ? tabActive : tabInactive}`}>{m}</button>
              ))}
            </div>
          </div>
          <p className="text-sm text-white/50 mb-2">Historical (solid) + Forecast (lighter) — {statLabel[metric]}</p>
          <div className="mb-2">
            <BarChart data={currentSeries} />
            <BarChart data={forecastPoints} forecast />
          </div>
          <div className="mt-3 rounded-xl bg-amber-500/20 border border-amber-500/30 p-3 text-sm text-amber-200">
            Linear regression forecast — assumes current trend continues. Slope: {slope.toFixed(3)}/day, Intercept: {intercept.toFixed(2)}
          </div>
        </div>
      )}

      {tab === 'tests' && (
        <div className="space-y-4">
          <div className={glass}>
            <h3 className="mb-3 text-lg font-semibold text-white">Trend Test — {statLabel[metric]}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-2 mb-3">
                {metrics.map((m) => (
                  <button key={m} onClick={() => setMetric(m)}
                    className={`${tabBase} text-xs ${metric === m ? tabActive : tabInactive}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-sm text-white/80 mb-1">Slope: <span className="font-semibold text-white">{slope.toFixed(4)}</span> per day</p>
              <p className="text-sm text-white/70">
                {Math.abs(slope) < 0.01 ? '→ Flat trend — no significant change detected'
                  : slope > 0 ? `↑ Positive trend — ${metric} increasing ~${slope.toFixed(2)} per day`
                  : `↓ Negative trend — ${metric} decreasing ~${Math.abs(slope).toFixed(2)} per day`}
              </p>
            </div>
          </div>

          <div className={glass}>
            <h3 className="mb-3 text-lg font-semibold text-white">Seasonality — Orders by Day of Week</h3>
            <div className="flex items-end gap-2 h-24">
              {dayAvgs.map(({ name, avg }) => {
                const maxA = Math.max(...dayAvgs.map((d) => d.avg), 1);
                const h = Math.round((avg / maxA) * 64);
                return (
                  <div key={name} className="flex flex-col items-center flex-1">
                    <div className="w-full rounded-sm bg-cyan-400/60" style={{ height: Math.max(h, 2) }} title={`${name}: ${avg.toFixed(1)}`} />
                    <span className="text-xs text-white/50 mt-1">{name}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-white/60">
              Highest: <span className="text-white font-semibold">{maxDayAvg?.name}</span> ({maxDayAvg?.avg.toFixed(1)}) ·
              Lowest: <span className="text-white font-semibold">{minDayAvg?.name}</span> ({minDayAvg?.avg.toFixed(1)})
            </p>
          </div>

          <div className={glass}>
            <h3 className="mb-3 text-lg font-semibold text-white">Outliers — {statLabel[metric]}</h3>
            <p className="text-sm text-white/60 mb-3">Values greater than mean + 2×std_dev ({(s.mean + 2 * s.std_dev).toFixed(2)})</p>
            {outliers.length > 0 ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/20 text-white/60">
                  <th className="pb-1 text-left">Date</th>
                  <th className="pb-1 text-left">Value</th>
                  <th className="pb-1 text-left">Z-score</th>
                </tr></thead>
                <tbody>
                  {outliers.map((p) => (
                    <tr key={p.day} className="border-b border-white/10">
                      <td className="py-1 text-white">{p.day}</td>
                      <td className="py-1 text-amber-300 font-semibold">{p.value.toFixed(2)}</td>
                      <td className="py-1 text-white/60">{s.std_dev > 0 ? ((p.value - s.mean) / s.std_dev).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-white/40 text-sm">No outliers detected</p>}
          </div>
        </div>
      )}
    </div>
  );
}
