'use client';
// Master pipeline page — topic input, Run Pipeline, live 17-row status grid.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Study { id: string; topicName: string; status: string; createdAt: string }
interface PhaseRunRow {
  id: string;
  phaseSlug: string;
  phaseName: string;
  layerNumber: number;
  status: string;
  updatedAt: string;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-300',
    running: 'bg-amber-400 animate-pulse',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] ?? 'bg-gray-300'}`} />;
}

export default function MasterPipelinePage() {
  const [topicName, setTopicName] = useState('');
  const [businessModel, setBusinessModel] = useState<'b2b' | 'b2c' | ''>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [activeStudy, setActiveStudy] = useState<Study | null>(null);
  const [phaseRuns, setPhaseRuns] = useState<PhaseRunRow[]>([]);
  const [recentStudies, setRecentStudies] = useState<Study[]>([]);

  const loadRecent = useCallback(() => {
    fetch('/api/studies', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRecentStudies(d.studies ?? []));
  }, []);

  useEffect(loadRecent, [loadRecent]);

  const loadStudyDetail = useCallback((studyId: string) => {
    fetch(`/api/studies/${studyId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setActiveStudy(d.study);
        setPhaseRuns(d.phaseRuns ?? []);
      });
  }, []);

  useEffect(() => {
    if (!activeStudy) return;
    const stillRunning = phaseRuns.some(p => p.status === 'pending' || p.status === 'running');
    if (!stillRunning) return;
    const interval = setInterval(() => loadStudyDetail(activeStudy.id), 2500);
    return () => clearInterval(interval);
  }, [activeStudy, phaseRuns, loadStudyDetail]);

  const runPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || !businessModel) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: topicName.trim(), businessModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create study');
      setTopicName('');
      setBusinessModel('');
      loadRecent();
      loadStudyDetail(data.study.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create study');
    } finally {
      setCreating(false);
    }
  };

  const completedCount = phaseRuns.filter(p => p.status === 'completed').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Master Pipeline</h1>
        <p className="text-sm text-gray-500">Enter a topic (e.g. &quot;yoga center&quot;) and run it through all 17 research phases.</p>
      </header>

      <form onSubmit={runPipeline} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={topicName}
            onChange={e => setTopicName(e.target.value)}
            placeholder="e.g. Restaurant"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !topicName.trim() || !businessModel}
            className="rounded bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? 'Starting…' : 'Run Pipeline'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business model (required)</span>
          <label className="flex items-center gap-1.5 text-sm text-gray-800">
            <input type="radio" name="businessModel" value="b2c" checked={businessModel === 'b2c'} onChange={() => setBusinessModel('b2c')} />
            B2C — consumer-facing (e.g. a restaurant serving diners)
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-800">
            <input type="radio" name="businessModel" value="b2b" checked={businessModel === 'b2b'} onChange={() => setBusinessModel('b2b')} />
            B2B — business-facing (e.g. a restaurant-supply/catering business)
          </label>
        </div>
      </form>
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {activeStudy && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">&quot;{activeStudy.topicName}&quot;</h2>
              <p className="text-xs text-gray-500">{completedCount} / {phaseRuns.length} phases completed</p>
            </div>
            <span className="text-xs text-gray-400">{new Date(activeStudy.createdAt).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {phaseRuns.map(p => (
              <Link
                key={p.id}
                href={`/studies/${activeStudy.id}/phases/${p.phaseSlug}`}
                className="flex items-center gap-2 rounded border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <StatusDot status={p.status} />
                <span className="text-gray-400">{p.layerNumber}.</span>
                <span className="flex-1 text-gray-800">{p.phaseName}</span>
                <span className="text-xs text-gray-400">{p.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Recent studies</h2>
        <ul className="space-y-1">
          {recentStudies.map(s => (
            <li key={s.id}>
              <button onClick={() => loadStudyDetail(s.id)} className="text-sm text-brand-700 hover:underline">
                {s.topicName}
              </button>
              <span className="ml-2 text-xs text-gray-400">{s.status} · {new Date(s.createdAt).toLocaleString()}</span>
            </li>
          ))}
          {!recentStudies.length && <li className="text-sm text-gray-400">No studies yet.</li>}
        </ul>
      </div>
    </div>
  );
}
