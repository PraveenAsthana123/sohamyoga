'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueChannel {
  channel: string;
  revenue: number;
  pct: number;
}

interface RevenueProduct {
  product: string;
  revenue: string;
  units: string;
}

interface TopCustomer {
  email: string;
  total_spend: string;
  order_count: string;
  last_order_date: string;
}

interface CohortRevenue {
  month: string;
  revenue: string;
  customer_count: string;
}

interface ApiData {
  mrr: { current: number; prev_month: number; growth_pct: number };
  arr: { current: number };
  ltv: { avg_customer_ltv: number };
  cac: { estimated: number };
  payback_period_months: number;
  churn_rate: number;
  revenue_by_channel: RevenueChannel[];
  revenue_by_product: RevenueProduct[];
  top_customers: TopCustomer[];
  cohort_revenue: CohortRevenue[];
  forecast_next_30d: number;
  forecast_optimistic: number;
  forecast_conservative: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(val: number | string | null | undefined, compact = false) {
  const n = Number(val ?? 0);
  if (isNaN(n)) return '$0';
  if (compact && n >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number | string | null | undefined) {
  const n = Number(val ?? 0);
  return isNaN(n) ? '0%' : `${n.toFixed(1)}%`;
}

function trendArrow(current: number, prev: number) {
  if (current > prev) return { arrow: '↑', color: 'text-green-400' };
  if (current < prev) return { arrow: '↓', color: 'text-red-400' };
  return { arrow: '→', color: 'text-yellow-400' };
}

function maskEmail(email: string) {
  if (!email) return '***';
  const at = email.indexOf('@');
  if (at < 3) return `${email.slice(0, 1)}***${email.slice(at)}`;
  return `${email.slice(0, 3)}***${email.slice(at)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Revenue Overview Tab ─────────────────────────────────────────────────────

function RevenueOverview({ data }: { data: ApiData }) {
  const mrrTrend = trendArrow(data.mrr.current, data.mrr.prev_month);

  const kpis = [
    {
      label: 'MRR',
      value: fmtMoney(data.mrr.current),
      prev: fmtMoney(data.mrr.prev_month),
      badge: `${data.mrr.growth_pct >= 0 ? '+' : ''}${data.mrr.growth_pct.toFixed(1)}% MoM`,
      badgeColor: data.mrr.growth_pct >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300',
      trend: mrrTrend,
      icon: '💰',
    },
    {
      label: 'ARR',
      value: fmtMoney(data.arr.current, true),
      prev: 'MRR × 12',
      badge: null,
      badgeColor: '',
      trend: mrrTrend,
      icon: '📅',
    },
    {
      label: 'Avg LTV',
      value: fmtMoney(data.ltv.avg_customer_ltv),
      prev: 'per customer',
      badge: null,
      badgeColor: '',
      trend: { arrow: '↑', color: 'text-green-400' },
      icon: '📈',
    },
    {
      label: 'CAC',
      value: fmtMoney(data.cac.estimated),
      prev: 'ad spend / new customers',
      badge: null,
      badgeColor: '',
      trend: { arrow: '→', color: 'text-yellow-400' },
      icon: '📉',
    },
    {
      label: 'Payback Period',
      value: `${data.payback_period_months.toFixed(1)} mo`,
      prev: 'CAC / MRR per customer',
      badge: data.payback_period_months <= 12 ? 'Healthy' : 'Review needed',
      badgeColor: data.payback_period_months <= 12 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300',
      trend: { arrow: data.payback_period_months <= 12 ? '↓' : '↑', color: data.payback_period_months <= 12 ? 'text-green-400' : 'text-red-400' },
      icon: '⏱️',
    },
    {
      label: 'Churn Rate',
      value: fmtPct(data.churn_rate),
      prev: 'inactive 90d / total',
      badge: data.churn_rate <= 5 ? 'Low' : data.churn_rate <= 15 ? 'Moderate' : 'High',
      badgeColor: data.churn_rate <= 5 ? 'bg-green-500/20 text-green-300' : data.churn_rate <= 15 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300',
      trend: { arrow: data.churn_rate <= 5 ? '↓' : '↑', color: data.churn_rate <= 5 ? 'text-green-400' : 'text-red-400' },
      icon: '🔻',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {kpis.map(k => (
        <GlassCard key={k.label}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">{k.icon}</span>
            <span className={`text-lg font-bold ${k.trend.color}`}>{k.trend.arrow}</span>
          </div>
          <p className="text-white/50 text-xs uppercase tracking-wide">{k.label}</p>
          <p className="text-white text-2xl font-bold mt-1">{k.value}</p>
          <p className="text-white/40 text-xs mt-1">{k.prev}</p>
          {k.badge && (
            <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${k.badgeColor}`}>
              {k.badge}
            </span>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Revenue Breakdown Tab ────────────────────────────────────────────────────

function RevenueBreakdown({ channels, products }: {
  channels: RevenueChannel[];
  products: RevenueProduct[];
}) {
  const maxChannelRevenue = Math.max(...channels.map(c => c.revenue), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">By Channel</h3>
        <div className="space-y-4">
          {channels.map(c => (
            <div key={c.channel}>
              <div className="flex justify-between text-sm text-white/70 mb-1">
                <span className="capitalize">{c.channel}</span>
                <span className="font-mono">{fmtMoney(c.revenue)} · {c.pct}%</span>
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500/60 transition-all"
                  style={{ width: `${(c.revenue / maxChannelRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {channels.length === 0 && <p className="text-white/40 text-sm">No channel data.</p>}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-semibold mb-4">By Product</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2">Product</th>
                <th className="text-right py-2">Revenue</th>
                <th className="text-right py-2">Units</th>
                <th className="text-right py-2">Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const avgPrice = Number(p.units) > 0 ? Number(p.revenue) / Number(p.units) : 0;
                return (
                  <tr key={p.product} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-white">{p.product}</td>
                    <td className="py-2 text-right text-green-300 font-mono">{fmtMoney(p.revenue)}</td>
                    <td className="py-2 text-right text-white/60">{Number(p.units).toLocaleString()}</td>
                    <td className="py-2 text-right text-white/50">{fmtMoney(avgPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.length === 0 && <p className="text-white/40 text-sm py-4">No product data.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Top Customers Tab ────────────────────────────────────────────────────────

function TopCustomers({ customers }: { customers: TopCustomer[] }) {
  if (customers.length === 0) {
    return <p className="text-white/40 text-center py-12">No customer data.</p>;
  }

  const topThreshold = customers.length > 0
    ? Number(customers[Math.floor(customers.length * 0.2)]?.total_spend ?? 0)
    : 0;

  return (
    <GlassCard>
      <h3 className="text-white font-semibold mb-4">Top Customers by Spend</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs border-b border-white/10">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Email</th>
              <th className="text-right py-2 px-3">Total Spend</th>
              <th className="text-right py-2 px-3">Orders</th>
              <th className="text-right py-2 px-3">Avg Order</th>
              <th className="text-left py-2 px-3">Last Order</th>
              <th className="text-left py-2 px-3">Tier</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const avgOrder = Number(c.order_count) > 0 ? Number(c.total_spend) / Number(c.order_count) : 0;
              const isHighValue = Number(c.total_spend) >= topThreshold;
              return (
                <tr key={c.email} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-white/40">{i + 1}</td>
                  <td className="py-2 px-3 text-white font-mono text-xs">{maskEmail(c.email)}</td>
                  <td className="py-2 px-3 text-right text-green-300 font-mono font-bold">{fmtMoney(c.total_spend)}</td>
                  <td className="py-2 px-3 text-right text-white/60">{c.order_count}</td>
                  <td className="py-2 px-3 text-right text-white/50">{fmtMoney(avgOrder)}</td>
                  <td className="py-2 px-3 text-white/40 text-xs">
                    {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 px-3">
                    {isHighValue && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300">
                        High Value
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Cohort Revenue Tab ───────────────────────────────────────────────────────

function CohortRevenue({ cohorts }: { cohorts: CohortRevenue[] }) {
  if (cohorts.length === 0) {
    return <p className="text-white/40 text-center py-12">No cohort data available yet.</p>;
  }

  const maxRevenue = Math.max(...cohorts.map(c => Number(c.revenue)), 1);

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">6-Month Revenue Cohorts</h3>
        <p className="text-white/40 text-xs mb-4">Revenue and customer count by month of activity</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Revenue</th>
                <th className="text-right py-2 px-3">Customers</th>
                <th className="text-right py-2 px-3">Avg/Customer</th>
                <th className="py-2 px-3 text-left">Relative</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const revPct = (Number(c.revenue) / maxRevenue) * 100;
                const avgPerCustomer = Number(c.customer_count) > 0
                  ? Number(c.revenue) / Number(c.customer_count) : 0;
                const intensity = Math.floor((revPct / 100) * 5);
                const intensityBg = ['bg-indigo-900/20', 'bg-indigo-800/30', 'bg-indigo-700/40', 'bg-indigo-600/50', 'bg-indigo-500/60'][intensity] ?? 'bg-indigo-900/20';

                return (
                  <tr key={c.month} className={`border-b border-white/5 ${intensityBg}`}>
                    <td className="py-3 px-3 text-white font-mono">{c.month}</td>
                    <td className="py-3 px-3 text-right text-green-300 font-mono font-bold">{fmtMoney(c.revenue)}</td>
                    <td className="py-3 px-3 text-right text-white/70">{Number(c.customer_count).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-white/50">{fmtMoney(avgPerCustomer)}</td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden w-24">
                        <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${revPct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Forecast Tab ─────────────────────────────────────────────────────────────

function Forecast({ data }: { data: ApiData }) {
  const scenarios = [
    {
      label: 'Conservative',
      value: data.forecast_conservative,
      icon: '📉',
      color: 'border-red-400/40 bg-red-500/10',
      textColor: 'text-red-300',
      desc: '−20% from base case',
    },
    {
      label: 'Base Case',
      value: data.forecast_next_30d,
      icon: '📊',
      color: 'border-blue-400/40 bg-blue-500/10',
      textColor: 'text-blue-200',
      desc: 'Linear trend from last 90d',
    },
    {
      label: 'Optimistic',
      value: data.forecast_optimistic,
      icon: '📈',
      color: 'border-green-400/40 bg-green-500/20 shadow-green-500/20',
      textColor: 'text-green-300',
      desc: '+20% from base case',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map(s => (
          <div key={s.label} className={` border rounded-2xl p-6 shadow-xl ${s.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <h3 className="text-white font-semibold">{s.label}</h3>
            </div>
            <p className={`text-3xl font-bold ${s.textColor}`}>{fmtMoney(s.value, true)}</p>
            <p className="text-white/40 text-xs mt-2">Next 30 days</p>
            <p className="text-white/30 text-xs mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Forecast Visualization</h3>
        <p className="text-white/40 text-xs mb-6">Projected revenue range for the next 30 days based on trailing 90-day trend</p>
        <div className="space-y-4">
          {scenarios.map((s, i) => {
            const maxVal = data.forecast_optimistic;
            const pct = maxVal > 0 ? (s.value / maxVal) * 100 : 0;
            const colors = ['bg-red-400/60', 'bg-blue-400/60', 'bg-green-400/60'];
            return (
              <div key={s.label}>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>{s.label}</span>
                  <span className="font-mono">{fmtMoney(s.value)}</span>
                </div>
                <div className="h-6 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors[i]} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs">Current MRR</p>
            <p className="text-white font-bold text-lg mt-1">{fmtMoney(data.mrr.current)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs">MoM Growth</p>
            <p className={`font-bold text-lg mt-1 ${data.mrr.growth_pct >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {data.mrr.growth_pct >= 0 ? '+' : ''}{data.mrr.growth_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['Revenue Overview', 'Revenue Breakdown', 'Top Customers', 'Cohort Revenue', 'Forecast'] as const;
type Tab = typeof TABS[number];

export default function RevenueIntelligencePage() {
  const [tab, setTab] = useState<Tab>('Revenue Overview');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/revenue-intelligence');
      if (res.ok) setData(await res.json());
      else setError('Failed to load revenue data.');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Revenue Intelligence 💹</h1>
            <p className="text-white/50 text-sm mt-1">MRR · ARR · LTV · CAC · Cohorts · Forecast</p>
          </div>
          {data && (
            <div className="flex gap-3">
              <div className="bg-slate-800/70 border border-white/20 rounded-xl px-4 py-2">
                <p className="text-white/50 text-xs">MRR</p>
                <p className="text-white font-bold text-lg">{fmtMoney(data.mrr.current)}</p>
              </div>
              <div className="bg-slate-800/70 border border-white/20 rounded-xl px-4 py-2">
                <p className="text-white/50 text-xs">ARR</p>
                <p className="text-white font-bold text-lg">{fmtMoney(data.arr.current, true)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <TabButton key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-white/40 py-12 text-center">Loading revenue data…</div>
        ) : error ? (
          <div className="text-red-400 py-12 text-center">{error}</div>
        ) : data ? (
          <>
            {tab === 'Revenue Overview' && <RevenueOverview data={data} />}
            {tab === 'Revenue Breakdown' && (
              <RevenueBreakdown channels={data.revenue_by_channel} products={data.revenue_by_product} />
            )}
            {tab === 'Top Customers' && <TopCustomers customers={data.top_customers} />}
            {tab === 'Cohort Revenue' && <CohortRevenue cohorts={data.cohort_revenue} />}
            {tab === 'Forecast' && <Forecast data={data} />}
          </>
        ) : null}
      </div>
    </div>
  );
}
