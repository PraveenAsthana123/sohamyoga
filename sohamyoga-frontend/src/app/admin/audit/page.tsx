'use client';

import { useState, useEffect, useCallback } from 'react';
import { monitoringApi } from '@/lib/api';
import type { AuditLog } from '@/lib/api';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await monitoringApi.getAuditLogs({
        page,
        pageSize: 50,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
      });
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const actionColor = (action: string) => {
    if (action.includes('Create') || action.includes('Add')) return 'bg-green-100 text-green-800';
    if (action.includes('Update') || action.includes('Edit')) return 'bg-blue-100 text-blue-800';
    if (action.includes('Delete') || action.includes('Remove')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Audit Trail</h1>
          <p className="text-dark-500 mt-1">Track all admin actions and changes</p>
        </div>
        <button onClick={loadLogs} className="btn-primary text-sm py-2 px-4">
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-dark-200 flex flex-wrap gap-3">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Filter by action..."
          className="px-3 py-2 border border-dark-300 rounded-lg text-sm w-48"
        />
        <input
          type="text"
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          placeholder="Filter by entity type..."
          className="px-3 py-2 border border-dark-300 rounded-lg text-sm w-48"
        />
        <span className="text-sm text-dark-500 self-center ml-auto">
          {total} total entries
        </span>
      </div>

      {/* Audit Log Table */}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase">IP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-dark-50">
                    <td className="px-4 py-3 text-xs text-dark-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium">{log.entityType}</span>
                      {log.entityId && <span className="text-dark-400"> #{log.entityId}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-dark-600">{log.userEmail || log.userId || '-'}</td>
                    <td className="px-4 py-3 text-xs text-dark-500">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {log.details && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                        >
                          {expandedId === log.id ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.details && (
                    <tr key={`${log.id}-details`}>
                      <td colSpan={6} className="px-4 py-3 bg-dark-50">
                        <pre className="text-xs text-dark-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-dark-200">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(log.details), null, 2);
                            } catch {
                              return log.details;
                            }
                          })()}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-dark-400">
                    No audit log entries found.
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
