'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewDraftVersionForm({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState('');
  const [discoveryQuestions, setDiscoveryQuestions] = useState('');
  const [objectionHandling, setObjectionHandling] = useState('');
  const [closing, setClosing] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: {
            opening,
            discoveryQuestions: discoveryQuestions.split('\n').map((q) => q.trim()).filter(Boolean),
            objectionHandling,
            closing,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not create version.');
        return;
      }
      setOpen(false);
      setOpening('');
      setDiscoveryQuestions('');
      setObjectionHandling('');
      setClosing('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm underline">
        + Add new draft version
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-black/10 dark:border-white/10 rounded-lg p-4">
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <h3 className="font-medium text-sm">New draft version</h3>
      <div className="space-y-1">
        <label className="text-sm font-medium">Opening *</label>
        <textarea required value={opening} onChange={(e) => setOpening(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Discovery questions (one per line)</label>
        <textarea value={discoveryQuestions} onChange={(e) => setDiscoveryQuestions(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Objection handling</label>
        <textarea value={objectionHandling} onChange={(e) => setObjectionHandling(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Closing *</label>
        <textarea required value={closing} onChange={(e) => setClosing(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">Cancel</button>
      </div>
    </form>
  );
}
