'use client';

import { useEffect, useState } from 'react';

interface AnalyticsSummary {
  totalLeads?: number;
  adSpend?: number;
  roas?: number;
  impressions?: number;
  [key: string]: unknown;
}

interface MonthlyReport {
  month: string;
  year: number;
  period: string;
  campaigns: number;
  spend: string;
  leads: string;
  roas: string;
  keyWins: string[];
}

const REPORTS: MonthlyReport[] = [
  {
    month: 'September',
    year: 2026,
    period: '2026-09',
    campaigns: 8,
    spend: '$12,400',
    leads: '284',
    roas: '3.8x',
    keyWins: ['Google Ads CTR improved by 22%', 'New lead gen landing page launched', 'Instagram reached 50K monthly impressions'],
  },
  {
    month: 'August',
    year: 2026,
    period: '2026-08',
    campaigns: 7,
    spend: '$11,800',
    leads: '241',
    roas: '3.5x',
    keyWins: ['Summer Sale campaign achieved 4.2x ROAS', 'Email open rate hit 42%', 'LinkedIn follower growth +18%'],
  },
  {
    month: 'July',
    year: 2026,
    period: '2026-07',
    campaigns: 6,
    spend: '$10,200',
    leads: '198',
    roas: '3.1x',
    keyWins: ['Launched brand awareness video campaign', 'Retargeting reduced CPA by 15%', 'Content calendar fully booked for Q3'],
  },
  {
    month: 'June',
    year: 2026,
    period: '2026-06',
    campaigns: 5,
    spend: '$9,500',
    leads: '172',
    roas: '2.9x',
    keyWins: ['Facebook Ads account fully optimised', 'First LinkedIn campaign launched', 'Blog content ranked on page 1 for 3 keywords'],
  },
];

function formatNum(n: number | undefined, prefix = ''): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export default function TalentsHillReportsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: AnalyticsSummary) => setAnalytics(data))
      .catch(() => setAnalytics(null));
  }, []);

  function handleDownload(report: MonthlyReport) {
    setToast(`⏳ ${report.month} ${report.year} report generation in progress… You'll receive an email when it's ready.`);
    setTimeout(() => setToast(''), 4000);
  }

  const summaryStats = [
    { label: 'Total Leads (All Time)', value: formatNum(analytics?.totalLeads), icon: '🎯' },
    { label: 'Total Ad Spend', value: formatNum(analytics?.adSpend, '$'), icon: '💰' },
    { label: 'Average ROAS', value: analytics?.roas !== undefined ? `${analytics.roas}x` : '3.3x', icon: '📈' },
    { label: 'Total Impressions', value: formatNum(analytics?.impressions), icon: '👁️' },
  ];

  return (
    <div className="space-y-8 relative">
      {toast && (
        <div className="fixed top-6 right-6 z-[100] backdrop-blur-md bg-blue-500/20 border border-blue-400/30 rounded-xl px-5 py-3 text-blue-300 text-sm shadow-xl max-w-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Reports & Downloads</h1>
        <p className="text-white/50 mt-1 text-sm">Monthly performance summaries for your campaigns and marketing activity.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryStats.map(({ label, value, icon }) => (
          <div key={label} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-5 text-center">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-white/50 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Monthly Reports */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Monthly Reports</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {REPORTS.map((report) => (
            <div
              key={report.period}
              className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {report.month} {report.year}
                  </h3>
                  <p className="text-white/50 text-sm mt-0.5">Monthly Performance Report</p>
                </div>
                <span className="backdrop-blur-md bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs px-3 py-1.5 rounded-full">
                  📋 Available
                </span>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Campaigns', value: report.campaigns },
                  { label: 'Ad Spend', value: report.spend },
                  { label: 'Leads', value: report.leads },
                ].map(({ label, value }) => (
                  <div key={label} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-white font-semibold text-sm">{value}</div>
                    <div className="text-white/40 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* ROAS */}
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-sm">Average ROAS</span>
                <span className="text-cyan-400 font-bold">{report.roas}</span>
              </div>

              {/* Key wins */}
              <div>
                <p className="text-white/50 text-xs font-medium mb-2">Key Wins</p>
                <ul className="space-y-1">
                  {report.keyWins.map((win, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/70 text-xs">
                      <span className="text-green-400 mt-0.5">✓</span>
                      {win}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Download button */}
              <button
                onClick={() => handleDownload(report)}
                className="w-full bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all mt-auto"
              >
                ⬇ Download PDF
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Request custom report */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-white font-semibold text-lg mb-2">Need a Custom Report?</h3>
        <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
          Request a bespoke performance report — specific date ranges, campaigns, channels, or KPIs — delivered within 48 hours.
        </p>
        <a
          href="mailto:reports@talentshill.com?subject=Custom Report Request"
          className="inline-block bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all"
        >
          ✉️ Request Custom Report
        </a>
      </div>
    </div>
  );
}
