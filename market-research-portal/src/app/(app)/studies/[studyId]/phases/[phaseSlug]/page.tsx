'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PhaseTabs, { type PhaseData, type PhaseRunData, type TransactionEntry, type AiLogEntry, type JobRunSummary } from '../../../../../../components/PhaseTabs';

interface Detail {
  study: { id: string; topicName: string };
  phase: PhaseData;
  phaseRun: PhaseRunData;
  transactions: TransactionEntry[];
  aiLogs: AiLogEntry[];
  jobRuns: { researchAiJobRun: JobRunSummary | null; pricingJobRun: JobRunSummary | null; reviewsJobRun: JobRunSummary | null };
}

export default function StudyPhasePage({ params }: { params: { studyId: string; phaseSlug: string } }) {
  const { studyId, phaseSlug } = params;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/studies/${studyId}/phases/${phaseSlug}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(setData)
      .catch(e => setError(e.message));
  }, [studyId, phaseSlug]);

  useEffect(() => { setData(null); setError(''); load(); }, [load]);

  const runResearchAi = async () => {
    setRunning(true);
    try {
      await fetch('/api/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'ResearchAiDraftJob', studyId, phaseSlug }),
      });
      load();
    } finally {
      setRunning(false);
    }
  };

  const toggleField = async (field: 'checklist' | 'todoList', index: number, done: boolean) => {
    await fetch(`/api/studies/${studyId}/phases/${phaseSlug}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, index, done }),
    });
    load();
  };

  const addChecklistItem = async (text: string) => {
    await fetch(`/api/studies/${studyId}/phases/${phaseSlug}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    load();
  };

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="text-sm">
        <Link href="/studies" className="text-brand-700 hover:underline">Studies</Link>
        <span className="mx-1.5 text-gray-400">/</span>
        <span className="text-gray-600">{data.study.topicName}</span>
      </div>
      <header className="border-l-4 border-brand-600 pl-4">
        <h1 className="text-2xl font-bold text-gray-900">{data.phase.name}</h1>
        <p className="text-sm text-gray-500">Layer {data.phase.layerNumber} — study: &quot;{data.study.topicName}&quot;</p>
      </header>
      {running && <div className="text-xs text-amber-600">Running Research-AI draft…</div>}
      <PhaseTabs
        mode="study"
        phase={data.phase}
        phaseRun={data.phaseRun}
        transactions={data.transactions}
        aiLogs={data.aiLogs}
        jobRuns={data.jobRuns}
        studyId={studyId}
        onRunResearchAi={runResearchAi}
        onToggleField={toggleField}
        onAddChecklistItem={addChecklistItem}
      />
    </div>
  );
}
