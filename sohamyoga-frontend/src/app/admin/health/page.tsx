'use client';

import { useState, useEffect, useCallback } from 'react';
import { monitoringApi } from '@/lib/api';
import type { SystemHealth } from '@/lib/api';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthCheck, setHealthCheck] = useState<{ status: string; checks: { name: string; status: string; duration: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      const [systemData, checkData] = await Promise.all([
        monitoringApi.getSystemHealth(),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`, { credentials: 'include' })
          .then(r => r.json())
          .catch(() => null),
      ]);
      setHealth(systemData);
      setHealthCheck(checkData);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-dark-500">Loading system health...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">System Health</h1>
          <p className="text-dark-500 mt-1">Database, runtime, and entity metrics</p>
        </div>
        <button onClick={loadHealth} className="btn-primary text-sm py-2 px-4">
          Refresh
        </button>
      </div>

      {/* Health Check Status */}
      {healthCheck && (
        <div className={`rounded-lg shadow-sm p-6 border ${
          healthCheck.status === 'Healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${healthCheck.status === 'Healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <h2 className="text-lg font-semibold">
              Overall Status: {healthCheck.status}
            </h2>
          </div>
          {healthCheck.checks && (
            <div className="mt-3 space-y-2">
              {healthCheck.checks.map((check, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className={`w-2 h-2 rounded-full ${check.status === 'Healthy' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{check.name}</span>
                  <span className="text-dark-500">({check.duration?.toFixed(1)}ms)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {health && (
        <>
          {/* Database Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
              <p className="text-sm text-dark-500">Database Provider</p>
              <p className="text-2xl font-bold text-dark-900 mt-1">{health.database.provider}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
              <p className="text-sm text-dark-500">Database Size</p>
              <p className="text-2xl font-bold text-dark-900 mt-1">{health.database.sizeMb} MB</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
              <p className="text-sm text-dark-500">Uptime</p>
              <p className="text-2xl font-bold text-dark-900 mt-1">{health.runtime.uptime}</p>
            </div>
          </div>

          {/* Runtime Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">Runtime</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-dark-500">Memory Usage</p>
                <p className="text-xl font-semibold text-dark-900">{health.runtime.workingSetMb} MB</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Environment</p>
                <p className="text-xl font-semibold text-dark-900">{health.runtime.environment}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Framework</p>
                <p className="text-sm font-medium text-dark-900 mt-1">{health.runtime.framework}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Uptime</p>
                <p className="text-xl font-semibold text-dark-900">{health.runtime.uptime}</p>
              </div>
            </div>
          </div>

          {/* Record Counts */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">Entity Record Counts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(health.recordCounts).map(([key, count]) => (
                <div key={key} className="bg-dark-50 rounded-lg p-4">
                  <p className="text-xs text-dark-500 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-2xl font-bold text-dark-900 mt-1">{count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
