'use client';
// /customer/practice-journal — replaces /ai/progress, which was a hardcoded
// SESSIONS array with no backing table. Entries are student-authored, real,
// and persisted.

import { useEffect, useState } from 'react';

interface Entry {
  id: string; entry_date: string; session_type: string; duration_minutes: number | null;
  mood_before: number | null; mood_after: number | null; energy_level: number | null; notes: string | null;
}

const SESSION_TYPES = ['class', 'home', 'online', 'retreat'];

export default function PracticeJournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasStudentRecord, setHasStudentRecord] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ entryDate: new Date().toISOString().slice(0, 10), sessionType: 'class', durationMinutes: '', moodBefore: '', moodAfter: '', energyLevel: '', notes: '' });

  const load = () => {
    fetch('/api/customer/practice-journal', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setEntries(d.entries); setHasStudentRecord(d.hasStudentRecord); })
      .catch(e => setError(e.message));
  };
  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/customer/practice-journal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryDate: form.entryDate, sessionType: form.sessionType,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        moodBefore: form.moodBefore ? Number(form.moodBefore) : undefined,
        moodAfter: form.moodAfter ? Number(form.moodAfter) : undefined,
        energyLevel: form.energyLevel ? Number(form.energyLevel) : undefined,
        notes: form.notes || undefined,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    load();
  }

  if (!hasStudentRecord) {
    return <p className="text-sm text-gray-500">Practice journaling is available once you're enrolled in a class.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Journal</h1>
          <p className="mt-1 text-sm text-gray-500">Log how each session felt. Your entries, your data.</p>
        </div>
        {entries.length > 0 && (
          <a href="/api/customer/practice-journal/export" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            ⬇ Export CSV
          </a>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="rounded border p-2 text-sm" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} />
          <select className="rounded border p-2 text-sm" value={form.sessionType} onChange={e => setForm({ ...form, sessionType: e.target.value })}>
            {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" min={1} max={5} placeholder="Mood before (1-5)" className="rounded border p-2 text-sm" value={form.moodBefore} onChange={e => setForm({ ...form, moodBefore: e.target.value })} />
          <input type="number" min={1} max={5} placeholder="Mood after (1-5)" className="rounded border p-2 text-sm" value={form.moodAfter} onChange={e => setForm({ ...form, moodAfter: e.target.value })} />
          <input type="number" min={1} max={5} placeholder="Energy (1-5)" className="rounded border p-2 text-sm" value={form.energyLevel} onChange={e => setForm({ ...form, energyLevel: e.target.value })} />
        </div>
        <input type="number" placeholder="Duration (minutes)" className="w-full rounded border p-2 text-sm" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} />
        <textarea placeholder="Notes (optional)" className="w-full rounded border p-2 text-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Log entry</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{new Date(e.entry_date).toLocaleDateString()} · {e.session_type}</span>
              {e.duration_minutes && <span className="text-gray-400">{e.duration_minutes}m</span>}
            </div>
            {(e.mood_before || e.mood_after || e.energy_level) && (
              <div className="mt-1 text-xs text-gray-500">
                {e.mood_before && `Mood before: ${e.mood_before}/5`} {e.mood_after && `→ after: ${e.mood_after}/5`} {e.energy_level && `· Energy: ${e.energy_level}/5`}
              </div>
            )}
            {e.notes && <p className="mt-1 text-gray-600">{e.notes}</p>}
          </div>
        ))}
        {!entries.length && <p className="text-sm text-gray-400">No entries yet — log your first practice above.</p>}
      </div>
    </div>
  );
}
