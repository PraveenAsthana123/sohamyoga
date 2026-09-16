'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
type TabId = 'system' | 'api' | 'audit' | 'cache' | 'errors' | 'jobs' | 'sessions';

interface ServiceHealth {
  name: string;
  status: string;
  latencyMs: number | null;
  httpStatus: number | null;
  endpoint: string | null;
  errorMessage: string | null;
  lastChecked: string;
}
interface SystemHealthData {
  status: string;
  services: ServiceHealth[];
  lastChecked: string;
  uptime: number;
}

interface ApiRequestRow {
  id: number;
  method: string;
  path: string;
  status_code: number | null;
  duration_ms: number | null;
  ip_address: string | null;
  created_at: string;
}
interface ApiRequestsData { items: ApiRequestRow[]; total: number; page: number; pageSize: number }

interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  created_at: string;
  source: string;
}
interface AuditLogsData { items: AuditRow[]; supplementary: AuditRow[]; total: number }

interface CacheStatus {
  redis_configured: boolean;
  redis_url_set: boolean;
  redis_latency_ms: number | null;
  nextjs_cache: string;
  routes_with_no_store: number;
  routes_with_force_cache: number;
}

interface ErrorRow {
  id: number;
  level: string;
  message: string;
  route: string | null;
  resolved: boolean;
  created_at: string;
}
interface ErrorLogsData { items: ErrorRow[]; total: number }

// ── Shared UI atoms ────────────────────────────────────────────────────────
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  let cls = 'bg-amber-500/30 text-amber-200 border-amber-400/40';
  if (s === 'healthy' || s === 'connected' || s === 'ok' || s === 'up') cls = 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40';
  else if (s === 'error' || s === 'unhealthy' || s === 'down' || s === 'fail') cls = 'bg-red-500/30 text-red-200 border-red-400/40';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

function HttpBadge({ code }: { code: number | null }) {
  if (!code) return <span className="text-white/40 text-xs">—</span>;
  let cls = 'text-emerald-300';
  if (code >= 400 && code < 500) cls = 'text-amber-300';
  if (code >= 500) cls = 'text-red-300';
  return <span className={`font-mono text-xs font-semibold ${cls}`}>{code}</span>;
}

function Spinner() {
  return <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full mx-auto" />;
}

// ── Tab: System Health ─────────────────────────────────────────────────────
function SystemHealthTab() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/monitoring/system-health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading) return <div className="py-12 text-center"><Spinner /></div>;
  if (error) return <p className="text-red-300 text-sm">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <GlassCard className="flex-1">
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Overall Status</p>
          <StatusBadge status={data.status} />
        </GlassCard>
        <GlassCard className="flex-1">
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Uptime</p>
          <p className="text-white font-semibold">{Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m</p>
        </GlassCard>
        <GlassCard className="flex-1">
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Services</p>
          <p className="text-white font-semibold">{data.services.length}</p>
        </GlassCard>
        <button onClick={() => void load()} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">
          Refresh
        </button>
      </div>
      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              <th className="text-left py-2">Service</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Latency</th>
              <th className="text-left py-2">HTTP</th>
              <th className="text-left py-2">Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {data.services.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-white/40 text-xs">No service data yet. Health check jobs populate this table.</td></tr>
            )}
            {data.services.map((s, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 text-white font-medium">{s.name}</td>
                <td className="py-2"><StatusBadge status={s.status} /></td>
                <td className="py-2 text-white/80 text-xs font-mono">{s.latencyMs != null ? `${s.latencyMs}ms` : '—'}</td>
                <td className="py-2"><HttpBadge code={s.httpStatus} /></td>
                <td className="py-2 text-white/50 text-xs">{new Date(s.lastChecked).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
      <p className="text-white/30 text-xs text-right">Auto-refreshes every 30s</p>
    </div>
  );
}

// ── Tab: API Requests ──────────────────────────────────────────────────────
function ApiRequestsTab() {
  const [data, setData] = useState<ApiRequestsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (statusCode?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (statusCode) params.set('statusCode', statusCode);
      const res = await fetch(`/api/admin/monitoring/api-requests?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const applyFilter = () => load(statusFilter || undefined);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-white/60 text-xs mb-1">Filter by Status Code</label>
          <input
            type="number"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            placeholder="e.g. 500"
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm w-32 placeholder:text-white/30"
          />
        </div>
        <button onClick={applyFilter} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">
          Apply
        </button>
        {statusFilter && (
          <button onClick={() => { setStatusFilter(''); void load(); }} className="px-3 py-1.5 rounded-lg text-white/60 hover:text-white text-sm">
            Clear
          </button>
        )}
      </div>
      {loading ? <div className="py-12 text-center"><Spinner /></div> : error ? (
        <p className="text-red-300 text-sm">{error}</p>
      ) : (
        <GlassCard>
          <p className="text-white/50 text-xs mb-3">Showing {data?.items.length ?? 0} of {data?.total ?? 0} requests</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                  <th className="text-left py-2">Method</th>
                  <th className="text-left py-2">Path</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Duration</th>
                  <th className="text-left py-2">IP</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-white/40 text-xs">No API requests logged yet.</td></tr>
                )}
                {(data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1.5 font-mono text-xs text-purple-300 font-semibold">{r.method}</td>
                    <td className="py-1.5 text-white/80 text-xs max-w-[220px] truncate">{r.path}</td>
                    <td className="py-1.5"><HttpBadge code={r.status_code} /></td>
                    <td className="py-1.5 text-white/60 text-xs font-mono">{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</td>
                    <td className="py-1.5 text-white/40 text-xs font-mono">{r.ip_address ?? '—'}</td>
                    <td className="py-1.5 text-white/40 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ── Tab: Audit Logs ────────────────────────────────────────────────────────
function AuditLogsTab() {
  const [data, setData] = useState<AuditLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/monitoring/audit-logs?pageSize=100', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center"><Spinner /></div>;
  if (error) return <p className="text-red-300 text-sm">{error}</p>;

  const all = [...(data?.items ?? []), ...(data?.supplementary ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <GlassCard>
      <p className="text-white/50 text-xs mb-3">Showing {all.length} audit events</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              <th className="text-left py-2">Event</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Actor</th>
              <th className="text-left py-2">IP</th>
              <th className="text-left py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-white/40 text-xs">No audit events logged yet.</td></tr>
            )}
            {all.map((r, i) => (
              <tr key={`${r.source}-${r.id}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1.5 text-white/90 text-xs">{r.action}</td>
                <td className="py-1.5 text-white/60 text-xs">{r.entity_type}</td>
                <td className="py-1.5 text-white/60 text-xs">{r.user_email ?? r.entity_id ?? '—'}</td>
                <td className="py-1.5 text-white/40 text-xs font-mono">{r.ip_address ?? '—'}</td>
                <td className="py-1.5 text-white/40 text-xs">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ── Tab: Cache & Performance ───────────────────────────────────────────────
function CacheTab() {
  const [data, setData] = useState<CacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cache', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cache status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const clearCache = async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const res = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_tag' }),
      });
      const json = await res.json() as { cleared?: boolean; reason?: string };
      setClearResult(json.cleared ? 'Cache cleared successfully.' : `Not cleared: ${json.reason ?? 'unknown reason'}`);
    } catch {
      setClearResult('Request failed.');
    } finally {
      setClearing(false);
    }
  };

  const tips = [
    { title: 'Add cache: no-store to all admin API fetches', detail: 'Admin data is user-specific and must not be shared across requests.' },
    { title: 'Enable Next.js ISR for public pages', detail: 'Blog, services, and landing pages benefit from incremental static regeneration with revalidate intervals.' },
    { title: 'Connect Redis for distributed tag-based cache invalidation', detail: 'Set REDIS_URL to enable cross-instance cache clearing and session persistence at scale.' },
  ];

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="py-12 text-center"><Spinner /></div>
      ) : error ? (
        <p className="text-red-300 text-sm">{error}</p>
      ) : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <GlassCard>
              <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Redis Status</p>
              <StatusBadge status={data.redis_configured ? 'healthy' : data.redis_url_set ? 'error' : 'not configured'} />
              {data.redis_latency_ms != null && (
                <p className="text-white/60 text-xs mt-2 font-mono">{data.redis_latency_ms}ms ping</p>
              )}
              {!data.redis_url_set && (
                <p className="text-white/40 text-xs mt-2">Set REDIS_URL to enable Redis.</p>
              )}
            </GlassCard>
            <GlassCard>
              <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Next.js Cache</p>
              <StatusBadge status={data.nextjs_cache} />
              <p className="text-white/60 text-xs mt-2">
                <span className="text-emerald-300 font-semibold">{data.routes_with_no_store}</span> routes no-store ·{' '}
                <span className="text-amber-300 font-semibold">{data.routes_with_force_cache}</span> routes force-cache
              </p>
            </GlassCard>
            <GlassCard>
              <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Clear Cache</p>
              <button
                onClick={() => void clearCache()}
                disabled={clearing}
                className="mt-1 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 text-red-200 text-sm font-medium disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Clear Tag Cache'}
              </button>
              {clearResult && (
                <p className={`text-xs mt-2 ${clearResult.startsWith('Cache cleared') ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {clearResult}
                </p>
              )}
            </GlassCard>
          </div>

          <div>
            <h3 className="text-white/80 text-sm font-semibold mb-3">Performance Recommendations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tips.map((tip, i) => (
                <GlassCard key={i}>
                  <p className="text-white font-semibold text-sm mb-1">{tip.title}</p>
                  <p className="text-white/60 text-xs">{tip.detail}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Error Logs ────────────────────────────────────────────────────────
function ErrorLogsTab() {
  const [data, setData] = useState<ErrorLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const load = useCallback(async (level?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      const res = await fetch(`/api/admin/monitoring/errors?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resolveError = async (id: number) => {
    await fetch('/api/admin/monitoring/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    void load(levelFilter || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-white/60 text-xs mb-1">Level</label>
          <select
            value={levelFilter}
            onChange={e => { setLevelFilter(e.target.value); void load(e.target.value || undefined); }}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All levels</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
        </div>
        <button onClick={() => void load(levelFilter || undefined)} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">
          Refresh
        </button>
      </div>
      {loading ? <div className="py-12 text-center"><Spinner /></div> : error ? (
        <p className="text-red-300 text-sm">{error}</p>
      ) : (
        <GlassCard>
          <p className="text-white/50 text-xs mb-3">Showing {data?.items.length ?? 0} of {data?.total ?? 0} logs</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                  <th className="text-left py-2">Level</th>
                  <th className="text-left py-2">Message</th>
                  <th className="text-left py-2">Route</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-white/40 text-xs">No error logs yet.</td></tr>
                )}
                {(data?.items ?? []).map((r) => (
                  <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 ${r.resolved ? 'opacity-50' : ''}`}>
                    <td className="py-1.5">
                      <span className={`text-xs font-semibold ${r.level === 'error' ? 'text-red-300' : r.level === 'warn' ? 'text-amber-300' : 'text-blue-300'}`}>
                        {r.level}
                      </span>
                    </td>
                    <td className="py-1.5 text-white/80 text-xs max-w-[240px] truncate">{r.message}</td>
                    <td className="py-1.5 text-white/50 text-xs font-mono">{r.route ?? '—'}</td>
                    <td className="py-1.5">
                      {r.resolved
                        ? <span className="text-emerald-300 text-xs">resolved</span>
                        : <span className="text-red-300/80 text-xs">open</span>}
                    </td>
                    <td className="py-1.5 text-white/40 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1.5">
                      {!r.resolved && (
                        <button
                          onClick={() => void resolveError(r.id)}
                          className="text-xs text-white/50 hover:text-white underline"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ── Tab: Job Monitor ──────────────────────────────────────────────────────
interface JobMonitorJob {
  id: number;
  job_name: string;
  status: string;
  fail_count: number;
  run_count: number;
  latest_run_status: string | null;
  latest_started_at: string | null;
}

interface JobMonitorLog {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  duration_ms: number | null;
  triggered_by: string;
  error_message: string | null;
}

function JobMonitorTab() {
  const [jobs, setJobs] = useState<JobMonitorJob[]>([]);
  const [logs, setLogs] = useState<JobMonitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [jobsRes, logsRes] = await Promise.all([
      fetch('/api/admin/job-scheduler', { cache: 'no-store' }).then(r => r.ok ? r.json() : { jobs: [] }),
      fetch('/api/admin/job-scheduler/logs', { cache: 'no-store' }).then(r => r.ok ? r.json() : { logs: [] }),
    ]).catch(() => [{ jobs: [] }, { logs: [] }]);
    setJobs((jobsRes as { jobs: JobMonitorJob[] }).jobs ?? []);
    setLogs((logsRes as { logs: JobMonitorLog[] }).logs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 15_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading) return <div className="py-12 text-center"><Spinner /></div>;

  const oneDayAgo = Date.now() - 86400000;
  const runningNow = logs.filter(l => l.status === 'running');
  const recentFails = logs.filter(l => l.status === 'failed' && new Date(l.started_at).getTime() > oneDayAgo);
  const totalRuns = logs.length;
  const successRuns = logs.filter(l => l.status === 'success').length;
  const healthScore = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100;

  return (
    <div className="space-y-4">
      <p className="text-white/30 text-xs text-right">Auto-refreshes every 15s</p>
      <div className="grid grid-cols-3 gap-4">
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Running Now</p>
          <p className="text-blue-300 text-2xl font-bold">{runningNow.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Failures (24h)</p>
          <p className={`text-2xl font-bold ${recentFails.length > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{recentFails.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Job Health Score</p>
          <p className={`text-2xl font-bold ${healthScore < 80 ? 'text-red-300' : healthScore < 95 ? 'text-amber-300' : 'text-emerald-300'}`}>{healthScore}%</p>
        </GlassCard>
      </div>
      {runningNow.length > 0 && (
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-2">Currently Running</h3>
          {runningNow.map(l => (
            <div key={l.id} className="flex justify-between text-xs py-1 border-b border-white/5">
              <span className="text-white/90">{l.job_name}</span>
              <span className="text-blue-300">running • {l.triggered_by}</span>
            </div>
          ))}
        </GlassCard>
      )}
      {recentFails.length > 0 && (
        <GlassCard>
          <h3 className="text-red-300 text-sm font-semibold mb-2">Recent Failures (24h)</h3>
          {recentFails.slice(0, 10).map(l => (
            <div key={l.id} className="py-1 border-b border-white/5">
              <div className="flex justify-between text-xs">
                <span className="text-white/90">{l.job_name}</span>
                <span className="text-white/50">{new Date(l.started_at).toLocaleString()}</span>
              </div>
              {l.error_message && <p className="text-red-300/70 text-xs mt-0.5 truncate">{l.error_message.slice(0, 100)}</p>}
            </div>
          ))}
        </GlassCard>
      )}
      <GlassCard>
        <h3 className="text-white/80 text-sm font-semibold mb-2">Jobs Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {jobs.slice(0, 8).map(j => (
            <div key={j.id} className="p-2 bg-white/5 rounded-xl">
              <p className="text-white/90 text-xs font-medium truncate">{j.job_name}</p>
              <StatusBadge status={j.latest_run_status ?? j.status} />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ── Tab: Session Monitor ───────────────────────────────────────────────────
interface SessionMonitorData {
  sessions: Array<{
    user_email: string | null;
    user_role: string;
    ip_address: string | null;
    country: string | null;
    created_at: string;
    is_active: boolean;
  }>;
  stats: { active_sessions: number; active_tokens: number };
}

function SessionMonitorTab() {
  const [data, setData] = useState<SessionMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    fetch('/api/admin/sessions', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: SessionMonitorData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 15_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading) return <div className="py-12 text-center"><Spinner /></div>;
  if (!data) return <p className="text-white/50 text-sm">No session data available.</p>;

  const sessions = data.sessions ?? [];

  // By role
  const roleCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.user_role] = (acc[s.user_role] ?? 0) + 1;
    return acc;
  }, {});

  // New sessions last hour
  const oneHourAgo = Date.now() - 3600000;
  const newLastHour = sessions.filter(s => new Date(s.created_at).getTime() > oneHourAgo).length;

  // Country counts
  const countryCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const c = s.country ?? 'unknown';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  // Suspicious: same user >3 IPs
  const ipsByEmail = sessions.reduce<Record<string, Set<string>>>((acc, s) => {
    if (s.user_email && s.ip_address) {
      if (!acc[s.user_email]) acc[s.user_email] = new Set();
      acc[s.user_email].add(s.ip_address);
    }
    return acc;
  }, {});
  const suspicious = Object.entries(ipsByEmail).filter(([, ips]) => ips.size > 3);

  return (
    <div className="space-y-4">
      <p className="text-white/30 text-xs text-right">Auto-refreshes every 15s</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Active Sessions</p>
          <p className="text-white text-2xl font-bold">{data.stats.active_sessions}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">New (1h)</p>
          <p className="text-blue-300 text-2xl font-bold">{newLastHour}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Suspicious</p>
          <p className={`text-2xl font-bold ${suspicious.length > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{suspicious.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Countries</p>
          <p className="text-white text-2xl font-bold">{Object.keys(countryCounts).length}</p>
        </GlassCard>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Sessions by Role</h3>
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="flex justify-between text-xs py-1 border-b border-white/5">
              <span className="text-white/80">{role}</span>
              <span className="text-white/60">{count}</span>
            </div>
          ))}
          {Object.keys(roleCounts).length === 0 && <p className="text-white/40 text-xs">No sessions.</p>}
        </GlassCard>
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Geographic Distribution</h3>
          {Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => (
            <div key={country} className="flex justify-between text-xs py-1 border-b border-white/5">
              <span className="text-white/80">{country}</span>
              <span className="text-white/60">{count}</span>
            </div>
          ))}
          {Object.keys(countryCounts).length === 0 && <p className="text-white/40 text-xs">No sessions.</p>}
        </GlassCard>
      </div>
      {suspicious.length > 0 && (
        <GlassCard>
          <h3 className="text-red-300 font-semibold mb-2">Suspicious Activity Alerts</h3>
          {suspicious.map(([email, ips]) => (
            <div key={email} className="p-2 bg-red-500/10 border border-red-400/30 rounded-lg mb-2">
              <p className="text-red-200 text-xs font-semibold">{email}</p>
              <p className="text-white/60 text-xs">{ips.size} IPs: {Array.from(ips).join(', ')}</p>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'system', label: 'System Health' },
  { id: 'api', label: 'API Requests' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'cache', label: 'Cache & Performance' },
  { id: 'errors', label: 'Error Logs' },
  { id: 'jobs', label: 'Job Monitor' },
  { id: 'sessions', label: 'Session Monitor' },
];

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabId>('system');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring &amp; Observability</h1>
          <p className="text-white/60 text-sm mt-1">System health, API traffic, audit trail, cache, and error tracking.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'system' && <SystemHealthTab />}
          {activeTab === 'api' && <ApiRequestsTab />}
          {activeTab === 'audit' && <AuditLogsTab />}
          {activeTab === 'cache' && <CacheTab />}
          {activeTab === 'errors' && <ErrorLogsTab />}
          {activeTab === 'jobs' && <JobMonitorTab />}
          {activeTab === 'sessions' && <SessionMonitorTab />}
        </div>
      </div>
    </div>
  );
}
