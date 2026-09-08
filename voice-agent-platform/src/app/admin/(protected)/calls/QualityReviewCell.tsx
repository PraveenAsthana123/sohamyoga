'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Real, human-entered QA review per call (Topics G/I) -- never an
 * ML/sentiment score, always an explicit admin judgment, recorded as such. */
export default function QualityReviewCell({
  callId, qualityScore, isIncident,
}: {
  callId: string;
  qualityScore: number | null;
  isIncident: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(qualityScore ?? 0);
  const [incident, setIncident] = useState(isIncident);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/calls/${callId}/quality-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualityScore: score || null, isIncident: incident, incidentNotes: notes || null }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs underline flex items-center gap-1">
        {qualityScore ? `${qualityScore}/5` : 'rate'}
        {isIncident && <span className="text-red-600">⚠</span>}
      </button>
    );
  }

  return (
    <div className="space-y-1 border border-black/10 dark:border-white/10 rounded p-2 bg-white dark:bg-black">
      <select value={score} onChange={(e) => setScore(Number(e.target.value))} className="border border-black/20 dark:border-white/20 rounded text-xs px-1 py-0.5 w-full">
        <option value={0}>No score</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={incident} onChange={(e) => setIncident(e.target.checked)} /> Incident
      </label>
      {incident && (
        <input placeholder="Incident notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-black/20 dark:border-white/20 rounded text-xs px-1 py-0.5 w-full" />
      )}
      <div className="flex gap-1">
        <button onClick={save} disabled={saving} className="text-xs bg-black text-white dark:bg-white dark:text-black rounded px-2 py-0.5">{saving ? '…' : 'Save'}</button>
        <button onClick={() => setOpen(false)} className="text-xs underline">Cancel</button>
      </div>
    </div>
  );
}
