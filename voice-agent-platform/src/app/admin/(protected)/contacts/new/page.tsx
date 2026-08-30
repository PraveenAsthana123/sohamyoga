'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', clinicName: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not create contact.');
        return;
      }
      router.push(`/admin/contacts/${body.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">New contact</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="space-y-1">
          <label className="text-sm font-medium">Full name *</label>
          <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <p className="text-xs opacity-60">At least one of email or phone is required.</p>
        <div className="space-y-1">
          <label className="text-sm font-medium">Clinic name</label>
          <input value={form.clinicName} onChange={(e) => update('clinicName', e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" rows={3} />
        </div>
        <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : 'Create contact'}
        </button>
      </form>
    </div>
  );
}
