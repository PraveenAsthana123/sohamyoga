'use client';

import { useEffect, useState } from 'react';

interface AnalyticsData {
  totalLeads?: number;
  monthlyLeads?: number;
  totalRevenue?: number;
  activeCampaigns?: number;
  socialReach?: number;
  adSpend?: number;
  [key: string]: unknown;
}

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  change: string;
  positive: boolean;
}

const recentActivity = [
  { time: '2h ago', action: 'New lead captured from Google Ads', type: '🎯' },
  { time: '5h ago', action: 'Facebook campaign "Summer Sale" went live', type: '🚀' },
  { time: '1d ago', action: 'Monthly report for August generated', type: '📋' },
  { time: '2d ago', action: 'Instagram post reached 12,400 people', type: '📱' },
  { time: '3d ago', action: 'Email campaign delivered — 42% open rate', type: '📧' },
];

const upcomingTasks = [
  { due: 'Today', task: 'Campaign review: Q3 Google Ads', icon: '🔍' },
  { due: 'Sep 20', task: 'Monthly performance report', icon: '📊' },
  { due: 'Sep 22', task: 'New content batch approval', icon: '✅' },
  { due: 'Sep 30', task: 'Q3 budget reconciliation', icon: '💰' },
];

const quickActions = [
  { label: 'New Campaign', href: '/talentshill/campaigns', icon: '🚀' },
  { label: 'View Reports', href: '/talentshill/reports', icon: '📋' },
  { label: 'Check Leads', href: '/talentshill/leads', icon: '🎯' },
  { label: 'Social Posts', href: '/talentshill/social', icon: '📱' },
];

function formatNumber(n: number | undefined, prefix = ''): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export default function TalentsHillDashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('Client');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('th_client_email');
      if (stored) {
        setClientName(stored.split('@')[0] ?? 'Client');
      }
    }
    fetch('/api/admin/analytics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: AnalyticsData) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, []);

  const kpiCards: KpiCard[] = [
    {
      label: 'Active Campaigns',
      value: analytics?.activeCampaigns !== undefined ? String(analytics.activeCampaigns) : '—',
      icon: '🚀',
      change: '+2 this month',
      positive: true,
    },
    {
      label: 'Total Leads (Month)',
      value: formatNumber(analytics?.monthlyLeads ?? analytics?.totalLeads),
      icon: '🎯',
      change: '+18% vs last month',
      positive: true,
    },
    {
      label: 'Social Reach',
      value: formatNumber(analytics?.socialReach),
      icon: '📱',
      change: '+5.2K this week',
      positive: true,
    },
    {
      label: 'Ad Spend',
      value: formatNumber(analytics?.adSpend, '$'),
      icon: '💰',
      change: 'Within budget',
      positive: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back,{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 capitalize">
            {clientName}
          </span>{' '}
          👋
        </h1>
        <p className="text-white/50 mt-1 text-sm">
          Here's what's happening with your campaigns today — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ label, value, icon, change, positive }) => (
            <div key={label} className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${positive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {change}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-white/50 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-5 text-center hover:bg-white/15 transition-all group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform inline-block">
                {icon}
              </div>
              <div className="text-white/80 text-sm font-medium">{label}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Activity + Tasks */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map(({ time, action, type }, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/10 last:border-0">
                <span className="text-xl mt-0.5 shrink-0">{type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm leading-snug">{action}</p>
                  <p className="text-white/40 text-xs mt-0.5">{time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Tasks</h2>
          <div className="space-y-3">
            {upcomingTasks.map(({ due, task, icon }, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
                <span className="text-xl shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm">{task}</p>
                </div>
                <span className="text-white/40 text-xs whitespace-nowrap">{due}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-8 text-center">
        <div className="text-4xl mb-3">📈</div>
        <h3 className="text-white font-semibold mb-2">Campaign Performance</h3>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Connect your ad accounts to see live performance data — impressions, clicks, conversions, and ROAS — charted over time.
        </p>
        <a
          href="/talentshill/settings"
          className="inline-block mt-4 bg-blue-500/80 hover:bg-blue-400/90  border border-blue-400/30 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-all"
        >
          Connect Accounts
        </a>
      </div>
    </div>
  );
}
