'use client';
// /customer/goals — real structured goals (student_goal + ref_yoga_goal
// catalog), distinct from the free-text goal_statement in Preferences.

import { useEffect, useState } from 'react';

interface Goal { goal_code: string; label: string; priority: number; set_at: string }
interface Catalog { code: string; label: string }

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [hasStudentRecord, setHasStudentRecord] = useState(true);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/customer/goals', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setGoals(d.goals ?? []); setCatalog(d.catalog ?? []); setHasStudentRecord(d.hasStudentRecord);
      })
      .catch(() => setError('Failed to load goals. Please refresh.'));
  };
  useEffect(() => { load() }, []);

  async function add() {
    if (!selected) return;
    setError('');
    try {
      await fetch('/api/customer/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goalCode: selected, priority: goals.length + 1 }) });
      setSelected('');
      load();
    } catch {
      setError('Failed to add goal. Please try again.');
    }
  }
  async function remove(goalCode: string) {
    setError('');
    try {
      await fetch(`/api/customer/goals?goalCode=${goalCode}`, { method: 'DELETE' });
      load();
    } catch {
      setError('Failed to remove goal. Please try again.');
    }
  }

  if (!hasStudentRecord) return <p className="text-sm text-white/60">Goals are available once you&apos;re enrolled in a class.</p>;
  const available = catalog.filter(c => !goals.some(g => g.goal_code === c.code));

  return (
    <div className="max-w-xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">My Goals</h1>
        <p className="mt-1 text-sm text-white/60">{goals.length} goal(s) set. Ranked by priority.</p>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-900/20 rounded p-2">{error}</p>}

      <div className="flex gap-2">
        <select className="flex-1 rounded border p-2 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Add a goal…</option>
          {available.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button disabled={!selected} onClick={add} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Add</button>
      </div>

      <div className="space-y-2 text-white">
        {goals.map(g => (
          <div key={g.goal_code} className="flex items-center justify-between rounded-lg border border-white/20 backdrop-blur-md bg-white/10 p-3 text-sm">
            <span><span className="mr-2 text-white/40">#{g.priority}</span>{g.label}</span>
            <button onClick={() => remove(g.goal_code)} className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ))}
        {!goals.length && <p className="text-sm text-white/40">No goals set yet.</p>}
      </div>
    </div>
  );
}
