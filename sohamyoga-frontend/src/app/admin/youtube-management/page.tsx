'use client';

import { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  profile_url: string | null;
  avatar_url: string | null;
  status: string;
  connected_at: string | null;
  last_health_check_at: string | null;
  error_message: string | null;
}

interface VideoItem {
  id: string;
  platform: string;
  content_type: string;
  title: string | null;
  status: string;
  approval_status: string | null;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  plays: number;
  published_at: string | null;
  scheduled_at: string | null;
}

interface ContentDraft {
  id: string;
  content_type: string;
  master_text: string | null;
  status: string;
  default_schedule_at: string | null;
  generated_with_ai: boolean;
  tags: string[] | null;
  created_at: string;
}

interface AnalyticsRow {
  id: string;
  platform: string;
  metric_key: string;
  metric_value: number;
  recorded_at: string;
}

interface Summary {
  accountStatus: string;
  totalVideos: number;
  totalShorts: number;
  totalImpressions: number;
  totalPlays: number;
  totalEngagement: number;
}

interface ApiData {
  account: SocialAccount | null;
  videos: VideoItem[];
  shorts: VideoItem[];
  analytics: AnalyticsRow[];
  drafts: ContentDraft[];
  summary: Summary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ['Channel', 'Videos', 'Shorts', 'Analytics', 'Playlists'] as const;
type Tab = typeof TABS[number];

function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'connected' || s === 'published')
    return 'bg-green-100 text-green-800';
  if (s === 'error' || s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'scheduled') return 'bg-blue-100 text-blue-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function fmt(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function VideoTable({ items, label }: { items: VideoItem[]; label: string }) {
  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState message={`No ${label} found for YouTube.`} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Title', 'Status', 'Impressions', 'Plays', 'Likes', 'Comments', 'Shares', 'Published'].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 max-w-xs truncate text-gray-900">
                {item.title ?? '(no title)'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">{fmtNum(item.impressions)}</td>
              <td className="px-4 py-3 text-gray-700">{fmtNum(item.plays)}</td>
              <td className="px-4 py-3 text-gray-700">{fmtNum(item.likes)}</td>
              <td className="px-4 py-3 text-gray-700">{fmtNum(item.comments)}</td>
              <td className="px-4 py-3 text-gray-700">{fmtNum(item.shares)}</td>
              <td className="px-4 py-3 text-gray-500">{fmt(item.published_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function YoutubeManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Channel');

  useEffect(() => {
    fetch('/api/admin/youtube-management')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiData>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        Error loading YouTube management data: {error ?? 'Unknown error'}
      </div>
    );
  }

  const { account, videos, shorts, analytics, drafts, summary } = data;

  const kpiStatusColor =
    summary.accountStatus === 'active' || summary.accountStatus === 'connected'
      ? 'text-green-600'
      : summary.accountStatus === 'error'
      ? 'text-red-600'
      : 'text-gray-500';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">
          YT
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">YouTube Management</h1>
          <p className="text-sm text-gray-500">Channel, videos, shorts, and analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Channel Status"
          value={summary.accountStatus || 'Disconnected'}
          color={kpiStatusColor}
        />
        <KpiCard label="Videos" value={fmtNum(summary.totalVideos)} color="text-gray-900" />
        <KpiCard label="Shorts" value={fmtNum(summary.totalShorts)} color="text-gray-900" />
        <KpiCard
          label="Impressions"
          value={fmtNum(summary.totalImpressions)}
          color="text-red-700"
        />
        <KpiCard label="Total Plays" value={fmtNum(summary.totalPlays)} color="text-orange-600" />
        <KpiCard
          label="Engagement"
          value={fmtNum(summary.totalEngagement)}
          color="text-purple-700"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'Videos' && videos.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {videos.length}
                </span>
              )}
              {tab === 'Shorts' && shorts.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {shorts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Channel */}
        {activeTab === 'Channel' && (
          <div className="p-6">
            {!account ? (
              <EmptyState message="No YouTube channel connected. Connect your YouTube channel to start managing content." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {account.avatar_url ? (
                    <img
                      src={account.avatar_url}
                      alt={account.account_name}
                      className="w-16 h-16 rounded-full border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl font-bold">
                      YT
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{account.account_name}</h2>
                    {account.profile_url && (
                      <a
                        href={account.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-red-600 hover:underline"
                      >
                        {account.profile_url}
                      </a>
                    )}
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                        account.status
                      )}`}
                    >
                      {account.status}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dt className="text-xs font-medium text-gray-500 uppercase">Connected At</dt>
                    <dd className="mt-1 text-sm text-gray-900">{fmt(account.connected_at)}</dd>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dt className="text-xs font-medium text-gray-500 uppercase">Last Health Check</dt>
                    <dd className="mt-1 text-sm text-gray-900">{fmt(account.last_health_check_at)}</dd>
                  </div>
                  {account.error_message && (
                    <div className="bg-red-50 rounded-lg p-4 sm:col-span-2">
                      <dt className="text-xs font-medium text-red-600 uppercase">Error</dt>
                      <dd className="mt-1 text-sm text-red-800">{account.error_message}</dd>
                    </div>
                  )}
                </dl>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: 'Videos', value: summary.totalVideos },
                    { label: 'Shorts', value: summary.totalShorts },
                    { label: 'Total Plays', value: summary.totalPlays },
                    { label: 'Drafts', value: drafts.length },
                  ].map((s) => (
                    <div key={s.label} className="text-center bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-900">{fmtNum(s.value)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Videos */}
        {activeTab === 'Videos' && <VideoTable items={videos} label="videos" />}

        {/* Shorts */}
        {activeTab === 'Shorts' && <VideoTable items={shorts} label="shorts" />}

        {/* Analytics */}
        {activeTab === 'Analytics' && (
          <div className="overflow-x-auto">
            {analytics.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No analytics data found for YouTube. Metrics will appear here once the channel is synced." />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Metric', 'Value', 'Recorded At'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{row.metric_key}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtNum(row.metric_value)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(row.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Playlists */}
        {activeTab === 'Playlists' && (
          <div className="p-6">
            <div className="text-center py-12 text-gray-400">
              <p className="text-5xl mb-4">🎵</p>
              <p className="text-base font-medium text-gray-500">Playlist sync not yet configured</p>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                YouTube playlist synchronisation requires the YouTube Data API v3 integration with
                playlist read scope. Once connected, playlists and their video lists will appear
                here.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                <span>Required scope:</span>
                <code className="bg-white border border-gray-200 rounded px-2 py-0.5 text-xs">
                  youtube.readonly
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
