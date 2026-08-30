'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SERVICE_TYPES = ['dental', 'chiropractic', 'physiotherapy', 'ent', 'massage_therapy'];

export default function NewScriptPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState('dental');
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
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          serviceType,
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
        setError(body.error ?? 'Could not create script.');
        return;
      }
      router.push(`/admin/scripts/${body.script.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New call script</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug *</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Service type *</label>
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Opening *</label>
          <textarea required value={opening} onChange={(e) => setOpening(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Discovery questions (one per line)</label>
          <textarea value={discoveryQuestions} onChange={(e) => setDiscoveryQuestions(e.target.value)} rows={4} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Objection handling</label>
          <textarea value={objectionHandling} onChange={(e) => setObjectionHandling(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Closing *</label>
          <textarea required value={closing} onChange={(e) => setClosing(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : 'Create script (draft v1)'}
        </button>
      </form>
    </div>
  );
}
