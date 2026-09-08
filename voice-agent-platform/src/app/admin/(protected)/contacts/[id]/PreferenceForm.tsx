'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Preference {
  id: string;
  preferredStyle: string | null;
  experienceLevel: string | null;
  preferredTime: string | null;
  sessionLengthMinutes: number | null;
  classesPerWeek: number | null;
  budgetAmount: number | null;
  budgetPeriod: string | null;
  physicalNotes: string | null;
  collectedBy: string;
  createdAt: string;
}

/** Admin-entered only -- there is no transcript-parsing/NLP extraction in
 * this codebase. An admin listens to or reads a real survey call
 * (yoga_needs_survey or similar) and records what the customer actually
 * said here, same discipline as QualityReviewCell's human QA scores. */
export default function PreferenceForm({ contactId, existing }: { contactId: string; existing: Preference[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    preferredStyle: '', experienceLevel: '', preferredTime: '',
    sessionLengthMinutes: '', classesPerWeek: '', budgetAmount: '', budgetPeriod: '', physicalNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/contacts/${contactId}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferredStyle: form.preferredStyle || undefined,
        experienceLevel: form.experienceLevel || undefined,
        preferredTime: form.preferredTime || undefined,
        sessionLengthMinutes: form.sessionLengthMinutes ? Number(form.sessionLengthMinutes) : undefined,
        classesPerWeek: form.classesPerWeek ? Number(form.classesPerWeek) : undefined,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        budgetPeriod: form.budgetPeriod || undefined,
        physicalNotes: form.physicalNotes || undefined,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error ?? 'Could not save.'); return; }
    setOpen(false);
    setForm({ preferredStyle: '', experienceLevel: '', preferredTime: '', sessionLengthMinutes: '', classesPerWeek: '', budgetAmount: '', budgetPeriod: '', physicalNotes: '' });
    router.refresh();
  }

  return (
    <div className="space-y-2 border border-black/10 dark:border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Customer preferences (from a real survey call)</label>
        {!open && <button onClick={() => setOpen(true)} className="text-xs underline">+ Record from a call</button>}
      </div>

      {existing.length === 0 && !open && <p className="text-xs opacity-50">No preferences recorded yet.</p>}

      {existing.map((p) => (
        <div key={p.id} className="text-xs border border-black/10 dark:border-white/10 rounded p-2 space-y-0.5">
          <div className="flex justify-between opacity-60"><span>{new Date(p.createdAt).toLocaleString()}</span><span>by {p.collectedBy}</span></div>
          {p.preferredStyle && <div>Style: <strong>{p.preferredStyle}</strong></div>}
          {p.experienceLevel && <div>Level: <strong>{p.experienceLevel}</strong></div>}
          {p.preferredTime && <div>Preferred time: <strong>{p.preferredTime}</strong></div>}
          {p.sessionLengthMinutes && <div>Session length: <strong>{p.sessionLengthMinutes} min</strong></div>}
          {p.classesPerWeek !== null && <div>Classes/week: <strong>{p.classesPerWeek}</strong></div>}
          {p.budgetAmount !== null && <div>Budget: <strong>${p.budgetAmount.toFixed(2)} {p.budgetPeriod === 'monthly' ? '/month' : '/class'}</strong></div>}
          {p.physicalNotes && <div>Notes: {p.physicalNotes}</div>}
        </div>
      ))}

      {open && (
        <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
          <input placeholder="Preferred style (e.g. Vinyasa)" value={form.preferredStyle} onChange={(e) => setForm({ ...form, preferredStyle: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm">
              <option value="">Experience level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm">
              <option value="">Preferred time</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Session length (min)" value={form.sessionLengthMinutes} onChange={(e) => setForm({ ...form, sessionLengthMinutes: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <input type="number" placeholder="Classes per week" value={form.classesPerWeek} onChange={(e) => setForm({ ...form, classesPerWeek: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Budget amount" value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <select value={form.budgetPeriod} onChange={(e) => setForm({ ...form, budgetPeriod: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm">
              <option value="">Budget period</option>
              <option value="per_class">Per class</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <input placeholder="Physical notes / injuries (as stated by customer)" value={form.physicalNotes} onChange={(e) => setForm({ ...form, physicalNotes: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="text-xs bg-black text-white dark:bg-white dark:text-black rounded px-3 py-1 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setOpen(false)} className="text-xs underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
