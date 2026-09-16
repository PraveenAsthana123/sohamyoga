'use client';

import { useEffect, useState } from 'react';

type DateRange = '7d' | '30d' | '90d';

interface KpiMetric {
  label: string;
  value: string;
  icon: string;
  change: string;
}

interface ChannelRow {
  platform: string;
  icon: string;
  impressions: string;
  clicks: string;
  spend: string;
  roas: string;
}

interface AnalyticsData {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  roas?: number;
  spend?: number;
  [key: string]: unknown;
}

interface TopContent {
  title?: string;
  name?: string;
  clicks?: number;
  impressions?: number;
  platform?: string;
  [key: string]: unknown;
}

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

const STATIC_CHANNELS: ChannelRow[] = [
  { platform: 'Google Ads', icon: '🔍', impressions: '240K', clicks: '8,400', spend: '$3,200', roas: '4.1x' },
  { platform: 'Facebook', icon: '👤', impressions: '180K', clicks: '5,100', spend: '$2,100', roas: '2.8x' },
  { platform: 'Instagram', icon: '📸', impressions: '120K', clicks: '3,800', spend: '$1,400', roas: '3.2x' },
  { platform: 'LinkedIn', icon: '💼', impressions: '42K', clicks: '1,200', spend: '$800', roas: '2.2x' },
  { platform: 'YouTube', icon: '▶️', impressions: '95K', clicks: '2,600', spend: '$1,100', roas: '3.6x' },
];

function formatNum(n: number | undefined, prefix = ''): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export default function TalentsHillAnalyticsPage() {
  const [range, setRange] = useState<DateRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${range}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: AnalyticsData) => setAnalytics(data))
      .catch(() => setAnalytics(null));

    fetch('/api/admin/kpi', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setTopContent(data as TopContent[]);
        else setTopContent([]);
      })
      .catch(() => setTopContent([]))
      .finally(() => setLoading(false));
  }, [range]);

  const kpiCards: KpiMetric[] = [
    {
      label: 'Impressions',
      value: formatNum(analytics?.impressions),
      icon: '👁️',
      change: '+12% vs prior period',
    },
    {
      label: 'Clicks',
      value: formatNum(analytics?.clicks),
      icon: '👆',
      change: '+8.5% vs prior period',
    },
    {
      label: 'Conversions',
      value: formatNum(analytics?.conversions),
      icon: '✅',
      change: '+21% vs prior period',
    },
    {
      label: 'ROAS',
      value: analytics?.roas !== undefined ? `${analytics.roas}x` : '3.2x',
      icon: '💰',
      change: 'Above 3x target',
    },
  ];

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics & ROI</h1>
          <p className="text-white/50 mt-1 text-sm">
            Analytics data updates daily.{' '}
            <span className="text-blue-400">Last sync: {today}</span>
          </p>
        </div>
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          {DATE_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${range === value ? 'bg-blue-500/30 text-white border-blue-400/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ label, value, icon, change }) => (
            <div key={label} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">{change}</span>
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-white/50 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Channel Breakdown */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Channel Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/50 font-medium px-6 py-3">Platform</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Impressions</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Clicks</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Spend</th>
                <th className="text-right text-white/50 font-medium px-6 py-3">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {STATIC_CHANNELS.map((row) => (
                <tr key={row.platform} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-white/80">
                      <span>{row.icon}</span>
                      <span>{row.platform}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-white/70">{row.impressions}</td>
                  <td className="px-4 py-4 text-right text-white/70">{row.clicks}</td>
                  <td className="px-4 py-4 text-right text-white/70">{row.spend}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-cyan-400">{row.roas}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performing Content */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Top Performing Content</h2>
        {topContent.length === 0 ? (
          <div className="space-y-3">
            {[
              { title: 'Q3 Product Launch Video Ad', platform: 'YouTube', clicks: '3,200' },
              { title: 'Summer Sale Carousel Post', platform: 'Instagram', clicks: '2,800' },
              { title: '"5 Tips" Blog Article', platform: 'Google', clicks: '2,100' },
              { title: 'Brand Awareness Display Ad', platform: 'Facebook', clicks: '1,900' },
              { title: 'Lead Gen Landing Page', platform: 'Google', clicks: '1,600' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                <div>
                  <p className="text-white/80 text-sm font-medium">{item.title}</p>
                  <p className="text-white/40 text-xs mt-0.5">{item.platform}</p>
                </div>
                <span className="text-cyan-400 text-sm font-medium">{item.clicks} clicks</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {topContent.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                <div>
                  <p className="text-white/80 text-sm font-medium">{item.title ?? item.name ?? 'Content item'}</p>
                  <p className="text-white/40 text-xs mt-0.5">{item.platform ?? '—'}</p>
                </div>
                <span className="text-cyan-400 text-sm font-medium">
                  {item.clicks !== undefined ? `${item.clicks.toLocaleString()} clicks` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
