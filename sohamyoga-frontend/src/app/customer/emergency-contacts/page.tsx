'use client';
// /customer/emergency-contacts — real student_guardian CRUD.

import { useEffect, useState } from 'react';

interface Contact { id: string; guardian_name: string; relationship: string; phone: string | null; email: string | null; is_emergency: boolean }

const RELATIONSHIPS = ['parent', 'legal_guardian', 'spouse', 'other'];

export default function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hasStudentRecord, setHasStudentRecord] = useState(true);
  const [form, setForm] = useState({ guardianName: '', relationship: 'other', phone: '', email: '', isEmergency: true });
  const [error, setError] = useState('');

  const load = () => fetch('/api/customer/emergency-contacts', { cache: 'no-store' }).then(r => r.json()).then(d => {
    setContacts(d.contacts ?? []); setHasStudentRecord(d.hasStudentRecord);
  });
  useEffect(() => { load() }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/customer/emergency-contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ guardianName: '', relationship: 'other', phone: '', email: '', isEmergency: true });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/customer/emergency-contacts?id=${id}`, { method: 'DELETE' });
    load();
  }

  if (!hasStudentRecord) return <p className="text-sm text-gray-500">Emergency contacts are available once you're enrolled in a class.</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Emergency Contacts</h1>
        <p className="mt-1 text-sm text-gray-500">Who should we contact if there's an emergency during class?</p>
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-xl border border-gray-200 bg-white p-5">
        <input required placeholder="Full name" className="w-full rounded border p-2 text-sm" value={form.guardianName} onChange={e => setForm({ ...form, guardianName: e.target.value })} />
        <select className="w-full rounded border p-2 text-sm" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Phone" className="rounded border p-2 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" className="rounded border p-2 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isEmergency} onChange={e => setForm({ ...form, isEmergency: e.target.checked })} /> Primary emergency contact</label>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Add contact</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        {contacts.map(c => (
          <div key={c.id} className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div>
              <span className="font-medium">{c.guardian_name}</span>
              {c.is_emergency && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Primary</span>}
              <p className="text-xs text-gray-500 capitalize">{c.relationship.replaceAll('_', ' ')}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}</p>
            </div>
            <button onClick={() => remove(c.id)} className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ))}
        {!contacts.length && <p className="text-sm text-gray-400">No emergency contacts on file.</p>}
      </div>
    </div>
  );
}
