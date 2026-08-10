'use client';

import { useState, useEffect, useCallback } from 'react';
import { monitoringApi } from '@/lib/api';
import type { ApiRequestLog, ApiRequestStats } from '@/lib/api';

export default function ApiTrackingPage() {
  const [requests, setRequests] = useState<ApiRequestLog[]>([]);
  const [stats, setStats] = useState<ApiRequestStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState('');
  const [pathFilter, setPathFilter] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqData, statsData] = await Promise.all([
        monitoringApi.getApiRequests({
          page,
          pageSize: 25,
          method: methodFilter || undefined,
          path: pathFilter || undefined,
        }),
        monitoringApi.getApiRequestStats(),
      ]);
      setRequests(reqData.items);
      setTotal(reqData.total);
      setStats(statsData);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [page, methodFilter, pathFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const statusColor = (code: number) => {
    if (code < 300) return 'bg-green-100 text-green-800';
    if (code < 400) return 'bg-yellow-100 text-yellow-800';
    if (code < 500) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const methodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-800',
      POST: 'bg-green-100 text-green-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800',
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">API Tracking</h1>
          <p className="text-dark-500 mt-1">Monitor API request performance and errors</p>
        </div>
        <button onClick={loadData} className="btn-primary text-sm py-2 px-4">
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <p className="text-sm text-dark-500">Requests (24h)</p>
            <p className="text-3xl font-bold text-dark-900 mt-1">{stats.totalRequests.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <p className="text-sm text-dark-500">Avg Response Time</p>
            <p className="text-3xl font-bold text-dark-900 mt-1">{stats.avgDurationMs}ms</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <p className="text-sm text-dark-500">Error Count</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{stats.errorCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <p className="text-sm text-dark-500">Error Rate</p>
            <p className="text-3xl font-bold text-dark-900 mt-1">{stats.errorRate}%</p>
          </div>
        </div>
      )}

      {/* Top Endpoints */}
      {stats && stats.topEndpoints.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Top Endpoints (24h)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-200">
                  <th className="text-left py-2 text-dark-600">Method</th>
                  <th className="text-left py-2 text-dark-600">Path</th>
                  <th className="text-right py-2 text-dark-600">Requests</th>
                  <th className="text-right py-2 text-dark-600">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {stats.topEndpoints.map((ep, idx) => (
                  <tr key={idx} className="border-b border-dark-100">
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColor(ep.method)}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{ep.path}</td>
                    <td className="py-2 text-right">{ep.count}</td>
                    <td className="py-2 text-right">{ep.avgDurationMs.toFixed(1)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-dark-200 flex flex-wrap gap-3">
        <select
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-dark-300 rounded-lg text-sm"
        >
          <option value="">All Methods</option>
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={pathFilter}
          onChange={(e) => { setPathFilter(e.target.value); setPage(1); }}
          placeholder="Filter by path..."
          className="px-3 py-2 border border-dark-300 rounded-lg text-sm w-64"
        />
        <span className="text-sm text-dark-500 self-center ml-auto">
          {total} total requests
        </span>
      </div>

      {/* Request Table */}
      <div className="bg-white rounded-lg shadow-sm border border-dark-200 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-dark-500">Loading...</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-50 border-b border-dark-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">Path</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-dark-600 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-dark-50">
                  <td className="px-4 py-3 text-xs text-dark-500 whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColor(req.method)}`}>
                      {req.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs max-w-xs truncate">{req.path}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(req.statusCode)}`}>
                      {req.statusCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">{req.durationMs}ms</td>
                  <td className="px-4 py-3 text-xs text-dark-500">{req.clientIp || '-'}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-dark-400">
                    No API requests recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-dark-300 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-dark-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border border-dark-300 rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
