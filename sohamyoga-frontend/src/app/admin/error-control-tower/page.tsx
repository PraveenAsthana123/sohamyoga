'use client';

import { useState, useEffect, useCallback } from 'react';

interface EctError {
  id: number;
  error_id: string;
  module: string;
  error_type: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  message: string;
  stack_trace: string | null;
  status: 'open' | 'investigating' | 'resolved';
  resolved_at: string | null;
  created_at: string;
}

interface ModuleHealth {
  module: string;
  health_status: 'healthy' | 'warning' | 'critical' | 'unknown';
  error_count: number;
  last_checked: string;
}

interface Summary {
  total: number;
  critical: number;
  open: number;
  resolved: number;
}

interface ApiResponse {
  errors: EctError[];
  module_health: ModuleHealth[];
  summary: Summary;
  generated_at: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  P0: { bg: 'bg-red-100', text: 'text-red-800', label: 'P0 Critical' },
  P1: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'P1 High' },
  P2: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'P2 Medium' },
  P3: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'P3 Low' },
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
};

const HEALTH_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  healthy: { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-800' },
  warning: { dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-800' },
  critical: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800' },
  unknown: { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-700' },
};

const ERROR_TYPES = ['Build', 'Runtime', 'API', 'TypeScript', 'Test', 'Auth', 'DB'];
const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

export default function ErrorControlTowerPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'log' | 'health' | 'settings'>('live');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterModule, setFilterModule] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/error-control-tower');
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
      }
    } catch {
      // network error — keep showing last state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const updateStatus = async (error_id: string, status: string) => {
    setUpdatingId(error_id);
    try {
      const res = await fetch('/api/admin/error-control-tower', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_id, status }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredErrors = (data?.errors ?? []).filter((e) => {
    if (filterModule && !e.module.toLowerCase().includes(filterModule.toLowerCase())) return false;
    if (filterSeverity && e.severity !== filterSeverity) return false;
    if (filterType && e.error_type !== filterType) return false;
    return true;
  });

  const liveErrors = filteredErrors.filter((e) => e.status !== 'resolved');
  const allErrors = filteredErrors;

  const modules = Array.from(new Set((data?.errors ?? []).map((e) => e.module))).sort();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading Error Control Tower...</div>
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, critical: 0, open: 0, resolved: 0 };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Control Tower</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time error tracking across all modules
            {data?.generated_at && (
              <span className="ml-2 text-gray-400">
                &mdash; updated {new Date(data.generated_at).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            autoRefresh
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {autoRefresh ? 'Auto-refresh: ON (30s)' : 'Auto-refresh: OFF'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Errors</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-600">Critical (P0)</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{summary.critical}</div>
        </div>
        <div className="bg-white border border-orange-200 rounded-lg p-4">
          <div className="text-sm text-orange-600">Open</div>
          <div className="text-3xl font-bold text-orange-700 mt-1">{summary.open}</div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600">Resolved</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{summary.resolved}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-6">
          {(
            [
              { key: 'live', label: 'Live Errors' },
              { key: 'log', label: 'Error Log' },
              { key: 'health', label: 'Module Health' },
              { key: 'settings', label: 'Settings' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters (Live & Log tabs) */}
      {(activeTab === 'live' || activeTab === 'log') && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Types</option>
            {ERROR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {(filterModule || filterSeverity || filterType) && (
            <button
              onClick={() => {
                setFilterModule('');
                setFilterSeverity('');
                setFilterType('');
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Live Errors Tab */}
      {activeTab === 'live' && (
        <ErrorTable errors={liveErrors} onUpdateStatus={updateStatus} updatingId={updatingId} />
      )}

      {/* Error Log Tab */}
      {activeTab === 'log' && (
        <ErrorTable errors={allErrors} onUpdateStatus={updateStatus} updatingId={updatingId} showResolved />
      )}

      {/* Module Health Tab */}
      {activeTab === 'health' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Module Health Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(data?.module_health ?? []).map((mod) => {
              const colors = HEALTH_COLORS[mod.health_status] ?? HEALTH_COLORS.unknown;
              return (
                <div
                  key={mod.module}
                  className={`border rounded-lg p-4 ${colors.bg} border-opacity-50`}
                  style={{ borderColor: mod.health_status === 'critical' ? '#fca5a5' : mod.health_status === 'warning' ? '#fcd34d' : '#d1d5db' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <span className="font-medium text-gray-900 capitalize">{mod.module}</span>
                  </div>
                  <div className={`text-xs font-medium ${colors.text} capitalize`}>{mod.health_status}</div>
                  <div className="text-xs text-gray-500 mt-1">{mod.error_count} error{mod.error_count !== 1 ? 's' : ''}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    checked {new Date(mod.last_checked).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Error Tower Settings</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Auto-Refresh Interval</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>30 seconds</option>
                <option>1 minute</option>
                <option>5 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Alert Threshold</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>P0 only</option>
                <option>P0 + P1</option>
                <option>All severities</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Notifications</label>
              <input
                type="email"
                placeholder="admin@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Retention Period</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>30 days</option>
                <option>60 days</option>
                <option>90 days</option>
              </select>
            </div>
          </div>
          <div className="pt-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorTable({
  errors,
  onUpdateStatus,
  updatingId,
  showResolved = false,
}: {
  errors: EctError[];
  onUpdateStatus: (id: string, status: string) => void;
  updatingId: string | null;
  showResolved?: boolean;
}) {
  if (errors.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-gray-400 text-4xl mb-3">✓</div>
        <div className="text-gray-600 font-medium">No errors found</div>
        <div className="text-gray-400 text-sm mt-1">All systems operating normally</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Module</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Message</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errors.map((err) => {
              const sev = SEVERITY_COLORS[err.severity] ?? SEVERITY_COLORS.P3;
              const statusCls = STATUS_COLORS[err.status] ?? 'bg-gray-100 text-gray-700';
              const isUpdating = updatingId === err.error_id;
              return (
                <tr key={err.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{err.error_id}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(err.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium capitalize">
                      {err.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{err.error_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">
                    <div className="truncate" title={err.message}>
                      {err.message}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusCls}`}>
                      {err.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {err.status === 'open' && (
                        <button
                          onClick={() => onUpdateStatus(err.error_id, 'investigating')}
                          disabled={isUpdating}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                        >
                          {isUpdating ? '...' : 'Ack'}
                        </button>
                      )}
                      {err.status !== 'resolved' && (
                        <button
                          onClick={() => onUpdateStatus(err.error_id, 'resolved')}
                          disabled={isUpdating}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
                        >
                          {isUpdating ? '...' : 'Resolve'}
                        </button>
                      )}
                      {err.status === 'resolved' && showResolved && (
                        <button
                          onClick={() => onUpdateStatus(err.error_id, 'open')}
                          disabled={isUpdating}
                          className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
