'use client';

import React, { useEffect, useState } from 'react';

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

interface ContentDraft {
  id: string;
  content_type: string;
  master_text: string;
  status: string;
  default_schedule_at: string | null;
  generated_with_ai: boolean;
  tags: string[];
  created_at: string;
}

interface SocialPost {
  id: string;
  platform: string;
  status: string;
  scheduled_at: string;
  published_at: string | null;
  external_post_url: string | null;
  created_at: string;
}

interface PlatformAnalytic {
  id: string;
  platform: string;
  metric_key: string;
  metric_value: number;
  recorded_at: string;
}

interface SocialCampaign {
  id: string;
  name: string;
  goal: string;
  status: string;
  platforms: string[];
  starts_at: string;
  ends_at: string;
  budget: number | null;
  created_at: string;
}

interface Summary {
  connectedAccounts: number;
  totalDrafts: number;
  totalPosts: number;
  activeCampaigns: number;
}

interface SocialData {
  accounts: SocialAccount[];
  drafts: ContentDraft[];
  posts: SocialPost[];
  analytics: PlatformAnalytic[];
  campaigns: SocialCampaign[];
  summary: Summary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function platformEmoji(platform: string): string {
  const map: Record<string, string> = {
    facebook: '📘',
    instagram: '📸',
    twitter: '🐦',
    linkedin: '💼',
    youtube: '▶️',
    telegram: '✈️',
    tiktok: '🎵',
    discord: '💬',
    mastodon: '🐘',
    bluesky: '🦋',
  };
  return map[platform.toLowerCase()] ?? '📡';
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' });
}

function accountStatusBadge(status: string): React.ReactElement {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    disconnected: 'bg-gray-100 text-gray-600',
    paused: 'bg-amber-100 text-amber-800',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function statusBadge(status: string): React.ReactElement {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    published: 'bg-green-100 text-green-800',
    draft: 'bg-blue-100 text-blue-800',
    queued: 'bg-indigo-100 text-indigo-800',
    scheduled: 'bg-purple-100 text-purple-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
    paused: 'bg-amber-100 text-amber-800',
    completed: 'bg-gray-100 text-gray-600',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
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

// ── Tab: Accounts ─────────────────────────────────────────────────────────────

function AccountsTab({ accounts }: { accounts: SocialAccount[] }) {
  if (accounts.length === 0) return <EmptyState message="No social accounts connected." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Platform</th>
            <th className="py-2 pr-4">Account</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Connected</th>
            <th className="py-2">Last Health Check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4">
                <span className="flex items-center gap-1.5 text-gray-700">
                  <span className="text-base">{platformEmoji(a.platform)}</span>
                  <span className="capitalize">{a.platform}</span>
                </span>
              </td>
              <td className="py-2 pr-4">
                {a.profile_url ? (
                  <a
                    href={a.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    {a.account_name}
                  </a>
                ) : (
                  <span className="font-medium text-gray-900">{a.account_name}</span>
                )}
              </td>
              <td className="py-2 pr-4">{accountStatusBadge(a.status)}</td>
              <td className="py-2 pr-4 text-gray-600">{formatDate(a.connected_at)}</td>
              <td className="py-2 text-gray-600">
                {formatDateTime(a.last_health_check_at)}
                {a.error_message && (
                  <p className="text-red-500 text-xs mt-0.5 truncate max-w-xs">{a.error_message}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Content Queue ────────────────────────────────────────────────────────

function ContentQueueTab({ drafts }: { drafts: ContentDraft[] }) {
  if (drafts.length === 0) return <EmptyState message="No content drafts found." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Content Type</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Preview</th>
            <th className="py-2 pr-4">Scheduled</th>
            <th className="py-2 pr-4">AI</th>
            <th className="py-2">Tags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {drafts.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-700 capitalize">{d.content_type}</td>
              <td className="py-2 pr-4">{statusBadge(d.status)}</td>
              <td className="py-2 pr-4 text-gray-600 max-w-sm truncate">
                {d.master_text ? d.master_text.slice(0, 80) + (d.master_text.length > 80 ? '…' : '') : '—'}
              </td>
              <td className="py-2 pr-4 text-gray-600">{formatDateTime(d.default_schedule_at)}</td>
              <td className="py-2 pr-4 text-center">
                {d.generated_with_ai ? (
                  <span className="text-indigo-500 text-xs font-medium">AI</span>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
              <td className="py-2 text-gray-500 text-xs">
                {d.tags.length > 0 ? d.tags.slice(0, 3).join(', ') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Posts ────────────────────────────────────────────────────────────────

function PostsTab({ posts }: { posts: SocialPost[] }) {
  if (posts.length === 0) return <EmptyState message="No posts published yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Platform</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Scheduled</th>
            <th className="py-2 pr-4">Published</th>
            <th className="py-2">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {posts.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4">
                <span className="flex items-center gap-1.5 text-gray-700">
                  <span className="text-base">{platformEmoji(p.platform)}</span>
                  <span className="capitalize">{p.platform}</span>
                </span>
              </td>
              <td className="py-2 pr-4">{statusBadge(p.status)}</td>
              <td className="py-2 pr-4 text-gray-600">{formatDateTime(p.scheduled_at)}</td>
              <td className="py-2 pr-4 text-gray-600">{formatDateTime(p.published_at)}</td>
              <td className="py-2 text-gray-600">
                {p.external_post_url ? (
                  <a
                    href={p.external_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline text-xs"
                  >
                    View post
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Analytics ────────────────────────────────────────────────────────────

function AnalyticsTab({ analytics }: { analytics: PlatformAnalytic[] }) {
  if (analytics.length === 0) return <EmptyState message="No platform analytics recorded yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Platform</th>
            <th className="py-2 pr-4">Metric</th>
            <th className="py-2 pr-4">Value</th>
            <th className="py-2">Recorded At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {analytics.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4">
                <span className="flex items-center gap-1.5 text-gray-700">
                  <span className="text-base">{platformEmoji(a.platform)}</span>
                  <span className="capitalize">{a.platform}</span>
                </span>
              </td>
              <td className="py-2 pr-4 text-gray-700">{a.metric_key}</td>
              <td className="py-2 pr-4 font-semibold text-gray-900">{Number(a.metric_value).toLocaleString()}</td>
              <td className="py-2 text-gray-600">{formatDateTime(a.recorded_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Campaigns ────────────────────────────────────────────────────────────

function CampaignsTab({ campaigns }: { campaigns: SocialCampaign[] }) {
  if (campaigns.length === 0) return <EmptyState message="No social campaigns found." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Goal</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Platforms</th>
            <th className="py-2 pr-4">Start</th>
            <th className="py-2 pr-4">End</th>
            <th className="py-2">Budget</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900 max-w-xs truncate">{c.name}</td>
              <td className="py-2 pr-4 text-gray-600 capitalize">{c.goal.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4">{statusBadge(c.status)}</td>
              <td className="py-2 pr-4 text-gray-600">
                {c.platforms.map((p) => (
                  <span key={p} className="mr-1" title={p}>{platformEmoji(p)}</span>
                ))}
              </td>
              <td className="py-2 pr-4 text-gray-600">{formatDate(c.starts_at)}</td>
              <td className="py-2 pr-4 text-gray-600">{formatDate(c.ends_at)}</td>
              <td className="py-2 text-gray-700">
                {c.budget != null ? `$${Number(c.budget).toFixed(2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Accounts', 'Content Queue', 'Posts', 'Analytics', 'Campaigns'] as const;
type Tab = (typeof TABS)[number];

export default function SocialMediaManagementPage() {
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Accounts');

  useEffect(() => {
    fetch('/api/admin/social-media-management')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SocialData>;
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
        Failed to load social media data: {error}
      </div>
    );
  }

  const tabCounts: Partial<Record<Tab, number>> = {
    Accounts: data.accounts.length,
    'Content Queue': data.drafts.length,
    Posts: data.posts.length,
    Analytics: data.analytics.length,
    Campaigns: data.campaigns.length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social Media Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connected accounts, content drafts, posts and platform analytics
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Connected Accounts" value={data.summary.connectedAccounts} />
        <KpiCard label="Content Drafts" value={data.summary.totalDrafts} />
        <KpiCard label="Published Posts" value={data.summary.totalPosts} />
        <KpiCard label="Active Campaigns" value={data.summary.activeCampaigns} />
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
              {(tabCounts[tab] ?? 0) > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        {activeTab === 'Accounts' && <AccountsTab accounts={data.accounts} />}
        {activeTab === 'Content Queue' && <ContentQueueTab drafts={data.drafts} />}
        {activeTab === 'Posts' && <PostsTab posts={data.posts} />}
        {activeTab === 'Analytics' && <AnalyticsTab analytics={data.analytics} />}
        {activeTab === 'Campaigns' && <CampaignsTab campaigns={data.campaigns} />}
      </div>
    </div>
  );
}
