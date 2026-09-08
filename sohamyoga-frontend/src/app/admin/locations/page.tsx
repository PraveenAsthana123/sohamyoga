'use client';
// Real Multi-Location Management -- CRUD over the `branch` table, the same
// table Schema Generator and the Local SEO checker read from (and honestly
// reported as empty). This is where NAP (name/address/phone) data actually
// gets entered so those other tools stop showing "missing" for it.

import { useState, useEffect } from 'react';

interface Location {
  id: string; name: string; type: string; status: string;
  addressLine1: string; addressLine2: string | null; city: string; state: string; country: string;
  postalCode: string; phone: string | null; email: string | null; timezone: string; maxCapacity: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending_setup: 'bg-gray-100 text-gray-700', active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-amber-100 text-amber-700', suspended: 'bg-red-100 text-red-700',
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'corporate_owned', addressLine1: '', addressLine2: '', city: '', state: '',
    country: 'CA', postalCode: '', phone: '', email: '', timezone: 'America/Edmonton', maxCapacity: 20,
  });

  function load() {
    setLoading(true);
    fetch('/api/admin/locations').then((r) => r.json()).then((d) => { setLocations(d.locations ?? []); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setError('');
    const res = await fetch('/api/admin/locations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setOpen(false);
    load();
  }

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/admin/locations/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Multi-Location Management</h1>
          <p className="text-sm text-gray-500">Real branch/location records -- feeds Schema Generator, Local SEO Checker, and NAP consistency checks directly.</p>
        </div>
        <button onClick={() => setOpen(true)} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">+ Add location</button>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : locations.length === 0 ? (
        <p className="text-sm text-gray-400">No locations yet -- this is why Schema Generator and Local SEO Checker report address/phone as missing.</p>
      ) : (
        <div className="space-y-2">
          {locations.map((l) => (
            <div key={l.id} className="rounded-xl border bg-white p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{l.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[l.status]}`}>{l.status}</span></div>
                <div className="text-sm text-gray-500">{l.addressLine1}{l.addressLine2 ? `, ${l.addressLine2}` : ''}, {l.city}, {l.state} {l.postalCode}, {l.country}</div>
                {l.phone && <div className="text-sm text-gray-500">{l.phone}</div>}
              </div>
              <select value={l.status} onChange={(e) => changeStatus(l.id, e.target.value)} className="rounded border p-1 text-sm">
                {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="rounded-xl border bg-white p-5 space-y-2 max-w-lg">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input placeholder="Location name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className="rounded border p-2 text-sm" />
            <input placeholder="Address line 2 (optional)" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded border p-2 text-sm" />
            <input placeholder="State/Province" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="rounded border p-2 text-sm" />
            <input placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded border p-2 text-sm" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          <input type="number" placeholder="Max capacity" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })} className="w-full rounded border p-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => void create()} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Save</button>
            <button onClick={() => setOpen(false)} className="text-sm underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
