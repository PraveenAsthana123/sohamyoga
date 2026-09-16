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

interface ContentItem {
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
  updated_at: string;
}

interface AnalyticsRow {
  id: string;
  platform: string;
  metric_key: string;
  metric_value: number;
  recorded_at: string;
}

interface BroadcastRow {
  id: string;
  platform: string;
  content: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  scheduled_at: string | null;
  content_type: string | null;
}

interface Summary {
  accountStatus: string;
  totalContentItems: number;
  totalImpressions: number;
  totalEngagement: number;
}

interface ApiData {
  account: SocialAccount | null;
  contentItems: ContentItem[];
  drafts: ContentDraft[];
  analytics: AnalyticsRow[];
  broadcasts: BroadcastRow[];
  summary: Summary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Messages', 'Broadcasts', 'Analytics', 'Bot Config'] as const;
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

// ── KPI Card ─────────────────────────────────────────────────────────────────

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

// ── Bot Config Section ────────────────────────────────────────────────────────

function BotConfigSection({ account }: { account: SocialAccount | null }) {
  const webhookBase =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const webhookUrl = `${webhookBase}/api/webhooks/telegram`;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-1">Telegram Bot Setup</h3>
        <p className="text-sm text-blue-700">
          Follow these steps to connect your Telegram bot and enable automated posting.
        </p>
      </div>

      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            1
          </span>
          <div>
            <p className="font-medium text-gray-900">Create a bot with @BotFather</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Open Telegram and message <code className="bg-gray-100 px-1 rounded">@BotFather</code>.
              Run <code className="bg-gray-100 px-1 rounded">/newbot</code>, follow the prompts, and
              copy the API token.
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            2
          </span>
          <div>
            <p className="font-medium text-gray-900">Set the webhook URL</p>
            <p className="text-sm text-gray-500 mt-0.5 mb-2">
              Register this app&apos;s webhook with Telegram (replace{' '}
              <code className="bg-gray-100 px-1 rounded">YOUR_BOT_TOKEN</code> with your token):
            </p>
            <div className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-x-auto">
              {`curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=${webhookUrl}"`}
            </div>
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            3
          </span>
          <div>
            <p className="font-medium text-gray-900">Save your token in environment config</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Add <code className="bg-gray-100 px-1 rounded">TELEGRAM_BOT_TOKEN=your_token</code> to
              your <code className="bg-gray-100 px-1 rounded">.env.local</code> and redeploy.
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            4
          </span>
          <div>
            <p className="font-medium text-gray-900">Connect via Social Accounts</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Navigate to <strong>Admin → Social → Accounts</strong> and add your Telegram channel or
              group chat ID to complete the connection.
            </p>
          </div>
        </li>
      </ol>

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Current Connection Status</p>
        {account ? (
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(account.status)}`}
            >
              {account.status}
            </span>
            <span className="text-sm text-gray-700">{account.account_name}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No Telegram account connected.</p>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TelegramManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  useEffect(() => {
    fetch('/api/admin/telegram-management')
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        Error loading Telegram management data: {error ?? 'Unknown error'}
      </div>
    );
  }

  const { account, contentItems, drafts, analytics, broadcasts, summary } = data;

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
        <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
          Tg
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telegram Management</h1>
          <p className="text-sm text-gray-500">Channel/bot status, messages, broadcasts, and analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Channel Status"
          value={summary.accountStatus || 'Disconnected'}
          color={kpiStatusColor}
        />
        <KpiCard
          label="Total Messages"
          value={fmtNum(summary.totalContentItems)}
          color="text-gray-900"
        />
        <KpiCard
          label="Impressions"
          value={fmtNum(summary.totalImpressions)}
          color="text-sky-700"
        />
        <KpiCard
          label="Engagement"
          value={fmtNum(summary.totalEngagement)}
          color="text-indigo-700"
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
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="p-6">
            {!account ? (
              <EmptyState message="No Telegram channel or bot connected. See Bot Config tab for setup instructions." />
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
                    <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-2xl font-bold">
                      Tg
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{account.account_name}</h2>
                    {account.profile_url && (
                      <a
                        href={account.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-sky-600 hover:underline"
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
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {activeTab === 'Messages' && (
          <div className="overflow-x-auto">
            {contentItems.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No messages found for Telegram." />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Title', 'Type', 'Status', 'Impressions', 'Clicks', 'Likes', 'Published'].map(
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
                  {contentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">
                        {item.title ?? '(no title)'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{item.content_type}</td>
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
                      <td className="px-4 py-3 text-gray-700">{fmtNum(item.clicks)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtNum(item.likes)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(item.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Broadcasts */}
        {activeTab === 'Broadcasts' && (
          <div className="overflow-x-auto">
            {broadcasts.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No broadcast messages queued for Telegram. Use the manual queue or social campaign to schedule broadcasts." />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Content Preview', 'Type', 'Status', 'Scheduled At', 'Created'].map((h) => (
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
                  {broadcasts.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">
                        {row.content ?? '(no content)'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {row.content_type ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmt(row.scheduled_at)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Analytics */}
        {activeTab === 'Analytics' && (
          <div className="overflow-x-auto">
            {analytics.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No analytics data found for Telegram." />
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

        {/* Bot Config */}
        {activeTab === 'Bot Config' && <BotConfigSection account={account} />}
      </div>

      {/* Drafts summary if any */}
      {drafts.length > 0 && activeTab === 'Overview' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Drafts ({drafts.length})
          </h3>
          <div className="space-y-2">
            {drafts.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-gray-700 max-w-sm">{d.master_text ?? '(empty)'}</span>
                <span
                  className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusBadge(
                    d.status
                  )}`}
                >
                  {d.status}
                </span>
              </div>
            ))}
            {drafts.length > 5 && (
              <p className="text-xs text-gray-400">+{drafts.length - 5} more drafts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
