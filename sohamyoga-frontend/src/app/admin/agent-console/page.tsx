'use client';
// Agent Console — the "BOT UI where the user gives a prompt to do the task"
// requested in this session. NOT new infrastructure: this is a thin UI over
// the already-real, already-running agentic-ollama-platform gateway
// (planner -> task queue -> workers), reached via the existing bridge routes
// src/app/api/ai/agent (GET health, POST goal) and /api/ai/agent/[id]
// (status). Building a second agent system here would duplicate real,
// working infrastructure per this session's own memory note.

import { useEffect, useRef, useState } from 'react';

interface Task {
  id: number; task_name: string; agent_name: string; priority: string; status: string;
  output_payload: string | null; error_message: string | null;
}
interface RequestStatus { request_id: number; tasks: Task[]; }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', running: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700',
};

export default function AgentConsolePage() {
  const [health, setHealth] = useState<{ ok: boolean; url?: string } | null>(null);
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<number[]>([]);
  const [active, setActive] = useState<RequestStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/ai/agent').then(r => r.json()).then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function pollStatus(requestId: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = async () => {
      const r = await fetch(`/api/ai/agent/${requestId}`);
      if (!r.ok) return;
      const data: RequestStatus = await r.json();
      setActive(data);
      if (data.tasks.every(t => ['completed', 'failed'].includes(t.status)) && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    void tick();
    pollRef.current = setInterval(tick, 3000);
  }

  async function submit() {
    if (!goal.trim()) return;
    setSubmitting(true);
    setError('');
    const r = await fetch('/api/ai/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: goal.trim() }) });
    const j = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(j.error ? `${j.error}${j.details ? ' — ' + j.details : ''}` : 'Submit failed.'); return; }
    setHistory(h => [j.request_id, ...h]);
    pollStatus(j.request_id);
    setGoal('');
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Agent Console</h1>
        <p className="text-sm text-gray-500">Describe a task in plain language. A local Ollama planner breaks it into steps and real workers execute them — no cloud tokens. This is the conversational path; the same operations remain runnable manually or as scheduled pipelines elsewhere in the admin.</p>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${health?.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        Agent gateway: {health === null ? 'checking…' : health.ok ? `connected (${health.url})` : 'unavailable — the gateway process is not reachable. No task can run until it is.'}
      </div>

      <div className="rounded-xl border bg-white p-5">
        <textarea
          className="w-full rounded border p-3 text-sm"
          rows={3}
          placeholder='e.g. "Draft a 3-question intake survey for new yoga students"'
          value={goal}
          onChange={e => setGoal(e.target.value)}
          maxLength={2000}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{goal.length}/2000</span>
          <button
            onClick={submit}
            disabled={submitting || !goal.trim() || !health?.ok}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Run task'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {active && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-2 font-semibold">Request #{active.request_id}</h2>
          <div className="space-y-2">
            {active.tasks.map(t => (
              <div key={t.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.task_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                </div>
                <div className="text-xs text-gray-400">{t.agent_name} · {t.priority}</div>
                {t.output_payload && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{t.output_payload}</pre>}
                {t.error_message && <p className="mt-1 text-xs text-red-600">{t.error_message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">This session's earlier requests</h2>
          <div className="flex flex-wrap gap-2">
            {history.slice(1).map(id => (
              <button key={id} onClick={() => pollStatus(id)} className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">#{id}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
