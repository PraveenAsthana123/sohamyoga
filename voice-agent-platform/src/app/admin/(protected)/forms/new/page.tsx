'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select';

interface FieldDraft {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'textarea', 'select'];

function emptyField(): FieldDraft {
  return { key: '', label: '', type: 'text', required: false };
}

export default function NewFormPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState('Thank you — we will be in touch shortly.');
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'phone', label: 'Phone', type: 'phone', required: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((fs) => fs.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, description, successMessage, fields }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not create form.');
        return;
      }
      router.push(`/admin/forms/${body.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New form</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug *</label>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="e.g. dental-intake"
              className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Success message</label>
          <input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Fields</h2>
            <button type="button" onClick={() => setFields((fs) => [...fs, emptyField()])} className="text-sm underline">
              + Add field
            </button>
          </div>
          {fields.map((field, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center border border-black/10 dark:border-white/10 rounded p-2">
              <input
                placeholder="key (e.g. full_name)"
                value={field.key}
                onChange={(e) => updateField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className="col-span-3 border border-black/20 dark:border-white/20 rounded px-2 py-1 bg-transparent text-sm font-mono"
              />
              <input
                placeholder="Label"
                value={field.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                className="col-span-4 border border-black/20 dark:border-white/20 rounded px-2 py-1 bg-transparent text-sm"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                className="col-span-2 border border-black/20 dark:border-white/20 rounded px-2 py-1 bg-transparent text-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="col-span-2 flex items-center gap-1 text-xs">
                <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                required
              </label>
              <button type="button" onClick={() => removeField(i)} className="col-span-1 text-xs text-red-600">
                remove
              </button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : 'Create form (draft)'}
        </button>
      </form>
    </div>
  );
}
