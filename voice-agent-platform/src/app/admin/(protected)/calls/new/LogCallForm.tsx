'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ContactOption { id: string; fullName: string; }
interface VersionOption { versionId: string; scriptName: string; versionNumber: number; }

const DIRECTIONS = ['inbound', 'outbound'];
const STATUSES = ['queued', 'in_progress', 'completed', 'failed', 'no_answer'];

export default function LogCallForm({ contacts, versions }: { contacts: ContactOption[]; versions: VersionOption[] }) {
  const router = useRouter();
  const [direction, setDirection] = useState('outbound');
  const [status, setStatus] = useState('completed');
  const [contactId, setContactId] = useState('');
  const [scriptVersionId, setScriptVersionId] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          status,
          contactId: contactId || null,
          scriptVersionId: scriptVersionId || null,
          durationSeconds: durationSeconds ? Number(durationSeconds) : null,
          outcomeNotes: outcomeNotes || null,
          startedAt: new Date().toISOString(),
          endedAt: status === 'completed' || status === 'failed' || status === 'no_answer' ? new Date().toISOString() : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not log call.');
        return;
      }
      router.push('/admin/calls');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Direction</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
            {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Contact</label>
        <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent">
          <option value="">— none —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Script version used</label>
        <select value={scriptVersionId} onChange={(e) => setScriptVersionId(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent">
          <option value="">— none —</option>
          {versions.map((v) => <option key={v.versionId} value={v.versionId}>{v.scriptName} (v{v.versionNumber})</option>)}
        </select>
        {versions.length === 0 && <p className="text-xs opacity-60">No published scripts yet.</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Duration (seconds)</label>
        <input type="number" min="0" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Outcome notes</label>
        <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">
        {submitting ? 'Saving…' : 'Log call'}
      </button>
    </form>
  );
}
