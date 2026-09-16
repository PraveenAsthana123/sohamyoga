'use client';

import { useEffect, useState, useCallback } from 'react';

type TabId = 'planner' | 'add' | 'stats' | 'calendar';

interface TimeBlock {
  id: number;
  title: string;
  category: string;
  assigned_to: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  priority: string;
  status: string;
  related_module: string | null;
  notes: string | null;
  created_at: string;
}

interface Job {
  job_name: string;
  cron_expression: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  status: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  task: 'bg-blue-500/30 border-blue-400/40 text-blue-100',
  meeting: 'bg-purple-500/30 border-purple-400/40 text-purple-100',
  campaign: 'bg-green-500/30 border-green-400/40 text-green-100',
  content: 'bg-amber-500/30 border-amber-400/40 text-amber-100',
  break: 'bg-gray-500/30 border-gray-400/40 text-gray-100',
  review: 'bg-pink-500/30 border-pink-400/40 text-pink-100',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full mx-auto" />;
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

function blockDay(block: TimeBlock): number {
  // 0=Mon, 1=Tue, ..., 6=Sun
  const d = new Date(block.start_time).getDay();
  return d === 0 ? 6 : d - 1;
}

function blockHours(block: TimeBlock): number {
  if (block.duration_minutes) return block.duration_minutes / 60;
  const diff = new Date(block.end_time).getTime() - new Date(block.start_time).getTime();
  return diff / 3600000;
}

// ── Tab: Weekly Planner ────────────────────────────────────────────────────
function WeeklyPlannerTab({ blocks, onDelete }: { blocks: TimeBlock[]; onDelete: (id: number) => void }) {
  const byDay = Array.from({ length: 7 }, (_, i) => blocks.filter(b => blockDay(b) === i));
  const hoursByDay = byDay.map(dayBlocks => dayBlocks.reduce((sum, b) => sum + blockHours(b), 0));

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {DAYS.map((day, i) => (
          <div key={day}>
            <div className="text-center mb-2">
              <p className="text-white font-semibold text-sm">{day}</p>
              <p className="text-white/50 text-xs">{hoursByDay[i].toFixed(1)}h</p>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {byDay[i].length === 0 && (
                <div className="text-center text-white/20 text-xs py-4">—</div>
              )}
              {byDay[i].map(b => {
                const cls = CATEGORY_COLORS[b.category] ?? 'bg-white/10 border-white/20 text-white';
                return (
                  <div key={b.id} className={`p-2 border rounded-lg ${cls} relative group`}>
                    <p className="text-xs font-semibold truncate">{b.title}</p>
                    <p className="text-xs opacity-70">{new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <button
                      onClick={() => onDelete(b.id)}
                      className="absolute top-1 right-1 hidden group-hover:block text-white/50 hover:text-white text-xs"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Add Time Block ────────────────────────────────────────────────────
function AddTimeBlockTab({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({
    title: '',
    category: 'task',
    assigned_to: '',
    start_time: '',
    end_time: '',
    priority: 'medium',
    related_module: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const durationMinutes = form.start_time && form.end_time
    ? Math.max(0, Math.round((new Date(form.end_time).getTime() - new Date(form.start_time).getTime()) / 60000))
    : null;

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setError('');
    if (!form.title || !form.start_time || !form.end_time) { setError('Title, start time, end time required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/time-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_minutes: durationMinutes }),
      });
      if (res.ok) {
        setSuccess('Time block added!');
        setForm({ title: '', category: 'task', assigned_to: '', start_time: '', end_time: '', priority: 'medium', related_module: '', notes: '' });
        onAdded();
      } else {
        setError('Failed to add time block');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="max-w-lg">
      <h3 className="text-white font-semibold mb-4">Add Time Block</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-white/60 text-xs mb-1">Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Block title"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/60 text-xs mb-1">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
              {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-white/60 text-xs mb-1">Assigned To</label>
          <input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="e.g. admin@example.com"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/60 text-xs mb-1">Start Time *</label>
            <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">End Time *</label>
            <input type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>
        {durationMinutes !== null && (
          <p className="text-white/50 text-xs">Duration: {durationMinutes} minutes</p>
        )}
        <div>
          <label className="block text-white/60 text-xs mb-1">Related Module</label>
          <input value={form.related_module} onChange={e => set('related_module', e.target.value)} placeholder="e.g. paid-ads"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30" />
        </div>
        <div>
          <label className="block text-white/60 text-xs mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {success && <p className="text-emerald-300 text-sm">{success}</p>}
        <button onClick={() => void save()} disabled={saving}
          className="w-full px-4 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Time Block'}
        </button>
      </div>
    </GlassCard>
  );
}

// ── Tab: Productivity Stats ────────────────────────────────────────────────
function ProductivityStatsTab({ blocks }: { blocks: TimeBlock[] }) {
  const byCategory = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.category] = (acc[b.category] ?? 0) + blockHours(b);
    return acc;
  }, {});

  const completed = blocks.filter(b => b.status === 'completed').length;
  const planned = blocks.filter(b => b.status === 'planned').length;
  const ratio = blocks.length > 0 ? Math.round((completed / blocks.length) * 100) : 0;

  const hoursByDay = Array.from({ length: 7 }, (_, i) =>
    blocks.filter(b => blockDay(b) === i).reduce((sum, b) => sum + blockHours(b), 0)
  );
  const busiestIdx = hoursByDay.indexOf(Math.max(...hoursByDay));
  const avgDaily = hoursByDay.reduce((a, b) => a + b, 0) / 7;

  const maxCat = Math.max(1, ...Object.values(byCategory));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Completed', value: String(completed), color: 'text-emerald-300' },
          { label: 'Planned', value: String(planned), color: 'text-white' },
          { label: 'Completion Rate', value: `${ratio}%`, color: 'text-blue-300' },
          { label: 'Avg Daily Hours', value: `${avgDaily.toFixed(1)}h`, color: 'text-amber-300' },
        ].map(c => (
          <GlassCard key={c.label}>
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Hours by Category</h3>
          <div className="space-y-2">
            {Object.entries(byCategory).map(([cat, hours]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span>{cat}</span><span>{hours.toFixed(1)}h</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(hours / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && <p className="text-white/40 text-xs">No data yet.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Daily Hours</h3>
          <div className="space-y-2">
            {DAYS.map((day, i) => {
              const h = hoursByDay[i];
              const maxH = Math.max(1, ...hoursByDay);
              return (
                <div key={day}>
                  <div className="flex justify-between text-xs text-white/70 mb-1">
                    <span>{day}{i === busiestIdx && h > 0 ? ' 🔥' : ''}</span><span>{h.toFixed(1)}h</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400/60 rounded-full" style={{ width: `${(h / maxH) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ── Tab: Marketing Calendar ────────────────────────────────────────────────
function MarketingCalendarTab({ blocks }: { blocks: TimeBlock[] }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch('/api/admin/job-scheduler', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('fail')))
      .then((data: { jobs: Job[] }) => setJobs((data.jobs ?? []).filter(j => j.next_run_at)))
      .catch(() => {});
  }, []);

  type CalItem =
    | { type: 'task'; block: TimeBlock }
    | { type: 'job'; job: Job };

  const items: CalItem[] = [
    ...blocks.map(b => ({ type: 'task' as const, block: b })),
    ...jobs.map(j => ({ type: 'job' as const, job: j })),
  ].sort((a, b) => {
    const ta = a.type === 'task' ? new Date(a.block.start_time).getTime() : new Date(a.job.next_run_at!).getTime();
    const tb = b.type === 'task' ? new Date(b.block.start_time).getTime() : new Date(b.job.next_run_at!).getTime();
    return ta - tb;
  });

  return (
    <GlassCard>
      <h3 className="text-white font-semibold mb-4">This Week — Unified Calendar</h3>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-white/40 text-sm">No items this week.</p>}
        {items.map((item, i) => {
          if (item.type === 'task') {
            const b = item.block;
            const cls = CATEGORY_COLORS[b.category] ?? 'bg-white/10 border-white/20 text-white';
            return (
              <div key={`task-${b.id}`} className={`flex items-center gap-3 p-3 border rounded-xl ${cls}`}>
                <span className="text-xs font-bold px-2 py-0.5 bg-black/20 rounded">[TASK]</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs opacity-70">{b.category} · {new Date(b.start_time).toLocaleString()}</p>
                </div>
              </div>
            );
          } else {
            const j = item.job;
            return (
              <div key={`job-${i}`} className="flex items-center gap-3 p-3 border border-blue-400/30 bg-blue-500/10 rounded-xl text-blue-100">
                <span className="text-xs font-bold px-2 py-0.5 bg-black/20 rounded">[JOB]</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{j.job_name}</p>
                  <p className="text-xs opacity-70">Next run: {j.next_run_at ? new Date(j.next_run_at).toLocaleString() : '—'}</p>
                </div>
              </div>
            );
          }
        })}
      </div>
    </GlassCard>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'planner', label: 'Weekly Planner' },
  { id: 'add', label: 'Add Time Block' },
  { id: 'stats', label: 'Productivity Stats' },
  { id: 'calendar', label: 'Marketing Calendar' },
];

export default function TimeManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('planner');
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const week = getWeekStart();
    try {
      const res = await fetch(`/api/admin/time-management?week=${week}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { blocks: TimeBlock[] };
        setBlocks(data.blocks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const deleteBlock = async (id: number) => {
    await fetch('/api/admin/time-management', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Time Management</h1>
          <p className="text-white/60 text-sm mt-1">Plan your week, track time, and view the unified marketing calendar.</p>
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
          {loading && activeTab !== 'add' ? (
            <div className="py-12 text-center"><Spinner /></div>
          ) : (
            <>
              {activeTab === 'planner' && <WeeklyPlannerTab blocks={blocks} onDelete={deleteBlock} />}
              {activeTab === 'add' && <AddTimeBlockTab onAdded={load} />}
              {activeTab === 'stats' && <ProductivityStatsTab blocks={blocks} />}
              {activeTab === 'calendar' && <MarketingCalendarTab blocks={blocks} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
