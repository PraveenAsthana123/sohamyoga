'use client';
// Reference mode — static framework definition only, no study selected.

import { useEffect, useState } from 'react';
import PhaseTabs, { type PhaseData, type ChecklistTemplates } from '../../../../components/PhaseTabs';

export default function ReferencePhasePage({ params }: { params: { phaseSlug: string } }) {
  const [phase, setPhase] = useState<PhaseData | null>(null);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplates | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPhase(null);
    setChecklistTemplates(null);
    setError('');
    fetch(`/api/phases/${params.phaseSlug}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(d => { setPhase(d.phase); setChecklistTemplates(d.checklistTemplates ?? null); })
      .catch(e => setError(e.message));
  }, [params.phaseSlug]);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!phase) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="border-l-4 border-brand-600 pl-4">
        <h1 className="text-2xl font-bold text-gray-900">{phase.name}</h1>
        <p className="text-sm text-gray-500">Layer {phase.layerNumber} — reference mode (no study selected)</p>
      </header>
      <PhaseTabs mode="reference" phase={phase} checklistTemplates={checklistTemplates} />
    </div>
  );
}
