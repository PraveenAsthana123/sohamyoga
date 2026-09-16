'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['active', 'all', 'create', 'results'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  active: 'Active Tests',
  all: 'All Tests',
  create: 'Create New',
  results: 'Results',
};

type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed';

interface ABTest {
  id: number;
  name: string;
  description: string | null;
  status: ABTestStatus;
  page_path: string | null;
  hypothesis: string | null;
  traffic_split: number;
  start_date: string | null;
  end_date: string | null;
  metric_primary: string | null;
  variant_a_name: string;
  variant_b_name: string;
  variant_a_views: number;
  variant_a_conversions: number;
  variant_b_views: number;
  variant_b_conversions: number;
  winner: string | null;
  created_at: string;
  cvr_a: number;
  cvr_b: number;
  lift_pct: number;
}

const STATUS_STYLES: Record<ABTestStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  running: 'bg-green-500/20 text-green-300 border border-green-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

const METRICS = ['conversion', 'clicks', 'time_on_page', 'scroll_depth'];

function StatusBadge({ status }: { status: ABTestStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

function LiftBadge({ lift }: { lift: number }) {
  const cls =
    lift >= 10 ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
    lift >= 5  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                 'bg-red-500/20 text-red-300 border border-red-500/30';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{lift.toFixed(1)}% lift</span>;
}

function fmtCvr(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

// ── Active Tests ─────────────────────────────────────────────────────────────
function ActiveTests({ tests, onStatusChange }: { tests: ABTest[]; onStatusChange: () => void }) {
  const running = tests.filter(t => t.status === 'running');

  async function updateStatus(id: number, status: ABTestStatus) {
    await fetch('/api/admin/ab-tests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    onStatusChange();
  }

  if (running.length === 0) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl text-center text-white/40">
        No tests currently running. Create a test and set it to "running" to see it here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {running.map(t => (
        <div key={t.id} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-white font-semibold">{t.name}</h3>
              {t.page_path && <p className="text-white/50 text-xs font-mono mt-0.5">{t.page_path}</p>}
            </div>
            <LiftBadge lift={t.lift_pct} />
          </div>

          {/* Traffic split bar */}
          <div>
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>{t.variant_a_name} ({100 - t.traffic_split}%)</span>
              <span>{t.variant_b_name} ({t.traffic_split}%)</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full" style={{ width: `${100 - t.traffic_split}%` }} />
              <div className="bg-purple-500 h-full flex-1" />
            </div>
          </div>

          {/* CVR comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/50 text-xs">{t.variant_a_name}</p>
              <p className="text-white font-bold text-lg">{fmtCvr(t.cvr_a)}</p>
              <p className="text-white/40 text-xs">{t.variant_a_conversions}/{t.variant_a_views} conversions</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/50 text-xs">{t.variant_b_name}</p>
              <p className="text-white font-bold text-lg">{fmtCvr(t.cvr_b)}</p>
              <p className="text-white/40 text-xs">{t.variant_b_conversions}/{t.variant_b_views} conversions</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => updateStatus(t.id, 'paused')}
              className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Pause
            </button>
            <button
              onClick={() => updateStatus(t.id, 'completed')}
              className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Complete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── All Tests ────────────────────────────────────────────────────────────────
function AllTests({ tests, onStatusChange }: { tests: ABTest[]; onStatusChange: () => void }) {
  const [filter, setFilter] = useState<ABTestStatus | 'all'>('all');
  const statuses: Array<ABTestStatus | 'all'> = ['all', 'draft', 'running', 'paused', 'completed'];

  const filtered = filter === 'all' ? tests : tests.filter(t => t.status === filter);

  async function updateStatus(id: number, status: ABTestStatus) {
    await fetch('/api/admin/ab-tests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    onStatusChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === s ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/60 text-left text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Page</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Start</th>
              <th className="pb-3 pr-4">End</th>
              <th className="pb-3 pr-4">Lift</th>
              <th className="pb-3">Winner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-white/40">No tests found.</td></tr>
            )}
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-white/10 text-white/80">
                <td className="py-2 pr-4 font-medium text-white">{t.name}</td>
                <td className="py-2 pr-4 font-mono text-xs text-white/50">{t.page_path ?? '—'}</td>
                <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                <td className="py-2 pr-4 text-xs">{t.start_date ?? '—'}</td>
                <td className="py-2 pr-4 text-xs">{t.end_date ?? '—'}</td>
                <td className="py-2 pr-4"><LiftBadge lift={t.lift_pct} /></td>
                <td className="py-2">
                  {t.winner
                    ? <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">{t.winner}</span>
                    : t.status === 'running'
                      ? <button
                          onClick={() => updateStatus(t.id, 'paused')}
                          className="text-xs text-white/40 hover:text-white/60 underline"
                        >pause</button>
                      : <span className="text-white/30">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Create New ────────────────────────────────────────────────────────────────
function CreateNew({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '', page_path: '', hypothesis: '',
    traffic_split: 50, metric_primary: 'conversion',
    start_date: '', end_date: '', variant_a_name: 'Control', variant_b_name: 'Variant',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ ok: true, text: `Test created (ID: ${data.id}).` });
        setForm({ name: '', description: '', page_path: '', hypothesis: '', traffic_split: 50, metric_primary: 'conversion', start_date: '', end_date: '', variant_a_name: 'Control', variant_b_name: 'Variant' });
        onCreated();
      } else {
        setMessage({ ok: false, text: data.error ?? 'Failed to create test.' });
      }
    } catch {
      setMessage({ ok: false, text: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400 text-sm';
  const labelCls = 'block text-white/60 text-xs mb-1';

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl max-w-2xl">
      <h2 className="text-white font-semibold text-lg mb-6">New A/B Test</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Test Name *</label>
            <input required className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Checkout button colour test" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What are you testing and why?" />
          </div>
          <div>
            <label className={labelCls}>Page Path</label>
            <input className={inputCls} value={form.page_path} onChange={e => set('page_path', e.target.value)} placeholder="/checkout" />
          </div>
          <div>
            <label className={labelCls}>Primary Metric</label>
            <select className={inputCls} value={form.metric_primary} onChange={e => set('metric_primary', e.target.value)}>
              {METRICS.map(m => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Hypothesis</label>
            <textarea className={inputCls} rows={2} value={form.hypothesis} onChange={e => set('hypothesis', e.target.value)} placeholder="We believe that… will result in…" />
          </div>
          <div>
            <label className={labelCls}>Variant A Name</label>
            <input className={inputCls} value={form.variant_a_name} onChange={e => set('variant_a_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Variant B Name</label>
            <input className={inputCls} value={form.variant_b_name} onChange={e => set('variant_b_name', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Traffic Split — Variant B gets {form.traffic_split}%</label>
            <input
              type="range" min={1} max={99} value={form.traffic_split}
              onChange={e => set('traffic_split', parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-white/40 mt-0.5">
              <span>1%</span><span>50/50</span><span>99%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" className={inputCls} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? 'Creating…' : 'Create Test'}
        </button>
      </form>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function Results({ tests }: { tests: ABTest[] }) {
  const completed = tests.filter(t => t.status === 'completed');

  if (completed.length === 0) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl text-center text-white/40">
        No completed tests yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {completed.map(t => {
        const winnerA = t.cvr_a > t.cvr_b;
        const winnerLabel = t.winner ?? (winnerA ? t.variant_a_name : t.variant_b_name);
        const maxCvr = Math.max(t.cvr_a, t.cvr_b, 0.001);
        return (
          <div key={t.id} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
            {/* Winner announcement */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <h3 className="text-white font-bold text-lg">{t.name}</h3>
                <p className="text-yellow-300 text-sm">Winner: <strong>{winnerLabel}</strong> — {t.lift_pct.toFixed(1)}% lift</p>
              </div>
            </div>

            {/* CVR bar chart */}
            <div className="space-y-3">
              {[
                { name: t.variant_a_name, cvr: t.cvr_a, conv: t.variant_a_conversions, views: t.variant_a_views, color: 'bg-blue-500' },
                { name: t.variant_b_name, cvr: t.cvr_b, conv: t.variant_b_conversions, views: t.variant_b_views, color: 'bg-purple-500' },
              ].map(v => (
                <div key={v.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/80">{v.name}</span>
                    <span className="text-white font-semibold">{fmtCvr(v.cvr)}</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-4 overflow-hidden">
                    <div
                      className={`${v.color} h-full rounded-full`}
                      style={{ width: `${Math.round((v.cvr / maxCvr) * 100)}%` }}
                    />
                  </div>
                  <p className="text-white/40 text-xs mt-1">{v.conv} conversions / {v.views} views</p>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/60 text-sm">
                <strong className="text-white/80">Recommendation:</strong>{' '}
                {t.lift_pct >= 10
                  ? `Deploy ${winnerLabel} to 100% of traffic — statistically meaningful lift of ${t.lift_pct.toFixed(1)}%.`
                  : t.lift_pct >= 5
                  ? `${winnerLabel} shows a moderate lift (${t.lift_pct.toFixed(1)}%). Consider a longer test with more traffic before deploying.`
                  : `Lift is minimal (${t.lift_pct.toFixed(1)}%). Results are inconclusive — iterate on a stronger variant or test a different hypothesis.`
                }
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ABTestingPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ab-tests', { cache: 'no-store' });
      if (!res.ok) { setError('Failed to load tests.'); return; }
      const data = await res.json();
      setTests(data.tests ?? []);
      setError(null);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = tests.filter(t => t.status === 'running').length;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">A/B Testing</h1>
        <p className="text-white/60 mt-1">
          Design, run, and analyse split tests across your marketing funnel.
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded text-xs">
              {activeCount} running
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-white/60">Loading tests…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          {tab === 'active'  && <ActiveTests tests={tests} onStatusChange={load} />}
          {tab === 'all'     && <AllTests tests={tests} onStatusChange={load} />}
          {tab === 'create'  && <CreateNew onCreated={load} />}
          {tab === 'results' && <Results tests={tests} />}
        </>
      )}
    </div>
  );
}
