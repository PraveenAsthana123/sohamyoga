'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformSummary {
  platform: string;
  health_status: string;
  latency_ms: number | null;
  checked_at: string | null;
  error_count_24h: number;
  retry_pending: number;
  last_event_at: string | null;
  rate_limit_pct_used: number | null;
  rate_limit_remaining: number | null;
  rate_limit_total: number | null;
}

interface HealthRow {
  id: number;
  platform: string;
  checked_at: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  http_status: number | null;
  api_endpoint_checked: string | null;
}

interface ApiLogRow {
  id: number;
  platform: string;
  endpoint: string;
  http_method: string | null;
  request_headers: Record<string, string>;
  request_body: string | null;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, string>;
  duration_ms: number | null;
  is_error: boolean;
  error_type: string | null;
  triggered_by: string | null;
  content_item_id: number | null;
  created_at: string;
}

interface RateLimitGroup {
  endpoint_group: string | null;
  limit_total: number | null;
  limit_remaining: number | null;
  limit_reset_at: string | null;
  pct_used: number | null;
  snapshot_at: string;
}

interface RateLimitPlatform {
  platform: string;
  groups: RateLimitGroup[];
}

interface WebhookRow {
  id: number;
  platform: string;
  event_type: string | null;
  event_id: string | null;
  payload: Record<string, unknown>;
  signature_valid: boolean | null;
  processed: boolean;
  processing_error: string | null;
  received_at: string;
  processed_at: string | null;
}

interface RetryRow {
  id: number;
  platform: string;
  operation_type: string | null;
  payload: Record<string, unknown>;
  original_error: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  status: string;
  last_error: string | null;
  content_item_id: number | null;
  created_at: string;
  updated_at: string;
}

interface DebugResult {
  platform: string;
  env_check: { vars: { name: string; set: boolean }[]; all_set: boolean };
  connectivity: { reachable: boolean; latency_ms: number | null; http_status: number | null; endpoint: string | null };
  last_log: Record<string, unknown> | null;
  rate_limit: Record<string, unknown> | null;
  health_status: Record<string, unknown> | null;
  recommendations: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: string) {
  const map: Record<string, string> = {
    healthy: '🟢',
    degraded: '🟡',
    down: '🔴',
    unknown: '⚪',
  };
  return map[status] ?? '⚪';
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    healthy: 'border-green-300 bg-green-50',
    degraded: 'border-yellow-300 bg-yellow-50',
    down: 'border-red-300 bg-red-50',
    unknown: 'border-gray-200 bg-gray-50',
  };
  return map[status] ?? 'border-gray-200 bg-gray-50';
}

function ringColor(pct: number) {
  if (pct >= 80) return '#ef4444';
  if (pct >= 50) return '#f59e0b';
  return '#10b981';
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(str: string | null | undefined, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  'Health Dashboard',
  'API Logs',
  'Rate Limits',
  'Webhook Inspector',
  'Retry Queue',
  'Debug Console',
  'Tracking & Analytics',
  'Settings',
] as const;
type Tab = (typeof TABS)[number];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlatformMonitoringPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Health Dashboard');
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'latency'>('status');

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-monitoring');
      const data = await res.json() as { platforms: PlatformSummary[] };
      setPlatforms(data.platforms ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    autoRefreshRef.current = setInterval(() => { void fetchDashboard(); }, 60_000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchDashboard]);

  const handleRefreshAll = async () => {
    setRefreshingHealth(true);
    try {
      await fetch('/api/admin/platform-monitoring/health', { method: 'POST' });
      await fetchDashboard();
    } finally {
      setRefreshingHealth(false);
    }
  };

  const sortedPlatforms = [...platforms].sort((a, b) => {
    if (sortBy === 'status') {
      const order = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
      return (order[a.health_status as keyof typeof order] ?? 4) - (order[b.health_status as keyof typeof order] ?? 4);
    }
    if (sortBy === 'latency') {
      return (a.latency_ms ?? 9999) - (b.latency_ms ?? 9999);
    }
    return a.platform.localeCompare(b.platform);
  });

  const kpiCounts = {
    healthy: platforms.filter((p) => p.health_status === 'healthy').length,
    degraded: platforms.filter((p) => p.health_status === 'degraded').length,
    down: platforms.filter((p) => p.health_status === 'down').length,
    unknown: platforms.filter((p) => p.health_status === 'unknown').length,
  };
  const avgLatency =
    platforms.filter((p) => p.latency_ms !== null).length > 0
      ? Math.round(
          platforms.filter((p) => p.latency_ms !== null).reduce((s, p) => s + (p.latency_ms ?? 0), 0) /
            platforms.filter((p) => p.latency_ms !== null).length,
        )
      : null;

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📡 Platform Monitoring Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time health, API logs, rate limits, and debugging for all 36 platforms
          </p>
        </div>
        <button
          onClick={() => { void fetchDashboard(); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Health Dashboard' && (
        <HealthDashboardTab
          platforms={sortedPlatforms}
          loading={loading}
          kpiCounts={kpiCounts}
          avgLatency={avgLatency}
          sortBy={sortBy}
          setSortBy={setSortBy}
          refreshingHealth={refreshingHealth}
          onRefreshAll={() => { void handleRefreshAll(); }}
          selectedPlatform={selectedPlatform}
          setSelectedPlatform={setSelectedPlatform}
        />
      )}
      {activeTab === 'API Logs' && <ApiLogsTab platforms={platforms.map((p) => p.platform)} />}
      {activeTab === 'Rate Limits' && <RateLimitsTab />}
      {activeTab === 'Webhook Inspector' && <WebhookTab platforms={platforms.map((p) => p.platform)} />}
      {activeTab === 'Retry Queue' && <RetryQueueTab />}
      {activeTab === 'Debug Console' && <DebugConsoleTab platforms={platforms.map((p) => p.platform)} />}
      {activeTab === 'Tracking & Analytics' && <TrackingAnalyticsTab />}
      {activeTab === 'Settings' && <SettingsTab />}
    </div>
  );
}

// ─── Tab 1: Health Dashboard ──────────────────────────────────────────────────

function HealthDashboardTab({
  platforms,
  loading,
  kpiCounts,
  avgLatency,
  sortBy,
  setSortBy,
  refreshingHealth,
  onRefreshAll,
  selectedPlatform,
  setSelectedPlatform,
}: {
  platforms: PlatformSummary[];
  loading: boolean;
  kpiCounts: { healthy: number; degraded: number; down: number; unknown: number };
  avgLatency: number | null;
  sortBy: 'status' | 'name' | 'latency';
  setSortBy: (s: 'status' | 'name' | 'latency') => void;
  refreshingHealth: boolean;
  onRefreshAll: () => void;
  selectedPlatform: string | null;
  setSelectedPlatform: (p: string | null) => void;
}) {
  const [sidePanelData, setSidePanelData] = useState<HealthRow[] | null>(null);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const openSidePanel = async (platform: string) => {
    setSelectedPlatform(selectedPlatform === platform ? null : platform);
    if (selectedPlatform === platform) return;
    setLoadingPanel(true);
    try {
      const res = await fetch(`/api/admin/platform-monitoring/health/${platform}`);
      const data = await res.json() as { rows: HealthRow[] };
      setSidePanelData(data.rows ?? []);
    } finally {
      setLoadingPanel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading platform data…</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        {/* KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Healthy', value: kpiCounts.healthy, color: 'text-green-600 bg-green-50' },
            { label: 'Degraded', value: kpiCounts.degraded, color: 'text-yellow-600 bg-yellow-50' },
            { label: 'Down', value: kpiCounts.down, color: 'text-red-600 bg-red-50' },
            { label: 'Unknown', value: kpiCounts.unknown, color: 'text-gray-600 bg-gray-50' },
            { label: 'Avg Latency', value: avgLatency !== null ? `${avgLatency}ms` : 'N/A', color: 'text-indigo-600 bg-indigo-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-lg p-4 ${kpi.color}`}>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-sm font-medium mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-500">Sort by:</span>
          {(['status', 'name', 'latency'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded text-sm ${
                sortBy === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={onRefreshAll}
              disabled={refreshingHealth}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {refreshingHealth ? 'Checking…' : 'Refresh All'}
            </button>
          </div>
        </div>

        {/* Platform Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {platforms.map((p) => (
            <button
              key={p.platform}
              onClick={() => { void openSidePanel(p.platform); }}
              className={`border rounded-lg p-3 text-left cursor-pointer transition-all hover:shadow-md ${statusColor(p.health_status)} ${
                selectedPlatform === p.platform ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span>{statusDot(p.health_status)}</span>
                <span className="font-medium text-xs text-gray-800 truncate">{p.platform}</span>
              </div>
              <div className="text-xs text-gray-500">
                {p.latency_ms !== null ? `${p.latency_ms}ms` : '—'}
              </div>
              <div className="text-xs text-gray-400 mt-1">{timeAgo(p.checked_at)}</div>
              {p.error_count_24h > 0 && (
                <div className="mt-1 text-xs text-red-600">{p.error_count_24h} err/24h</div>
              )}
              {p.retry_pending > 0 && (
                <div className="text-xs text-orange-600">{p.retry_pending} retries</div>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs text-gray-400 mt-4">Auto-refreshes every 60 seconds</div>
      </div>

      {/* Side Panel */}
      {selectedPlatform && (
        <div className="w-80 shrink-0 border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">{selectedPlatform}</h3>
            <button onClick={() => setSelectedPlatform(null)} className="text-gray-400 hover:text-gray-600 text-lg">
              ×
            </button>
          </div>
          {loadingPanel ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : (
            <div>
              <div className="text-xs text-gray-500 mb-2 font-medium">24h Status Timeline</div>
              <div className="flex flex-wrap gap-1 mb-4">
                {(sidePanelData ?? []).slice(0, 48).map((row) => (
                  <div
                    key={row.id}
                    title={`${row.status} — ${timeAgo(row.checked_at)}`}
                    className={`w-3 h-3 rounded-full ${
                      row.status === 'healthy'
                        ? 'bg-green-400'
                        : row.status === 'degraded'
                        ? 'bg-yellow-400'
                        : row.status === 'down'
                        ? 'bg-red-500'
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
                {(sidePanelData ?? []).length === 0 && (
                  <div className="text-xs text-gray-400">No data yet — run health check first</div>
                )}
              </div>
              <div className="text-xs text-gray-500 font-medium mb-2">Recent Checks</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(sidePanelData ?? []).slice(0, 10).map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-xs">
                    <span>{statusDot(row.status)} {row.status}</span>
                    <span className="text-gray-500">{row.latency_ms !== null ? `${row.latency_ms}ms` : '—'}</span>
                    <span className="text-gray-400">{timeAgo(row.checked_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: API Logs ──────────────────────────────────────────────────────────

function ApiLogsTab({ platforms }: { platforms: string[] }) {
  const [logs, setLogs] = useState<ApiLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterError, setFilterError] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterError) params.set('is_error', 'true');
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await fetch(`/api/admin/platform-monitoring/api-logs?${params}`);
      const data = await res.json() as { rows: ApiLogRow[] };
      setLogs(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterError, dateFrom, dateTo]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const exportCsv = () => {
    const headers = 'Time,Platform,Method,Endpoint,Status,Duration,Error Type,Triggered By,Content ID\n';
    const rows = logs
      .map(
        (l) =>
          `${l.created_at},${l.platform},${l.http_method ?? ''},${l.endpoint},${l.response_status ?? ''},${l.duration_ms ?? ''},${l.error_type ?? ''},${l.triggered_by ?? ''},${l.content_item_id ?? ''}`,
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api-logs.csv';
    a.click();
  };

  const clearLogs = async () => {
    await fetch('/api/admin/platform-monitoring/api-logs', { method: 'DELETE' });
    setShowClearModal(false);
    void fetchLogs();
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">All Platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filterError} onChange={(e) => setFilterError(e.target.checked)} />
          Errors Only
        </label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="To"
        />
        <button
          onClick={() => { void fetchLogs(); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Apply
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
            Export CSV
          </button>
          <button onClick={() => setShowClearModal(true)} className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
            Clear Logs
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                {['Time', 'Platform', 'Method', 'Endpoint', 'Status', 'Duration', 'Error Type', 'Triggered By', 'Content ID'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 border-b border-gray-200 whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                      log.is_error ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium">{log.platform}</td>
                    <td className="px-3 py-2">{log.http_method ?? '—'}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{truncate(log.endpoint, 60)}</td>
                    <td className={`px-3 py-2 ${(log.response_status ?? 0) >= 400 ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                      {log.response_status ?? '—'}
                    </td>
                    <td className="px-3 py-2">{log.duration_ms !== null ? `${log.duration_ms}ms` : '—'}</td>
                    <td className="px-3 py-2 text-red-600">{log.error_type ?? '—'}</td>
                    <td className="px-3 py-2">{log.triggered_by ?? '—'}</td>
                    <td className="px-3 py-2">{log.content_item_id ?? '—'}</td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr key={`${log.id}-expand`} className="bg-gray-50">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Request Body</div>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32">
                              {truncate(log.request_body, 500) || '(none)'}
                            </pre>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Response Body</div>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32">
                              {truncate(log.response_body, 500) || '(none)'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    No logs found. Seed data or wait for platform interactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-2">Clear All API Logs?</h3>
            <p className="text-sm text-gray-600 mb-4">This will permanently delete all API log rows. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowClearModal(false)} className="px-4 py-2 border border-gray-300 rounded text-sm">
                Cancel
              </button>
              <button onClick={() => { void clearLogs(); }} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Rate Limits ───────────────────────────────────────────────────────

function RateLimitsTab() {
  const [data, setData] = useState<RateLimitPlatform[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  const fetchRateLimits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/platform-monitoring/rate-limits');
      const json = await res.json() as { platforms: RateLimitPlatform[] };
      setData(json.platforms ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRateLimits(); }, [fetchRateLimits]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      // Trigger by fetching the cron job endpoint or just re-fetch
      await fetchRateLimits();
    } finally {
      setSnapshotting(false);
    }
  };

  const warnings = data.filter((p) => p.groups.some((g) => (g.pct_used ?? 0) > 80));

  return (
    <div>
      {warnings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          ⚠️ {warnings.length} platform(s) over 80% rate limit:{' '}
          {warnings.map((w) => w.platform).join(', ')}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">{data.length} platforms with rate limit data</div>
        <button
          onClick={() => { void handleSnapshot(); }}
          disabled={snapshotting}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {snapshotting ? 'Snapshotting…' : 'Snapshot Now'}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading…</div>
      ) : data.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No rate limit data. Seed first: <code className="bg-gray-100 px-1 rounded">/api/admin/platform-monitoring/seed</code>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((p) => (
            <div key={p.platform} className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">{p.platform}</h3>
              <div className="space-y-3">
                {p.groups.map((g) => {
                  const pct = g.pct_used ?? 0;
                  const color = ringColor(pct);
                  return (
                    <div key={g.endpoint_group ?? 'default'}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{g.endpoint_group ?? 'default'}</span>
                        <span style={{ color }} className="font-bold">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>
                          {g.limit_remaining ?? '?'}/{g.limit_total ?? '?'} remaining
                        </span>
                        {g.limit_reset_at && (
                          <span>resets {timeAgo(g.limit_reset_at)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Webhook Inspector ─────────────────────────────────────────────────

function WebhookTab({ platforms }: { platforms: string[] }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterProcessed, setFilterProcessed] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simPlatform, setSimPlatform] = useState('facebook');
  const [simEventType, setSimEventType] = useState('page.message');
  const [simPayload, setSimPayload] = useState('{"test": true}');
  const [simulating, setSimulating] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterEventType) params.set('event_type', filterEventType);
      if (filterProcessed !== '') params.set('processed', filterProcessed);
      const res = await fetch(`/api/admin/platform-monitoring/webhooks?${params}`);
      const data = await res.json() as { rows: WebhookRow[] };
      setWebhooks(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterEventType, filterProcessed]);

  useEffect(() => { void fetchWebhooks(); }, [fetchWebhooks]);

  const handleAction = async (id: number, action: 'process' | 'replay') => {
    await fetch(`/api/admin/platform-monitoring/webhooks/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    void fetchWebhooks();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/platform-monitoring/webhooks/${id}`, { method: 'DELETE' });
    void fetchWebhooks();
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      let payload: Record<string, unknown> = { test: true };
      try { payload = JSON.parse(simPayload) as Record<string, unknown>; } catch { /* keep default */ }
      await fetch('/api/admin/platform-monitoring/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: simPlatform, event_type: simEventType, payload }),
      });
      setShowSimModal(false);
      void fetchWebhooks();
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">All Platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          placeholder="Event Type"
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <select
          value={filterProcessed}
          onChange={(e) => setFilterProcessed(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="false">Unprocessed</option>
          <option value="true">Processed</option>
        </select>
        <button
          onClick={() => { void fetchWebhooks(); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Apply
        </button>
        <button
          onClick={() => setShowSimModal(true)}
          className="ml-auto px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
        >
          Simulate Webhook
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                {['Time', 'Platform', 'Event Type', 'Event ID', 'Sig Valid', 'Processed', 'Payload', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <>
                  <tr
                    key={w.id}
                    onClick={() => setExpandedRow(expandedRow === w.id ? null : w.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(w.received_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium">{w.platform}</td>
                    <td className="px-3 py-2">{w.event_type ?? '—'}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{truncate(w.event_id, 30)}</td>
                    <td className="px-3 py-2">{w.signature_valid ? '✅' : w.signature_valid === false ? '❌' : '?'}</td>
                    <td className="px-3 py-2">{w.processed ? '✅' : '⏳'}</td>
                    <td className="px-3 py-2 max-w-xs">{truncate(JSON.stringify(w.payload), 100)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {!w.processed && (
                          <button
                            onClick={() => { void handleAction(w.id, 'process'); }}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                          >
                            Process
                          </button>
                        )}
                        <button
                          onClick={() => { void handleAction(w.id, 'replay'); }}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          Replay
                        </button>
                        <button
                          onClick={() => { void handleDelete(w.id); }}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === w.id && (
                    <tr key={`${w.id}-expand`} className="bg-gray-50">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Full Payload</div>
                        <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-auto max-h-48">
                          {JSON.stringify(w.payload, null, 2)}
                        </pre>
                        {w.processing_error && (
                          <div className="mt-2 text-xs text-red-600">Error: {w.processing_error}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {webhooks.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    No webhook events. Use Simulate Webhook to create test data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Simulate Modal */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-4">Simulate Webhook Event</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Platform</label>
                <select
                  value={simPlatform}
                  onChange={(e) => setSimPlatform(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Event Type</label>
                <input
                  value={simEventType}
                  onChange={(e) => setSimEventType(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Payload (JSON)</label>
                <textarea
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowSimModal(false)} className="px-4 py-2 border border-gray-300 rounded text-sm">
                Cancel
              </button>
              <button
                onClick={() => { void handleSimulate(); }}
                disabled={simulating}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {simulating ? 'Simulating…' : 'Simulate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Retry Queue ───────────────────────────────────────────────────────

function RetryQueueTab() {
  const [items, setItems] = useState<RetryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewPayload, setViewPayload] = useState<RetryRow | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/platform-monitoring/retry-queue');
      const data = await res.json() as { rows: RetryRow[] };
      setItems(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  const handleAction = async (id: number, action: 'retry_now' | 'cancel') => {
    await fetch(`/api/admin/platform-monitoring/retry-queue/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    void fetchQueue();
  };

  const bulkRetry = async () => {
    const pending = items.filter((i) => i.status === 'pending');
    await Promise.all(pending.map((i) => handleAction(i.id, 'retry_now')));
  };

  const bulkCancelExhausted = async () => {
    const exhausted = items.filter((i) => i.status === 'exhausted');
    await Promise.all(exhausted.map((i) => handleAction(i.id, 'cancel')));
  };

  const kpi = {
    pending: items.filter((i) => i.status === 'pending').length,
    retrying: items.filter((i) => i.status === 'retrying').length,
    succeeded: items.filter((i) => i.status === 'succeeded').length,
    exhausted: items.filter((i) => i.status === 'exhausted').length,
  };

  return (
    <div>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending', value: kpi.pending, color: 'text-orange-600 bg-orange-50' },
          { label: 'Retrying', value: kpi.retrying, color: 'text-blue-600 bg-blue-50' },
          { label: 'Succeeded', value: kpi.succeeded, color: 'text-green-600 bg-green-50' },
          { label: 'Exhausted', value: kpi.exhausted, color: 'text-red-600 bg-red-50' },
        ].map((k) => (
          <div key={k.label} className={`rounded-lg p-4 ${k.color}`}>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-sm font-medium">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => { void bulkRetry(); }} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Retry All Pending
        </button>
        <button onClick={() => { void bulkCancelExhausted(); }} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
          Cancel All Exhausted
        </button>
        <button onClick={() => { void fetchQueue(); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                {['Platform', 'Operation', 'Attempt', 'Max', 'Next Retry', 'Status', 'Last Error', 'Content ID', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-100 ${item.status === 'exhausted' ? 'bg-red-50' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">{item.platform}</td>
                  <td className="px-3 py-2">{item.operation_type ?? '—'}</td>
                  <td className="px-3 py-2">{item.attempt_count}</td>
                  <td className="px-3 py-2">{item.max_attempts}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{timeAgo(item.next_retry_at)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'pending'
                          ? 'bg-orange-100 text-orange-700'
                          : item.status === 'retrying'
                          ? 'bg-blue-100 text-blue-700'
                          : item.status === 'succeeded'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'exhausted'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.status}
                      {item.status === 'exhausted' && ' — Needs Manual Review'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">{truncate(item.last_error, 50)}</td>
                  <td className="px-3 py-2">{item.content_item_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { void handleAction(item.id, 'retry_now'); }}
                        className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                      >
                        Retry Now
                      </button>
                      <button
                        onClick={() => { void handleAction(item.id, 'cancel'); }}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setViewPayload(item)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                      >
                        Payload
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    No retry items. Queue is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payload Modal */}
      {viewPayload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Payload — {viewPayload.platform} / {viewPayload.operation_type}</h3>
              <button onClick={() => setViewPayload(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64">
              {JSON.stringify(viewPayload.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 6: Debug Console ─────────────────────────────────────────────────────

function DebugConsoleTab({ platforms }: { platforms: string[] }) {
  const [selectedPlatform, setSelectedPlatform] = useState(platforms[0] ?? 'facebook');
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [running, setRunning] = useState(false);
  const [recentLogs, setRecentLogs] = useState<ApiLogRow[]>([]);
  const logRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecentLogs = useCallback(async (platform: string) => {
    try {
      const res = await fetch(`/api/admin/platform-monitoring/api-logs/${platform}?limit=10`);
      const data = await res.json() as { rows: ApiLogRow[] };
      setRecentLogs(data.rows ?? []);
    } catch {
      setRecentLogs([]);
    }
  }, []);

  useEffect(() => {
    if (selectedPlatform) {
      void fetchRecentLogs(selectedPlatform);
      logRefreshRef.current = setInterval(() => { void fetchRecentLogs(selectedPlatform); }, 10_000);
    }
    return () => {
      if (logRefreshRef.current) clearInterval(logRefreshRef.current);
    };
  }, [selectedPlatform, fetchRecentLogs]);

  const runDebug = async () => {
    setRunning(true);
    setDebugResult(null);
    try {
      const res = await fetch(`/api/admin/platform-monitoring/debug/${selectedPlatform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json() as DebugResult;
      setDebugResult(data);
    } finally {
      setRunning(false);
    }
  };

  const copyReport = () => {
    if (!debugResult) return;
    const text = [
      `Debug Report: ${debugResult.platform}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Environment Variables',
      ...debugResult.env_check.vars.map((v) => `  ${v.set ? '✅' : '❌'} ${v.name}`),
      '',
      '## API Connectivity',
      `  Reachable: ${debugResult.connectivity.reachable}`,
      `  Latency: ${debugResult.connectivity.latency_ms ?? 'N/A'}ms`,
      `  HTTP Status: ${debugResult.connectivity.http_status ?? 'N/A'}`,
      `  Endpoint: ${debugResult.connectivity.endpoint ?? 'N/A'}`,
      '',
      '## Rate Limit',
      `  ${JSON.stringify(debugResult.rate_limit ?? 'No data')}`,
      '',
      '## Health Status',
      `  ${JSON.stringify(debugResult.health_status ?? 'No data')}`,
      '',
      '## Recommendations',
      ...debugResult.recommendations.map((r) => `  • ${r}`),
    ].join('\n');
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Controls + Results */}
      <div>
        <div className="flex gap-3 mb-4">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => { void runDebug(); }}
            disabled={running}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run Debug Trace'}
          </button>
          {debugResult && (
            <button
              onClick={copyReport}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Copy Report
            </button>
          )}
        </div>

        {debugResult && (
          <div className="space-y-4">
            {/* Env Check */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">
                {debugResult.env_check.all_set ? '✅' : '❌'} Environment Variables
              </h4>
              <div className="space-y-1">
                {debugResult.env_check.vars.map((v) => (
                  <div key={v.name} className="flex items-center gap-2 text-xs">
                    <span>{v.set ? '✅' : '❌'}</span>
                    <span className={v.set ? 'text-gray-700' : 'text-red-600'}>{v.name}</span>
                    <span className={`ml-auto ${v.set ? 'text-green-600' : 'text-red-500'}`}>{v.set ? 'SET' : 'NOT SET'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connectivity */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">
                {debugResult.connectivity.reachable ? '✅' : '❌'} API Connectivity
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Endpoint:</span> <span>{debugResult.connectivity.endpoint ?? 'unknown'}</span></div>
                <div><span className="text-gray-500">Latency:</span> <span>{debugResult.connectivity.latency_ms !== null ? `${debugResult.connectivity.latency_ms}ms` : 'N/A'}</span></div>
                <div><span className="text-gray-500">HTTP Status:</span> <span>{debugResult.connectivity.http_status ?? 'N/A'}</span></div>
                <div><span className="text-gray-500">Reachable:</span> <span>{debugResult.connectivity.reachable ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            {/* Last Log */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">📋 Last API Log</h4>
              {debugResult.last_log ? (
                <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-24">
                  {JSON.stringify(debugResult.last_log, null, 2)}
                </pre>
              ) : (
                <div className="text-xs text-gray-400">No logs found</div>
              )}
            </div>

            {/* Rate Limit */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">📊 Rate Limit Status</h4>
              {debugResult.rate_limit ? (
                <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-24">
                  {JSON.stringify(debugResult.rate_limit, null, 2)}
                </pre>
              ) : (
                <div className="text-xs text-gray-400">No rate limit data</div>
              )}
            </div>

            {/* Health */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">🏥 Health Status</h4>
              {debugResult.health_status ? (
                <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-24">
                  {JSON.stringify(debugResult.health_status, null, 2)}
                </pre>
              ) : (
                <div className="text-xs text-gray-400">No health data</div>
              )}
            </div>

            {/* Recommendations */}
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">💡 Recommendations</h4>
              <ul className="space-y-1">
                {debugResult.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-amber-800">• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!debugResult && !running && (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-lg">
            Select a platform and click Run Debug Trace
          </div>
        )}
      </div>

      {/* Right: Log Stream */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-700">
            Log Stream — {selectedPlatform} (last 10, auto-refresh 10s)
          </h3>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id} className={`border-t border-gray-100 ${log.is_error ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{timeAgo(log.created_at)}</td>
                  <td className="px-3 py-2">{log.http_method ?? '—'}</td>
                  <td className={`px-3 py-2 font-medium ${(log.response_status ?? 0) >= 400 ? 'text-red-600' : 'text-green-600'}`}>
                    {log.response_status ?? '—'}
                  </td>
                  <td className="px-3 py-2">{log.duration_ms !== null ? `${log.duration_ms}ms` : '—'}</td>
                  <td className="px-3 py-2 text-red-600">{log.error_type ?? '—'}</td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-400">
                    No recent logs for {selectedPlatform}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 7: Tracking & Analytics ──────────────────────────────────────────────

function TrackingAnalyticsTab() {
  const [data, setData] = useState<{
    error_rate_7d: { platform: string; days: number[] }[];
    error_types: { error_type: string; count: number; pct: number }[];
    slowest: { platform: string; avg_latency: number }[];
    most_active: { platform: string; call_count: number }[];
    success_rate: { platform: string; success_rate: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Aggregate from API logs
        const [logsRes, healthRes] = await Promise.all([
          fetch('/api/admin/platform-monitoring/api-logs'),
          fetch('/api/admin/platform-monitoring/health'),
        ]);
        const logsData = await logsRes.json() as { rows: ApiLogRow[] };
        const healthData = await healthRes.json() as { rows: HealthRow[] };
        const logs = logsData.rows ?? [];
        const healthRows = healthData.rows ?? [];

        // Error rate 7 days per platform
        const platformSet = [...new Set(logs.map((l) => l.platform))];
        const error_rate_7d = platformSet.map((p) => {
          const pLogs = logs.filter((l) => l.platform === p);
          const days = Array.from({ length: 7 }, (_, i) => {
            const dayAgo = new Date(Date.now() - i * 86400000).toDateString();
            return pLogs.filter((l) => new Date(l.created_at).toDateString() === dayAgo && l.is_error).length;
          }).reverse();
          return { platform: p, days };
        });

        // Error types
        const errorTypeCounts: Record<string, number> = {};
        for (const log of logs) {
          if (log.is_error && log.error_type) {
            errorTypeCounts[log.error_type] = (errorTypeCounts[log.error_type] ?? 0) + 1;
          }
        }
        const totalErrors = Object.values(errorTypeCounts).reduce((a, b) => a + b, 0);
        const error_types = Object.entries(errorTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([error_type, count]) => ({
            error_type,
            count,
            pct: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0,
          }));

        // Slowest platforms (from health)
        const latencyByPlatform: Record<string, number[]> = {};
        for (const row of healthRows) {
          if (row.latency_ms !== null) {
            if (!latencyByPlatform[row.platform]) latencyByPlatform[row.platform] = [];
            latencyByPlatform[row.platform].push(row.latency_ms);
          }
        }
        const slowest = Object.entries(latencyByPlatform)
          .map(([platform, lats]) => ({
            platform,
            avg_latency: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
          }))
          .sort((a, b) => b.avg_latency - a.avg_latency)
          .slice(0, 10);

        // Most active (last 24h)
        const now = Date.now();
        const recent = logs.filter((l) => now - new Date(l.created_at).getTime() < 86400000);
        const callCounts: Record<string, number> = {};
        for (const log of recent) callCounts[log.platform] = (callCounts[log.platform] ?? 0) + 1;
        const most_active = Object.entries(callCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([platform, call_count]) => ({ platform, call_count }));

        // Success rate
        const success_rate = platformSet.map((p) => {
          const pLogs = logs.filter((l) => l.platform === p);
          const successes = pLogs.filter((l) => !l.is_error).length;
          return {
            platform: p,
            success_rate: pLogs.length > 0 ? Math.round((successes / pLogs.length) * 100) : 100,
          };
        });

        setData({ error_rate_7d, error_types, slowest, most_active, success_rate });
      } finally {
        setLoading(false);
      }
    };
    void fetchAnalytics();
  }, []);

  if (loading) return <div className="text-center text-gray-400 py-8">Loading analytics…</div>;
  if (!data) return <div className="text-center text-gray-400 py-8">No analytics data</div>;

  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return d.toLocaleDateString('en', { weekday: 'short' });
  });

  return (
    <div className="space-y-8">
      {/* Error Rate 7d */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Error Rate — 7-Day per Platform</h3>
        {data.error_rate_7d.length === 0 ? (
          <div className="text-sm text-gray-400">No API log data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-3 py-2 border-b border-gray-200">Platform</th>
                  {dayLabels.map((d) => (
                    <th key={d} className="px-3 py-2 border-b border-gray-200 text-center">{d}</th>
                  ))}
                  <th className="px-3 py-2 border-b border-gray-200 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.error_rate_7d.map((row) => (
                  <tr key={row.platform} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">{row.platform}</td>
                    {row.days.map((count, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center font-medium ${count > 0 ? 'text-red-600' : 'text-gray-400'}`}
                      >
                        {count}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-bold">{row.days.reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Error Types */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Top Error Types</h3>
          {data.error_types.length === 0 ? (
            <div className="text-sm text-gray-400">No errors recorded</div>
          ) : (
            <div className="space-y-2">
              {data.error_types.map((et) => (
                <div key={et.error_type} className="flex items-center gap-3">
                  <div className="text-sm w-32 truncate text-gray-700">{et.error_type}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-red-500 h-4 rounded-full"
                      style={{ width: `${et.pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 w-16 text-right">{et.pct}% ({et.count})</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slowest Platforms */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Slowest Platforms (Avg Latency)</h3>
          <div className="space-y-2">
            {data.slowest.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.platform}</span>
                <span className={`font-medium ${p.avg_latency > 2000 ? 'text-red-600' : p.avg_latency > 1000 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {p.avg_latency}ms
                </span>
              </div>
            ))}
            {data.slowest.length === 0 && <div className="text-sm text-gray-400">No latency data</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Most Active */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Most Active Platforms (Last 24h)</h3>
          <div className="space-y-2">
            {data.most_active.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.platform}</span>
                <span className="font-medium text-indigo-600">{p.call_count} calls</span>
              </div>
            ))}
            {data.most_active.length === 0 && <div className="text-sm text-gray-400">No API calls in last 24h</div>}
          </div>
        </div>

        {/* Success Rate */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Success Rate (Last 7 Days)</h3>
          <div className="space-y-2">
            {data.success_rate.map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <div className="text-sm w-28 truncate text-gray-700">{p.platform}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${p.success_rate >= 90 ? 'bg-green-500' : p.success_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${p.success_rate}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 w-12 text-right">{p.success_rate}%</div>
              </div>
            ))}
            {data.success_rate.length === 0 && <div className="text-sm text-gray-400">No API log data</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 8: Settings ──────────────────────────────────────────────────────────

function SettingsTab() {
  const [healthFreq, setHealthFreq] = useState('5');
  const [logRetention, setLogRetention] = useState('30');
  const [rateLimitWarn, setRateLimitWarn] = useState('80');
  const [latencyWarn, setLatencyWarn] = useState('2000');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [backoffStrategy, setBackoffStrategy] = useState('exponential');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Settings stored in component state (no backend table yet)
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          Settings saved (stored locally — backend persistence requires a config table)
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Health Check Frequency</h3>
        <div className="flex gap-2">
          {['5', '10', '15', '30'].map((v) => (
            <button
              key={v}
              onClick={() => setHealthFreq(v)}
              className={`px-4 py-2 rounded text-sm ${healthFreq === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {v} min
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Current cron schedule: <code className="bg-gray-100 px-1 rounded">*/5 * * * *</code> (PlatformHealthCheckJob)
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Log Retention</h3>
        <div className="flex gap-2">
          {['7', '14', '30', '90'].map((v) => (
            <button
              key={v}
              onClick={() => setLogRetention(v)}
              className={`px-4 py-2 rounded text-sm ${logRetention === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {v} days
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ApiLogCleanupJob runs daily at 3am UTC using this retention setting.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Alert Thresholds</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Rate Limit Warning (%)</label>
            <input
              type="number"
              value={rateLimitWarn}
              onChange={(e) => setRateLimitWarn(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
              min="1"
              max="100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Latency Warning (ms)</label>
            <input
              type="number"
              value={latencyWarn}
              onChange={(e) => setLatencyWarn(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
              min="100"
            />
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Notification Settings</h3>
        <div>
          <label className="text-sm font-medium text-gray-700">Alert Email</label>
          <input
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="admin@example.com"
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Alerts for: platform down, rate limit critical, retry exhausted
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Auto-Retry Configuration</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoRetryEnabled}
              onChange={(e) => setAutoRetryEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-gray-700">Enable Auto-Retry</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Max Attempts</label>
              <input
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                min="1"
                max="10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Backoff Strategy</label>
              <select
                value={backoffStrategy}
                onChange={(e) => setBackoffStrategy(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="linear">Linear</option>
                <option value="exponential">Exponential</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
      >
        Save Settings
      </button>
    </div>
  );
}
