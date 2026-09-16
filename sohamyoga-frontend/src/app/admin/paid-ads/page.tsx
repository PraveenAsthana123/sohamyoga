'use client';

import React, { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  daily_budget_cents: number;
  total_budget_cents: number;
  bidding_strategy: string;
  geo_targets: unknown;
  platform: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface AdGroup {
  id: string;
  campaign_id: string;
  campaign_name: string;
  name: string;
  status: string;
  default_bid_cents: number;
  created_at: string;
}

interface HealthFinding {
  id: string;
  campaign_id: string;
  finding_key: string;
  severity: string;
  summary: string;
  recommended_action: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface SpyResult {
  id: number;
  platform: string;
  competitor_name: string | null;
  ad_id: string | null;
  ad_type: string | null;
  ad_text: string | null;
  headline: string | null;
  cta: string | null;
  impressions_range: string | null;
  spend_range: string | null;
  fetched_at: string;
}

interface Summary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalDailyBudgetCents: number;
  totalAdGroups: number;
}

interface PaidAdsData {
  campaigns: Campaign[];
  adGroups: AdGroup[];
  healthFindings: HealthFinding[];
  spyResults: SpyResult[];
  summary: Summary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

function statusBadge(status: string): React.ReactElement {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-amber-100 text-amber-800',
    ended: 'bg-gray-100 text-gray-700',
    completed: 'bg-gray-100 text-gray-700',
    draft: 'bg-blue-100 text-blue-800',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function severityBadge(severity: string): React.ReactElement {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-blue-100 text-blue-800',
    info: 'bg-gray-100 text-gray-700',
  };
  const cls = map[severity.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {severity}
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-400 text-sm">{message}</div>
  );
}

// ── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: PaidAdsData }) {
  const { summary, campaigns } = data;

  const byPlatform = campaigns.reduce<Record<string, number>>((acc, c) => {
    const key = c.platform ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Campaigns" value={summary.totalCampaigns} />
        <KpiCard label="Active Campaigns" value={summary.activeCampaigns} />
        <KpiCard label="Total Daily Budget" value={formatCents(summary.totalDailyBudgetCents)} />
        <KpiCard label="Active Ad Groups" value={summary.totalAdGroups} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Campaigns by Platform</h3>
        {Object.keys(byPlatform).length === 0 ? (
          <EmptyState message="No campaigns found." />
        ) : (
          <ul className="space-y-2">
            {Object.entries(byPlatform)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <li key={platform} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 capitalize">{platform.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                    {count}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Tab: Campaigns ────────────────────────────────────────────────────────────

function CampaignsTab({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return <EmptyState message="No campaigns found." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Platform</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Daily Budget</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Start</th>
            <th className="py-2">End</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900 max-w-xs truncate">{c.name}</td>
              <td className="py-2 pr-4 text-gray-600 capitalize">{c.platform?.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4">{statusBadge(c.status)}</td>
              <td className="py-2 pr-4 text-gray-700">{formatCents(c.daily_budget_cents)}</td>
              <td className="py-2 pr-4 text-gray-600 capitalize">{c.campaign_type?.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4 text-gray-600">{formatDate(c.start_date)}</td>
              <td className="py-2 text-gray-600">{formatDate(c.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Ad Groups ────────────────────────────────────────────────────────────

function AdGroupsTab({ adGroups }: { adGroups: AdGroup[] }) {
  if (adGroups.length === 0) return <EmptyState message="No ad groups found." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Campaign</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Default Bid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {adGroups.map((g) => (
            <tr key={g.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900 max-w-xs truncate">{g.name}</td>
              <td className="py-2 pr-4 text-gray-600 max-w-xs truncate">{g.campaign_name ?? '—'}</td>
              <td className="py-2 pr-4">{statusBadge(g.status)}</td>
              <td className="py-2 text-gray-700">{formatCents(g.default_bid_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Health ───────────────────────────────────────────────────────────────

function HealthTab({ healthFindings }: { healthFindings: HealthFinding[] }) {
  if (healthFindings.length === 0) return <EmptyState message="No health findings. All campaigns look healthy!" />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Finding</th>
            <th className="py-2 pr-4">Severity</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Summary</th>
            <th className="py-2">Recommended Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {healthFindings.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900 text-xs">{f.finding_key}</td>
              <td className="py-2 pr-4">{severityBadge(f.severity)}</td>
              <td className="py-2 pr-4">{statusBadge(f.status)}</td>
              <td className="py-2 pr-4 text-gray-600 max-w-xs">{f.summary}</td>
              <td className="py-2 text-gray-600 max-w-xs">{f.recommended_action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Spy ──────────────────────────────────────────────────────────────────

function SpyTab({ spyResults }: { spyResults: SpyResult[] }) {
  if (spyResults.length === 0) return <EmptyState message="No competitor spy data collected yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Platform</th>
            <th className="py-2 pr-4">Competitor</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Headline</th>
            <th className="py-2 pr-4">CTA</th>
            <th className="py-2 pr-4">Impressions</th>
            <th className="py-2">Spend Range</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {spyResults.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-700 capitalize">{s.platform}</td>
              <td className="py-2 pr-4 text-gray-900 font-medium">{s.competitor_name ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-600">{s.ad_type ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-600 max-w-xs truncate">{s.headline ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-600">{s.cta ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-600">{s.impressions_range ?? '—'}</td>
              <td className="py-2 text-gray-600">{s.spend_range ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Campaigns', 'Ad Groups', 'Health', 'Spy'] as const;
type Tab = (typeof TABS)[number];

export default function PaidAdsPage() {
  const [data, setData] = useState<PaidAdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  useEffect(() => {
    fetch('/api/admin/paid-ads')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PaidAdsData>;
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 text-sm">
        Failed to load paid ads data: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paid Ads Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          All platforms — Google, Facebook, Instagram, LinkedIn, TikTok and more
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
              {tab === 'Campaigns' && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {data.campaigns.length}
                </span>
              )}
              {tab === 'Ad Groups' && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {data.adGroups.length}
                </span>
              )}
              {tab === 'Health' && data.healthFindings.length > 0 && (
                <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                  {data.healthFindings.filter((f) => f.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        {activeTab === 'Overview' && <OverviewTab data={data} />}
        {activeTab === 'Campaigns' && <CampaignsTab campaigns={data.campaigns} />}
        {activeTab === 'Ad Groups' && <AdGroupsTab adGroups={data.adGroups} />}
        {activeTab === 'Health' && <HealthTab healthFindings={data.healthFindings} />}
        {activeTab === 'Spy' && <SpyTab spyResults={data.spyResults} />}
      </div>
    </div>
  );
}
