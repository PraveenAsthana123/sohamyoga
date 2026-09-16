'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type TabId = 'all-jobs' | 'run-now' | 'run-log' | 'job-security' | 'health';

interface Job {
  id: number;
  job_name: string;
  job_class: string | null;
  cron_expression: string | null;
  description: string | null;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status: string | null;
  last_run_duration_ms: number | null;
  last_error: string | null;
  run_count: number;
  fail_count: number;
  avg_duration_ms: number | null;
  timeout_ms: number;
  max_retries: number;
  security_level: string;
  allowed_roles: string[];
  created_at: string;
  latest_started_at: string | null;
  latest_run_status: string | null;
  latest_duration_ms: number | null;
}

interface RunLog {
  id: number;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  records_processed: number;
  triggered_by: string;
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  let cls = 'bg-amber-500/30 text-amber-200 border-amber-400/40';
  if (s === 'success' || s === 'active') cls = 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40';
  else if (s === 'failed' || s === 'timeout') cls = 'bg-red-500/30 text-red-200 border-red-400/40';
  else if (s === 'running') cls = 'bg-blue-500/30 text-blue-200 border-blue-400/40';
  else if (s === 'paused') cls = 'bg-gray-500/30 text-gray-200 border-gray-400/40';
  else if (s === 'disabled') cls = 'bg-red-900/30 text-red-300 border-red-900/40';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{status}</span>;
}

function SecurityBadge({ level }: { level: string }) {
  let cls = 'bg-blue-500/30 text-blue-200 border-blue-400/40';
  if (level === 'trusted') cls = 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40';
  else if (level === 'admin-only') cls = 'bg-red-500/30 text-red-200 border-red-400/40';
  else if (level === 'untrusted') cls = 'bg-amber-500/30 text-amber-200 border-amber-400/40';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{level}</span>;
}

function TriggerBadge({ type }: { type: string }) {
  const cls = type === 'manual' ? 'bg-purple-500/30 text-purple-200 border-purple-400/40'
    : type === 'cron' ? 'bg-blue-500/30 text-blue-200 border-blue-400/40'
    : 'bg-amber-500/30 text-amber-200 border-amber-400/40';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{type}</span>;
}

// ── Edit Modal ─────────────────────────────────────────────────────────────
function EditModal({ job, onClose, onSave }: { job: Job; onClose: () => void; onSave: () => void }) {
  const [cron, setCron] = useState(job.cron_expression ?? '');
  const [timeout, setTimeout_] = useState(String(job.timeout_ms));
  const [retries, setRetries] = useState(String(job.max_retries));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/job-scheduler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_name: job.job_name,
        cron_expression: cron,
        timeout_ms: parseInt(timeout, 10),
        max_retries: parseInt(retries, 10),
      }),
    });
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <GlassCard className="max-w-md w-full">
        <h3 className="text-white font-semibold mb-4">Edit: {job.job_name}</h3>
        <div className="space-y-3">
          {[
            { label: 'Cron Expression', value: cron, set: setCron },
            { label: 'Timeout (ms)', value: timeout, set: setTimeout_ },
            { label: 'Max Retries', value: retries, set: setRetries },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-white/60 text-xs mb-1">{f.label}</label>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => void save()} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">Cancel</button>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Tab: All Jobs ──────────────────────────────────────────────────────────
function AllJobsTab({ jobs, onRefresh }: { jobs: Job[]; onRefresh: () => void }) {
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const toggleStatus = async (job: Job) => {
    const next = job.status === 'active' ? 'paused' : 'active';
    await fetch('/api/admin/job-scheduler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_name: job.job_name, status: next }),
    });
    onRefresh();
  };

  const runNow = async (job: Job) => {
    setRunning(job.job_name);
    await fetch('/api/admin/job-scheduler/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_name: job.job_name }),
    });
    setRunning(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {editJob && <EditModal job={editJob} onClose={() => setEditJob(null)} onSave={onRefresh} />}
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                <th className="text-left py-2">Job Name</th>
                <th className="text-left py-2">Cron</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Last Run</th>
                <th className="text-left py-2">Last Status</th>
                <th className="text-left py-2">Duration</th>
                <th className="text-left py-2">Fails</th>
                <th className="text-left py-2">Security</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-white/40 text-xs">No jobs found.</td></tr>
              )}
              {jobs.map(j => (
                <tr key={j.id} className={`border-b border-white/5 hover:bg-white/5 ${j.fail_count > 3 ? 'bg-red-900/10' : ''}`}>
                  <td className="py-2 text-white font-medium text-xs">{j.job_name}</td>
                  <td className="py-2 text-white/60 text-xs font-mono">{j.cron_expression ?? '—'}</td>
                  <td className="py-2"><StatusBadge status={j.status} /></td>
                  <td className="py-2 text-white/50 text-xs">{j.latest_started_at ? new Date(j.latest_started_at).toLocaleString() : '—'}</td>
                  <td className="py-2">{j.latest_run_status ? <StatusBadge status={j.latest_run_status} /> : <span className="text-white/30 text-xs">—</span>}</td>
                  <td className="py-2 text-white/50 text-xs font-mono">{j.latest_duration_ms != null ? `${j.latest_duration_ms}ms` : '—'}</td>
                  <td className={`py-2 text-xs font-bold ${j.fail_count > 3 ? 'text-red-300' : 'text-white/60'}`}>{j.fail_count}</td>
                  <td className="py-2"><SecurityBadge level={j.security_level} /></td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => void toggleStatus(j)}
                        className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80"
                      >
                        {j.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => void runNow(j)}
                        disabled={running === j.job_name}
                        className="text-xs px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 disabled:opacity-50"
                      >
                        {running === j.job_name ? '…' : 'Run'}
                      </button>
                      <button
                        onClick={() => setEditJob(j)}
                        className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Tab: Run Now ───────────────────────────────────────────────────────────
function RunNowTab({ jobs }: { jobs: Job[] }) {
  const [selectedJob, setSelectedJob] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunLog[]>([]);

  const loadRecent = useCallback(async (jobName: string) => {
    if (!jobName) return;
    const res = await fetch(`/api/admin/job-scheduler/logs?job_name=${encodeURIComponent(jobName)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as { logs: RunLog[] };
      setRecentRuns((data.logs ?? []).slice(0, 5));
    }
  }, []);

  useEffect(() => { void loadRecent(selectedJob); }, [selectedJob, loadRecent]);

  const run = async () => {
    if (!selectedJob) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/job-scheduler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_name: selectedJob }),
      });
      const data = await res.json() as { run_id?: number };
      setResult(`Triggered. Run ID: ${data.run_id ?? '—'}`);
      void loadRecent(selectedJob);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="max-w-md">
        <h3 className="text-white font-semibold mb-3">Run Job Manually</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-white/60 text-xs mb-1">Select Job</label>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">— Choose a job —</option>
              {jobs.map(j => (
                <option key={j.job_name} value={j.job_name}>{j.job_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void run()}
            disabled={!selectedJob || running}
            className="w-full px-4 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-semibold disabled:opacity-50"
          >
            {running ? 'Triggering…' : 'Run Now'}
          </button>
          {result && <p className="text-emerald-300 text-sm">{result}</p>}
        </div>
      </GlassCard>

      {selectedJob && (
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Last 5 Runs for {selectedJob}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                <th className="text-left py-1">Started</th>
                <th className="text-left py-1">Status</th>
                <th className="text-left py-1">Duration</th>
                <th className="text-left py-1">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-white/40 text-xs">No runs yet.</td></tr>
              )}
              {recentRuns.map(r => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-1 text-white/60 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="py-1"><StatusBadge status={r.status} /></td>
                  <td className="py-1 text-white/50 text-xs font-mono">{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</td>
                  <td className="py-1"><TriggerBadge type={r.triggered_by} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}

// ── Tab: Run Log ───────────────────────────────────────────────────────────
function RunLogTab() {
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (jobFilter) params.set('job_name', jobFilter);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const res = await fetch(`/api/admin/job-scheduler/logs?${params}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { logs: RunLog[] };
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [jobFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-white/60 text-xs mb-1">Job Name</label>
          <input
            value={jobFilter}
            onChange={e => setJobFilter(e.target.value)}
            placeholder="Filter by job…"
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm w-48 placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="block text-white/60 text-xs mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All</option>
            {['running', 'success', 'failed', 'timeout', 'cancelled'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button onClick={() => void load()} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Refresh</button>
      </div>
      {loading ? (
        <div className="py-8 text-center"><Spinner /></div>
      ) : (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                  <th className="text-left py-2">Job</th>
                  <th className="text-left py-2">Trigger</th>
                  <th className="text-left py-2">Started</th>
                  <th className="text-left py-2">Duration</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Records</th>
                  <th className="text-left py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-white/40 text-xs">No run logs yet.</td></tr>
                )}
                {logs.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1.5 text-white/90 text-xs font-medium">{r.job_name}</td>
                    <td className="py-1.5"><TriggerBadge type={r.triggered_by} /></td>
                    <td className="py-1.5 text-white/50 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="py-1.5 text-white/50 text-xs font-mono">{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</td>
                    <td className="py-1.5"><StatusBadge status={r.status} /></td>
                    <td className="py-1.5 text-white/50 text-xs">{r.records_processed}</td>
                    <td className="py-1.5 text-red-300 text-xs max-w-[200px] truncate" title={r.error_message ?? undefined}>
                      {r.error_message ? r.error_message.slice(0, 80) : '—'}
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

// ── Tab: Job Security ──────────────────────────────────────────────────────
function JobSecurityTab({ jobs }: { jobs: Job[] }) {
  const adminOnly = jobs.filter(j => j.security_level === 'admin-only').length;
  const internal = jobs.filter(j => j.security_level === 'internal').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Admin-Only Jobs</p>
          <p className="text-red-300 text-2xl font-bold">{adminOnly}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Internal Jobs</p>
          <p className="text-blue-300 text-2xl font-bold">{internal}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Total Jobs</p>
          <p className="text-white text-2xl font-bold">{jobs.length}</p>
        </GlassCard>
      </div>
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                <th className="text-left py-2">Job Name</th>
                <th className="text-left py-2">Security Level</th>
                <th className="text-left py-2">Allowed Roles</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white/90 text-xs font-medium">
                    {j.security_level === 'admin-only' && <span className="mr-1">🔒</span>}
                    {j.job_name}
                  </td>
                  <td className="py-2"><SecurityBadge level={j.security_level} /></td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      {(j.allowed_roles ?? []).map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-white/10 text-white/70 text-xs rounded">{r}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Tab: Health Overview ───────────────────────────────────────────────────
function HealthOverviewTab({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter(j => j.status === 'active').length;
  const paused = jobs.filter(j => j.status === 'paused').length;
  const highFail = jobs.filter(j => j.fail_count > 3);

  const maxRun = Math.max(1, ...jobs.map(j => j.run_count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'text-white' },
          { label: 'Active', value: active, color: 'text-emerald-300' },
          { label: 'Paused', value: paused, color: 'text-amber-300' },
          { label: 'High Fail Count', value: highFail.length, color: 'text-red-300' },
        ].map(c => (
          <GlassCard key={c.label}>
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <h3 className="text-white/80 text-sm font-semibold mb-3">Run Count by Job</h3>
        <div className="space-y-2">
          {jobs.sort((a, b) => b.run_count - a.run_count).map(j => (
            <div key={j.id}>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>{j.job_name}</span><span>{j.run_count}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${j.fail_count > 3 ? 'bg-red-400/60' : 'bg-blue-400/60'}`}
                  style={{ width: `${(j.run_count / maxRun) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {highFail.length > 0 && (
        <GlassCard>
          <h3 className="text-red-300 font-semibold mb-3">Jobs with High Fail Count (&gt;3)</h3>
          <div className="space-y-2">
            {highFail.map(j => (
              <div key={j.id} className="p-3 bg-red-500/10 border border-red-400/30 rounded-xl">
                <p className="text-red-200 text-sm font-semibold">{j.job_name}</p>
                <p className="text-white/60 text-xs mt-1">Fail count: {j.fail_count} | Last error: {j.last_error ?? '—'}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'all-jobs', label: 'All Jobs' },
  { id: 'run-now', label: 'Run Now' },
  { id: 'run-log', label: 'Run Log' },
  { id: 'job-security', label: 'Job Security' },
  { id: 'health', label: 'Health Overview' },
];

export default function JobSchedulerPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all-jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/job-scheduler', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { jobs: Job[] };
        setJobs(data.jobs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Scheduler</h1>
          <p className="text-white/60 text-sm mt-1">Monitor, manage and trigger scheduled jobs.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {loading && activeTab === 'all-jobs' ? (
            <div className="py-12 text-center"><Spinner /></div>
          ) : (
            <>
              {activeTab === 'all-jobs' && <AllJobsTab jobs={jobs} onRefresh={load} />}
              {activeTab === 'run-now' && <RunNowTab jobs={jobs} />}
              {activeTab === 'run-log' && <RunLogTab />}
              {activeTab === 'job-security' && <JobSecurityTab jobs={jobs} />}
              {activeTab === 'health' && <HealthOverviewTab jobs={jobs} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
