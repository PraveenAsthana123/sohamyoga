'use client';

import { useEffect, useState, useCallback } from 'react';

const TABS = ['Team Dashboard', 'Task Board', 'Metrics Tracker', 'Add Task', 'Process-Productivity Link', 'Efficiency Analysis'] as const;
type Tab = typeof TABS[number];

const TEAMS = ['marketing', 'sales', 'content', 'tech', 'operations', 'customer_success'];
const TEAM_LABELS: Record<string, string> = {
  marketing: 'Marketing', sales: 'Sales', content: 'Content',
  tech: 'Technology', operations: 'Operations', customer_success: 'Customer Success',
};
const STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const;
type TaskStatus = typeof STATUSES[number];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done', blocked: 'Blocked',
};
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
type Priority = typeof PRIORITIES[number];
const PRIORITY_ICONS: Record<Priority, string> = {
  low: '🟢', medium: '🟡', high: '🟠', critical: '🔴',
};

interface Task {
  id: number;
  title: string;
  assigned_to: string | null;
  team: string | null;
  related_process: string | null;
  priority: Priority;
  status: TaskStatus;
  estimated_hours: number | null;
  actual_hours: number | null;
  due_date: string | null;
  completed_at: string | null;
  tags: string[] | null;
  created_at: string;
}

interface Metric {
  id: number;
  team: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_value: number | null;
  achievement_pct: number | null;
  notes: string | null;
}

interface TeamSummary {
  team: string;
  completed_tasks: number;
  avg_achievement_pct: number | null;
  on_time_rate: number | null;
}

interface ProductivityData {
  metrics: Metric[];
  tasks: Task[];
  teamSummary: TeamSummary[];
}

const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const glassCard = 'bg-slate-800/70 border border-white/20 rounded-xl p-4 shadow-lg';

function TeamDashboardTab({ data }: { data: ProductivityData | null }) {
  if (!data) return <p className="text-white/40 text-sm">Loading…</p>;

  const summaryMap: Record<string, TeamSummary> = {};
  for (const ts of data.teamSummary) {
    summaryMap[ts.team] = ts;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TEAMS.map(team => {
        const ts = summaryMap[team];
        const achievementPct = ts?.avg_achievement_pct ?? 0;
        const completedTasks = ts?.completed_tasks ?? 0;
        const onTimeRate = ts?.on_time_rate ?? 0;

        const thisWeekTasks = data.tasks.filter(t =>
          t.team === team && t.status === 'done' &&
          t.completed_at && new Date(t.completed_at) >= new Date(Date.now() - 7 * 86400000)
        ).length;

        const trend = achievementPct >= 80 ? '↑' : achievementPct >= 50 ? '→' : '↓';
        const trendColor = achievementPct >= 80 ? 'text-green-300' : achievementPct >= 50 ? 'text-yellow-300' : 'text-red-300';

        return (
          <div key={team} className={glassCard}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{TEAM_LABELS[team]}</h3>
              <span className={`text-xl font-bold ${trendColor}`}>{trend}</span>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Avg Achievement</span>
                <span>{achievementPct ? `${Number(achievementPct).toFixed(0)}%` : 'N/A'}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full">
                <div
                  className={`h-2 rounded-full ${achievementPct >= 80 ? 'bg-green-400' : achievementPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(Number(achievementPct), 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-white font-bold text-lg">{completedTasks}</p>
                <p className="text-white/50 text-xs">Total Done</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">{thisWeekTasks}</p>
                <p className="text-white/50 text-xs">This Week</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">{onTimeRate ? `${Number(onTimeRate).toFixed(0)}%` : '—'}</p>
                <p className="text-white/50 text-xs">On Time</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskBoardTab({ tasks, onStatusChange }: { tasks: Task[]; onStatusChange: (id: number, status: TaskStatus) => Promise<void> }) {
  const [moving, setMoving] = useState<number | null>(null);

  const handleMove = async (task: Task, newStatus: TaskStatus) => {
    setMoving(task.id);
    await onStatusChange(task.id, newStatus);
    setMoving(null);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-2">
        {STATUSES.map(col => {
          const colTasks = tasks.filter(t => t.status === col);
          return (
            <div key={col} className="w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">{STATUS_LABELS[col]}</h3>
                <span className="text-white/50 text-xs bg-white/10 rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="space-y-3">
                {colTasks.map(task => (
                  <div key={task.id} className={`${glassCard} p-3 space-y-2`}>
                    <p className="text-white text-sm font-medium leading-snug">{task.title}</p>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-xs">{PRIORITY_ICONS[task.priority]}</span>
                      <span className="text-xs text-white/50">{task.priority}</span>
                      {task.team && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded-full px-1.5 py-0.5">{TEAM_LABELS[task.team] ?? task.team}</span>
                      )}
                    </div>
                    {task.assigned_to && <p className="text-white/50 text-xs">👤 {task.assigned_to}</p>}
                    <div className="flex gap-2 text-xs text-white/40">
                      {task.estimated_hours && <span>⏱ {task.estimated_hours}h est</span>}
                      {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                    {/* Move dropdown */}
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                      value={col}
                      disabled={moving === task.id}
                      onChange={e => handleMove(task, e.target.value as TaskStatus)}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{moving === task.id && s === col ? 'Moving…' : STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="border border-dashed border-white/10 rounded-xl p-4 text-center text-white/20 text-xs">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricsTrackerTab({ metrics, onRefresh }: { metrics: Metric[]; onRefresh: () => void }) {
  const [form, setForm] = useState({
    team: 'marketing', metric_name: '', metric_value: '', target_value: '',
    metric_unit: 'count', period_type: 'weekly',
    period_start: '', period_end: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metric', ...form, metric_value: Number(form.metric_value), target_value: form.target_value ? Number(form.target_value) : undefined }),
      });
      const d = await r.json();
      if (r.ok) { setMsg('Metric added!'); onRefresh(); }
      else setMsg(d.error ?? 'Failed');
    } catch { setMsg('Network error'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30';
  const labelCls = 'block text-white/60 text-xs mb-1';

  // Achievement chart data per team
  const teamAchievements = TEAMS.map(team => {
    const teamMetrics = metrics.filter(m => m.team === team && m.achievement_pct !== null);
    const avg = teamMetrics.length ? teamMetrics.reduce((s, m) => s + Number(m.achievement_pct), 0) / teamMetrics.length : 0;
    return { team, avg };
  });

  return (
    <div className="space-y-6">
      {/* Achievement chart */}
      <div className={glassCard}>
        <h3 className="text-white font-semibold mb-4">Achievement % by Team</h3>
        <div className="space-y-2">
          {teamAchievements.map(({ team, avg }) => (
            <div key={team}>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{TEAM_LABELS[team]}</span>
                <span>{avg.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full">
                <div
                  className={`h-3 rounded-full ${avg >= 80 ? 'bg-green-400' : avg >= 50 ? 'bg-yellow-400' : avg > 0 ? 'bg-red-400' : 'bg-white/10'}`}
                  style={{ width: `${Math.min(avg, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-white/80">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              {['Team', 'Metric', 'Value', 'Unit', 'Target', 'Achievement', 'Period', 'Notes'].map(h => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {metrics.slice(0, 50).map(m => (
              <tr key={m.id} className="hover:bg-white/5">
                <td className="px-3 py-2">
                  <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded-full px-2 py-0.5">{TEAM_LABELS[m.team] ?? m.team}</span>
                </td>
                <td className="px-3 py-2 text-white font-medium">{m.metric_name}</td>
                <td className="px-3 py-2">{m.metric_value}</td>
                <td className="px-3 py-2 text-white/50">{m.metric_unit}</td>
                <td className="px-3 py-2 text-white/60">{m.target_value ?? '—'}</td>
                <td className="px-3 py-2">
                  {m.achievement_pct ? (
                    <span className={`text-sm font-medium ${Number(m.achievement_pct) >= 100 ? 'text-green-300' : Number(m.achievement_pct) >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                      {Number(m.achievement_pct).toFixed(0)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-white/50 text-xs">{m.period_start} – {m.period_end}</td>
                <td className="px-3 py-2 text-white/40 text-xs">{m.notes ?? '—'}</td>
              </tr>
            ))}
            {!metrics.length && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-white/30">No metrics recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add metric form */}
      <div className={glassCard}>
        <h3 className="text-white font-semibold mb-4">Add Metric Snapshot</h3>
        {msg && (
          <div className={`rounded-xl p-3 text-sm mb-4 ${msg.includes('added') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{msg}</div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Team *</label>
            <select className={inputCls} value={form.team} onChange={e => set('team', e.target.value)}>
              {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Metric Name *</label>
            <input required className={inputCls} value={form.metric_name} onChange={e => set('metric_name', e.target.value)} placeholder="e.g. tasks_completed" />
          </div>
          <div>
            <label className={labelCls}>Value *</label>
            <input required type="number" step="0.01" className={inputCls} value={form.metric_value} onChange={e => set('metric_value', e.target.value)} placeholder="42" />
          </div>
          <div>
            <label className={labelCls}>Target Value</label>
            <input type="number" step="0.01" className={inputCls} value={form.target_value} onChange={e => set('target_value', e.target.value)} placeholder="50" />
          </div>
          <div>
            <label className={labelCls}>Unit</label>
            <select className={inputCls} value={form.metric_unit} onChange={e => set('metric_unit', e.target.value)}>
              {['count', '%', 'hours', 'score'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Period Type</label>
            <select className={inputCls} value={form.period_type} onChange={e => set('period_type', e.target.value)}>
              {['daily', 'weekly', 'monthly'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Period Start *</label>
            <input required type="date" className={inputCls} value={form.period_start} onChange={e => set('period_start', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Period End *</label>
            <input required type="date" className={inputCls} value={form.period_end} onChange={e => set('period_end', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional context" />
          </div>
          <div className="col-span-full">
            <button type="submit" disabled={saving} className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add Metric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddTaskTab({ onRefresh }: { onRefresh: () => void }) {
  const [form, setForm] = useState({
    title: '', assigned_to: '', team: 'marketing', related_process: '',
    priority: 'medium', estimated_hours: '', due_date: '', tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        type: 'task',
        ...form,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
        due_date: form.due_date || undefined,
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      };
      const r = await fetch('/api/admin/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg('Task created!');
        setForm({ title: '', assigned_to: '', team: 'marketing', related_process: '', priority: 'medium', estimated_hours: '', due_date: '', tags: '' });
        onRefresh();
      } else setMsg(d.error ?? 'Failed');
    } catch { setMsg('Network error'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30';
  const labelCls = 'block text-white/60 text-xs mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {msg && (
        <div className={`rounded-xl p-3 text-sm ${msg.includes('created') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{msg}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Task Title *</label>
          <input required className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Publish Q4 content calendar" />
        </div>
        <div>
          <label className={labelCls}>Assigned To</label>
          <input className={inputCls} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="e.g. Jane Smith" />
        </div>
        <div>
          <label className={labelCls}>Team</label>
          <select className={inputCls} value={form.team} onChange={e => set('team', e.target.value)}>
            {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Related Process Code</label>
          <input className={inputCls} value={form.related_process} onChange={e => set('related_process', e.target.value)} placeholder="e.g. MKT-003" />
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select className={inputCls} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_ICONS[p]} {p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Estimated Hours</label>
          <input type="number" step="0.5" className={inputCls} value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} placeholder="e.g. 4" />
        </div>
        <div>
          <label className={labelCls}>Due Date</label>
          <input type="datetime-local" className={inputCls} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Tags (comma-separated)</label>
          <input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. Q4, social, urgent" />
        </div>
      </div>
      <button type="submit" disabled={saving} className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors">
        {saving ? 'Creating…' : 'Create Task'}
      </button>
    </form>
  );
}

function ProcessProductivityLinkTab({ tasks }: { tasks: Task[] }) {
  // Group tasks that have a related_process by team/department
  const withProcess = tasks.filter(t => t.related_process);

  const processCodes = Array.from(new Set(withProcess.map(t => t.related_process!)));
  const byCode = processCodes.map(code => ({
    code,
    count: withProcess.filter(t => t.related_process === code).length,
    tasks: withProcess.filter(t => t.related_process === code),
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <p className="text-white/60 text-sm">Tasks linked to business processes via process code. Use process codes like MKT-001 when creating tasks.</p>

      {byCode.length === 0 && (
        <div className="border border-dashed border-white/20 rounded-xl p-8 text-center text-white/30">
          No tasks linked to process codes yet. Add tasks with a related process code to see the link.
        </div>
      )}

      {byCode.map(({ code, count, tasks: linkedTasks }) => (
        <div key={code} className={glassCard}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-mono text-white font-bold">{code}</span>
              <span className="ml-2 text-white/50 text-sm">{count} task{count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2">
              {STATUSES.map(s => {
                const c = linkedTasks.filter(t => t.status === s).length;
                return c > 0 ? (
                  <span key={s} className="text-xs bg-white/10 text-white/60 rounded-full px-2 py-0.5">{STATUS_LABELS[s]}: {c}</span>
                ) : null;
              })}
            </div>
          </div>
          <div className="space-y-1">
            {linkedTasks.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs">{PRIORITY_ICONS[t.priority]}</span>
                <span className="text-white/80">{t.title}</span>
                {t.team && <span className="text-white/40 text-xs ml-auto">{TEAM_LABELS[t.team] ?? t.team}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  t.status === 'done' ? 'bg-green-500/20 text-green-300' :
                  t.status === 'blocked' ? 'bg-red-500/20 text-red-300' :
                  'bg-white/10 text-white/50'
                }`}>{STATUS_LABELS[t.status]}</span>
              </div>
            ))}
            {linkedTasks.length > 5 && <p className="text-white/30 text-xs">+ {linkedTasks.length - 5} more</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EfficiencyAnalysisTab({ tasks }: { tasks: Task[] }) {
  // Hour ratio per team
  const teamEfficiency = TEAMS.map(team => {
    const doneTasks = tasks.filter(t => t.team === team && t.status === 'done' && t.estimated_hours && t.actual_hours);
    const totalEst = doneTasks.reduce((s, t) => s + Number(t.estimated_hours), 0);
    const totalActual = doneTasks.reduce((s, t) => s + Number(t.actual_hours), 0);
    const ratio = totalEst > 0 ? totalActual / totalEst : null;
    return { team, totalEst, totalActual, ratio, count: doneTasks.length };
  });

  // Blocked tasks by team
  const blockedByTeam = TEAMS.map(team => ({
    team,
    blocked: tasks.filter(t => t.team === team && t.status === 'blocked').length,
  }));

  // Velocity: tasks completed per week over last 8 weeks
  const now = Date.now();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now - (7 - i) * 7 * 86400000);
    const weekEnd = new Date(now - (6 - i) * 7 * 86400000);
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = tasks.filter(t =>
      t.status === 'done' && t.completed_at &&
      new Date(t.completed_at) >= weekStart && new Date(t.completed_at) < weekEnd
    ).length;
    return { label, count };
  });

  const maxVelocity = Math.max(...weeks.map(w => w.count), 1);

  return (
    <div className="space-y-6">
      {/* Velocity chart */}
      <div className={glassCard}>
        <h3 className="text-white font-semibold mb-4">Task Completion Velocity (Last 8 Weeks)</h3>
        <div className="flex items-end gap-2 h-32">
          {weeks.map(({ label, count }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-white/60 text-xs">{count}</span>
              <div className="w-full rounded-t-sm bg-blue-400/60" style={{ height: `${(count / maxVelocity) * 80}px`, minHeight: count > 0 ? '4px' : '0' }} />
              <span className="text-white/30 text-xs rotate-45 origin-bottom-left">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hour ratio */}
      <div className={glassCard}>
        <h3 className="text-white font-semibold mb-4">Actual vs Estimated Hours (Done Tasks)</h3>
        <div className="space-y-3">
          {teamEfficiency.map(({ team, ratio, totalEst, totalActual, count }) => (
            <div key={team}>
              <div className="flex justify-between text-sm text-white/70 mb-1">
                <span>{TEAM_LABELS[team]}</span>
                <span className="text-xs text-white/50">
                  {count > 0
                    ? `${totalActual.toFixed(1)}h actual / ${totalEst.toFixed(1)}h est — ratio: ${ratio?.toFixed(2) ?? '—'}`
                    : 'No done tasks with hours'}
                </span>
              </div>
              {ratio !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full">
                    <div
                      className={`h-2 rounded-full ${ratio <= 1 ? 'bg-green-400' : ratio <= 1.3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(ratio * 50, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${ratio <= 1 ? 'text-green-300' : ratio <= 1.3 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {ratio <= 1 ? 'Under budget' : ratio <= 1.3 ? 'Near budget' : 'Over budget'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottlenecks */}
      <div className={glassCard}>
        <h3 className="text-white font-semibold mb-4">Bottleneck Detection — Blocked Tasks by Team</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {blockedByTeam.map(({ team, blocked }) => (
            <div key={team} className={`rounded-xl p-3 border ${blocked > 0 ? 'bg-red-500/10 border-red-400/30' : 'bg-white/5 border-white/10'}`}>
              <p className="text-white/70 text-sm">{TEAM_LABELS[team]}</p>
              <p className={`text-2xl font-bold mt-1 ${blocked > 0 ? 'text-red-300' : 'text-white/40'}`}>{blocked}</p>
              <p className="text-white/40 text-xs">blocked task{blocked !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductivityPage() {
  const [tab, setTab] = useState<Tab>('Team Dashboard');
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/productivity')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Failed to load productivity data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (id: number, status: TaskStatus) => {
    const completed_at = status === 'done' ? new Date().toISOString() : null;
    await fetch('/api/admin/productivity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, completed_at }),
    }).catch(() => null);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className={`${glass} mb-6`}>
        <h1 className="text-2xl font-bold text-white">Productivity Management 📈</h1>
        <p className="text-white/60 text-sm mt-1">Track team performance, task velocity, and process-linked productivity metrics</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={glass}>
        {loading && <p className="text-white/40 text-sm">Loading productivity data…</p>}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {!loading && !error && data && (
          <>
            {tab === 'Team Dashboard' && <TeamDashboardTab data={data} />}
            {tab === 'Task Board' && <TaskBoardTab tasks={data.tasks} onStatusChange={handleStatusChange} />}
            {tab === 'Metrics Tracker' && <MetricsTrackerTab metrics={data.metrics} onRefresh={fetchData} />}
            {tab === 'Add Task' && <AddTaskTab onRefresh={fetchData} />}
            {tab === 'Process-Productivity Link' && <ProcessProductivityLinkTab tasks={data.tasks} />}
            {tab === 'Efficiency Analysis' && <EfficiencyAnalysisTab tasks={data.tasks} />}
          </>
        )}
      </div>
    </div>
  );
}
