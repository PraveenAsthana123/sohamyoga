'use client';
// Module 4 — Poll Management. Was "0 of 12 persisted": a real Poll.ts domain
// class + a customer-facing UI existed, but zero database table, zero API —
// the customer page's "votes" reset on every refresh. Now real end-to-end.

import { useEffect, useState, useCallback } from 'react';

interface PollData {
  id: string; question: string; status: string; options: Array<{ id: string; text: string; votes: number }>;
}

function NewPollForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/community/polls', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options: options.filter(Boolean) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setQuestion(''); setOptions(['', '']); onCreated(); }
    else setError(body.error ?? 'Failed to create poll.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Poll</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Poll question" className="w-full border rounded px-2 py-1.5 text-sm" />
      {options.map((o, i) => (
        <input key={i} value={o} onChange={e => setOptions(opts => opts.map((x, j) => j === i ? e.target.value : x))} placeholder={`Option ${i + 1}`} className="w-full border rounded px-2 py-1.5 text-sm" />
      ))}
      <button onClick={() => setOptions(o => [...o, ''])} className="text-xs text-indigo-600 hover:underline">+ Add option</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !question || options.filter(Boolean).length < 2} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function AdminPollsPage() {
  const [polls, setPolls] = useState<PollData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/community/polls', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPolls(d?.polls ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, action: 'activate' | 'close') {
    await fetch(`/api/community/polls/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Poll Management</h1><p className="text-sm text-gray-500">Real persistence — was a UI mockup with zero backend before.</p></div>
        <NewPollForm onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {polls.map(p => {
            const total = p.options.reduce((s, o) => s + o.votes, 0);
            return (
              <div key={p.id} className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-gray-800">{p.question}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : p.status === 'CLOSED' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
                </div>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  {p.options.map(o => <li key={o.id}>{o.text} — {o.votes} vote(s)</li>)}
                </ul>
                <p className="text-xs text-gray-400 mt-1">{total} total votes</p>
                <div className="flex gap-2 mt-2">
                  {p.status !== 'ACTIVE' && p.status !== 'CLOSED' && <button onClick={() => setStatus(p.id, 'activate')} className="text-xs text-green-600 hover:underline">Activate</button>}
                  {p.status === 'ACTIVE' && <button onClick={() => setStatus(p.id, 'close')} className="text-xs text-red-600 hover:underline">Close</button>}
                </div>
              </div>
            );
          })}
          {!polls.length && <p className="text-sm text-gray-400">No polls yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
