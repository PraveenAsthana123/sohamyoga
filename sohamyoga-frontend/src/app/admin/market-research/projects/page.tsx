'use client';
// Research Project Portfolio + Executive Command Center -- a real project the
// studio/agency is running (objective + real research questions), distinct
// from the curated research_framework/research_topic methodology knowledge
// base at /admin/market-research. Migration 144. The top card row is the
// real Executive Research Health Score rollup (see ResearchHealthScore.ts)
// plus live project-status counts -- the command-center view over this same
// data, not a separate screen with its own copy of the numbers.

import { useCallback, useEffect, useState } from 'react';

interface Project {
  id: string; title: string; objective: string; status: string; createdBy: string; createdAt: string; questionCount: number;
}
interface Question { id: string; questionText: string; sortOrder: number; createdAt: string }
interface HealthReport {
  overallScore: number;
  projectMomentum: { total: number; completed: number; stuckInPlanning: number; score: number };
  surveyQuality: { assessedResponses: number; avgQualityScore: number | null; score: number };
  responseCompletion: { activeSurveys: number; avgCompletionRate: number | null; score: number };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function CommandCenterCards({ projects }: { projects: Project[] }) {
  const [health, setHealth] = useState<HealthReport | null>(null);

  useEffect(() => {
    fetch('/api/admin/market-research/health-score', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setHealth).catch(() => setHealth(null));
  }, []);

  const byStatus = projects.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc; }, {});
  const active = (byStatus.fielding ?? 0) + (byStatus.analysis ?? 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-2">
      <div className="bg-white border rounded-lg p-4">
        <p className="text-xs text-gray-500">Research Health Score</p>
        <p className={`text-2xl font-bold mt-1 ${health ? scoreColor(health.overallScore) : 'text-gray-300'}`}>
          {health ? health.overallScore : '—'}
        </p>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <p className="text-xs text-gray-500">Total Projects</p>
        <p className="text-2xl font-bold mt-1 text-gray-800">{projects.length}</p>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <p className="text-xs text-gray-500">Actively Fielding / Analyzing</p>
        <p className="text-2xl font-bold mt-1 text-gray-800">{active}</p>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <p className="text-xs text-gray-500">Stuck in Planning (30d+)</p>
        <p className={`text-2xl font-bold mt-1 ${health && health.projectMomentum.stuckInPlanning > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
          {health ? health.projectMomentum.stuckInPlanning : '—'}
        </p>
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-600', fielding: 'bg-blue-100 text-blue-700',
  analysis: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-400',
};
const NEXT_STATUS: Record<string, string[]> = {
  planning: ['fielding', 'archived'], fielding: ['analysis', 'archived'],
  analysis: ['completed', 'archived'], completed: ['archived'], archived: [],
};

function QuestionPanel({ projectId }: { projectId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/market-research/projects/${projectId}/questions`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setQuestions(d?.questions ?? [])).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    await fetch(`/api/admin/market-research/projects/${projectId}/questions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionText: text }),
    });
    setText(''); load();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/market-research/questions/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="mt-2 rounded-lg border bg-gray-50 p-3">
      {loading ? <p className="text-xs text-gray-400">Loading questions…</p> : (
        <ol className="space-y-1 list-decimal list-inside">
          {questions.map(q => (
            <li key={q.id} className="text-xs flex justify-between items-center bg-white rounded border px-2 py-1">
              <span>{q.questionText}</span>
              <button onClick={() => remove(q.id)} className="text-red-500 hover:underline ml-2">Remove</button>
            </li>
          ))}
          {!questions.length && <p className="text-xs text-gray-400 list-none">No questions yet.</p>}
        </ol>
      )}
      <div className="mt-2 flex gap-1.5">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a research question…" className="flex-1 rounded border px-2 py-1 text-xs" />
        <button onClick={add} disabled={!text.trim()} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50">Add</button>
      </div>
    </div>
  );
}

interface SamplingStatus {
  surveyId: string | null; surveyTitle: string | null; targetSampleSize: number | null;
  invitationCounts: Record<string, number>; totalInvited: number; completedResponses: number; progressPercent: number | null;
}
interface SurveyOption { id: string; slug: string; title: string; status: string }

function SamplingPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<SamplingStatus | null>(null);
  const [surveys, setSurveys] = useState<SurveyOption[]>([]);
  const [targetInput, setTargetInput] = useState('');

  const load = useCallback(() => {
    fetch(`/api/admin/market-research/projects/${projectId}/sampling`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) { setStatus(d); setTargetInput(d.targetSampleSize?.toString() ?? ''); } });
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/market-research/surveys', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setSurveys(d?.surveys ?? []));
  }, []);

  async function link(surveyId: string) {
    await fetch(`/api/admin/market-research/projects/${projectId}/sampling`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId: surveyId || null, targetSampleSize: targetInput ? Number(targetInput) : null }),
    });
    load();
  }

  if (!status) return <div className="mt-2 rounded-lg border bg-gray-50 p-3 text-xs text-gray-400">Loading sampling status…</div>;

  return (
    <div className="mt-2 rounded-lg border bg-gray-50 p-3 space-y-2">
      <div className="flex gap-1.5 items-center">
        <select value={status.surveyId ?? ''} onChange={e => link(e.target.value)} className="flex-1 rounded border px-2 py-1 text-xs">
          <option value="">No survey linked</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title} ({s.status})</option>)}
        </select>
        <input value={targetInput} onChange={e => setTargetInput(e.target.value)} onBlur={() => status.surveyId && link(status.surveyId)}
          placeholder="Target N" type="number" min={1} className="w-20 rounded border px-2 py-1 text-xs" />
      </div>
      {status.surveyId ? (
        <div className="text-xs text-gray-600 space-y-1">
          <p>Recruiting via <span className="font-medium">{status.surveyTitle}</span> — {status.totalInvited} invited, {status.completedResponses} completed
            {status.progressPercent !== null && ` (${status.progressPercent}% of target)`}</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(status.invitationCounts).map(([s, n]) => (
              <span key={s} className="rounded-full bg-white border px-2 py-0.5">{s}: {n}</span>
            ))}
          </div>
        </div>
      ) : <p className="text-xs text-gray-400">Link a survey above to track real recruitment progress.</p>}
    </div>
  );
}

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true); setError('');
    const res = await fetch('/api/admin/market-research/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, objective }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) { setError(body.error || 'Failed to create.'); return; }
    setTitle(''); setObjective(''); setOpen(false); onCreated();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded">+ New Project</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="Research objective" rows={2} className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy || !title.trim() || !objective.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function ResearchProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<{ id: string; panel: 'questions' | 'sampling' } | null>(null);
  const [transitionError, setTransitionError] = useState<{ projectId: string; issues: string[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/market-research/projects', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setProjects(d?.projects ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, status: string) {
    setTransitionError(null);
    const res = await fetch(`/api/admin/market-research/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setTransitionError({ projectId: id, issues: body.issues ?? [body.error ?? 'Transition failed.'] });
      return;
    }
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research Project Portfolio</h1>
          <p className="text-sm text-gray-500">Real research projects — objective + research questions, lifecycle-managed.</p>
        </div>
        <NewProjectForm onCreated={load} />
      </div>
      {!loading && <CommandCenterCards projects={projects} />}
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.objective}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.questionCount} question{p.questionCount === 1 ? '' : 's'} · created by {p.createdBy}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status]}`}>{p.status}</span>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                {(NEXT_STATUS[p.status] ?? []).map(s => (
                  <button key={s} onClick={() => transition(p.id, s)} className="text-xs text-blue-600 hover:underline">{s}</button>
                ))}
                <button onClick={() => setExpanded(e => e?.id === p.id && e.panel === 'questions' ? null : { id: p.id, panel: 'questions' })} className="text-xs text-indigo-600 hover:underline ml-auto">
                  {expanded?.id === p.id && expanded.panel === 'questions' ? 'Hide questions' : 'Questions'}
                </button>
                <button onClick={() => setExpanded(e => e?.id === p.id && e.panel === 'sampling' ? null : { id: p.id, panel: 'sampling' })} className="text-xs text-indigo-600 hover:underline">
                  {expanded?.id === p.id && expanded.panel === 'sampling' ? 'Hide sampling' : 'Sampling'}
                </button>
              </div>
              {transitionError?.projectId === p.id && (
                <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <p className="font-medium">Cannot move to fielding:</p>
                  <ul className="list-disc list-inside">
                    {transitionError.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </div>
              )}
              {expanded?.id === p.id && expanded.panel === 'questions' && <QuestionPanel projectId={p.id} />}
              {expanded?.id === p.id && expanded.panel === 'sampling' && <SamplingPanel projectId={p.id} />}
            </div>
          ))}
          {!projects.length && <p className="text-sm text-gray-400">No research projects yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
