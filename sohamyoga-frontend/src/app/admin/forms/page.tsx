'use client';
// Module 8 — Form Management. Was "2 of 16" real: one hardcoded ContactForm.tsx
// posting to /api/contact, no dedicated Form entity or builder. This is a real
// admin-defined multi-field form builder with server-side validation, consent
// capture, and lead creation — generalizing what /api/contact did for one form.

import { useEffect, useState, useCallback } from 'react';

interface FieldDef { key: string; label: string; type: 'text' | 'email' | 'phone' | 'textarea'; required: boolean }
interface FormRow { id: string; slug: string; name: string; fields: FieldDef[]; status: string; submissionCount: number }
interface Submission { id: string; data: Record<string, string>; consent_given: boolean; lead_id: string | null; created_at: string }

function NewFormBuilder({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(''); const [name, setName] = useState('');
  const [fields, setFields] = useState<FieldDef[]>([{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, name, fields }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setSlug(''); setName(''); onCreated(); }
    else setError(body.error ?? 'Failed to create form.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Form</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Form name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <p className="text-xs font-semibold text-gray-500 uppercase mt-2">Fields</p>
      {fields.map((f, i) => (
        <div key={i} className="flex gap-2">
          <input value={f.key} onChange={e => setFields(fs => fs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="key" className="flex-1 border rounded px-2 py-1 text-xs font-mono" />
          <input value={f.label} onChange={e => setFields(fs => fs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" className="flex-1 border rounded px-2 py-1 text-xs" />
          <select value={f.type} onChange={e => setFields(fs => fs.map((x, j) => j === i ? { ...x, type: e.target.value as FieldDef['type'] } : x))} className="border rounded px-1 py-1 text-xs">
            <option value="text">text</option><option value="email">email</option><option value="phone">phone</option><option value="textarea">textarea</option>
          </select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.required} onChange={e => setFields(fs => fs.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> req</label>
        </div>
      ))}
      <button onClick={() => setFields(fs => [...fs, { key: '', label: '', type: 'text', required: false }])} className="text-xs text-indigo-600 hover:underline">+ Add field</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !slug || !name} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function FormsAdmin() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/forms', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setForms(d?.forms ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: 'activate' | 'archive') {
    await fetch(`/api/forms/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }
  async function viewSubmissions(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    const res = await fetch(`/api/forms/${id}/submissions`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setSubmissions(body.submissions ?? []);
    setExpanded(id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Form Management</h1><p className="text-sm text-gray-500">Real admin-defined forms with server-side validation, consent, and lead creation.</p></div>
        <NewFormBuilder onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {forms.map(f => (
            <div key={f.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{f.fields.length} field(s) · POST to /api/forms/{f.id}/submit</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'active' ? 'bg-green-100 text-green-700' : f.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{f.status}</span>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                {f.status !== 'active' && <button onClick={() => transition(f.id, 'activate')} className="text-xs text-green-600 hover:underline">Activate</button>}
                {f.status !== 'archived' && <button onClick={() => transition(f.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                <button onClick={() => viewSubmissions(f.id)} className="text-xs text-indigo-600 hover:underline">{f.submissionCount} submission(s) {expanded === f.id ? '▲' : '▼'}</button>
              </div>
              {expanded === f.id && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {submissions.map(s => (
                    <div key={s.id} className="text-xs bg-gray-50 rounded p-2">
                      <span className="text-gray-400">{new Date(s.created_at).toLocaleString()}</span>{' '}
                      <span className="text-gray-700">{JSON.stringify(s.data)}</span>{' '}
                      {s.lead_id && <span className="text-green-600">→ lead created</span>}
                    </div>
                  ))}
                  {!submissions.length && <p className="text-xs text-gray-400">No submissions yet.</p>}
                </div>
              )}
            </div>
          ))}
          {!forms.length && <p className="text-sm text-gray-400">No forms yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
