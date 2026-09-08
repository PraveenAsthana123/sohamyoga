'use client';
// /customer/profile — real address book management (customer_address).
// Previously dead schema with zero customer-facing wiring anywhere.

import { useEffect, useState } from 'react';

interface Address { id: string; label: string; line1: string; line2: string | null; city: string; state: string | null; postal_code: string | null; country: string }

export default function ProfilePage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ label: 'Home', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'CA' });

  const load = () => fetch('/api/customer/address', { cache: 'no-store' }).then(r => r.json()).then(d => setAddresses(d.addresses ?? []));
  useEffect(() => { load() }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/customer/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ label: 'Home', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'CA' });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/customer/address?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile & Addresses</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your saved addresses.</p>
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-xl border border-gray-200 bg-white p-5">
        <input placeholder="Label (e.g. Home)" className="w-full rounded border p-2 text-sm" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        <input required placeholder="Address line 1" className="w-full rounded border p-2 text-sm" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} />
        <input placeholder="Address line 2 (optional)" className="w-full rounded border p-2 text-sm" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="City" className="rounded border p-2 text-sm" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Province/State" className="rounded border p-2 text-sm" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Postal code" className="rounded border p-2 text-sm" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
          <input placeholder="Country (2-letter)" maxLength={2} className="rounded border p-2 text-sm" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
        </div>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Add address</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        {addresses.map(a => (
          <div key={a.id} className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div>
              <span className="font-medium">{a.label}</span>
              <p className="text-gray-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}{a.state ? `, ${a.state}` : ''} {a.postal_code ?? ''} {a.country}</p>
            </div>
            <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ))}
        {!addresses.length && <p className="text-sm text-gray-400">No addresses saved yet.</p>}
      </div>
    </div>
  );
}
