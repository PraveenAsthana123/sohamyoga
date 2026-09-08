'use client';
// /customer/support — real support ticket creation/tracking (support_ticket).
// Previously dead schema with no customer-facing page anywhere.

import { useEffect, useState } from 'react';

interface Ticket { id: string; subject: string; category: string; priority: string; status: string; created_at: string }

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Billing', class_change: 'Class change', complaint: 'Complaint', health_concern: 'Health concern', general: 'General', technical: 'Technical',
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ subject: '', category: 'general' });
  const [error, setError] = useState('');

  const load = () => fetch('/api/customer/support-tickets', { cache: 'no-store' }).then(r => r.json()).then(d => { setTickets(d.tickets ?? []); setCategories(d.categories ?? []); });
  useEffect(() => { load() }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/customer/support-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ subject: '', category: 'general' });
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="mt-1 text-sm text-gray-500">Open a ticket and our team will follow up.</p>
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-xl border border-gray-200 bg-white p-5">
        <input required placeholder="What's this about?" className="w-full rounded border p-2 text-sm" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
        <select className="w-full rounded border p-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
        </select>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Open ticket</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        {tickets.map(t => (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.subject}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{t.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{CATEGORY_LABELS[t.category] ?? t.category} · {new Date(t.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {!tickets.length && <p className="text-sm text-gray-400">No support tickets yet.</p>}
      </div>
    </div>
  );
}
