'use client';
// Real admin billing management for invoice_mirror. Previously zero admin
// surface existed anywhere, and no real ERPNext sync job exists in this
// codebase despite the schema comment claiming one -- this is, honestly,
// the only real way an invoice gets created today (2026-09-01 gap audit).

import { useEffect, useState } from 'react';

interface Customer { id: string; display_name: string; email: string }
interface Invoice {
  id: string; customer_id: string; customer_name: string; invoice_number: string; status: string;
  amount_cad: string; tax_cad: string; total_cad: string; description: string | null; due_date: string | null; paid_at: string | null;
}

const STATUSES = ['draft', 'submitted', 'paid', 'overdue', 'cancelled'];
const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700', submitted: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-400',
};

export default function AdminBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ customerId: '', amountCad: '', description: '', dueDate: '' });

  const load = () => fetch('/api/admin/invoices', { cache: 'no-store' }).then(r => r.json()).then(d => setInvoices(d.invoices ?? []));
  useEffect(() => {
    load();
    fetch('/api/admin/customers', { cache: 'no-store' }).then(r => r.json()).then(d => setCustomers(d.customers ?? []));
  }, []);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amountCad: Number(form.amountCad) }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ customerId: '', amountCad: '', description: '', dueDate: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    await fetch('/api/admin/invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <p className="mt-1 text-sm text-gray-500">Real invoice_mirror management. Reflected live on the customer's /customer/invoices page (with real PDF download).</p>
      </header>

      <form onSubmit={createInvoice} className="app-card space-y-3">
        <h2 className="font-semibold text-gray-800">New invoice</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select required className="rounded border p-2 text-sm" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.display_name} ({c.email})</option>)}
          </select>
          <input required type="number" step="0.01" placeholder="Amount (CAD, before tax)" className="rounded border p-2 text-sm" value={form.amountCad} onChange={e => setForm({ ...form, amountCad: e.target.value })} />
        </div>
        <input placeholder="Description" className="w-full rounded border p-2 text-sm" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <input type="date" className="rounded border p-2 text-sm" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Create invoice (13% tax auto-calculated)</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="app-card">
        <h2 className="mb-3 font-semibold text-gray-800">All invoices ({invoices.length})</h2>
        <div className="space-y-2">
          {invoices.map(inv => (
            <div key={inv.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{inv.invoice_number} — {inv.customer_name}</span>
                <select value={inv.status} onChange={e => setStatus(inv.id, e.target.value)} className={`rounded-full border-0 px-2 py-0.5 text-xs ${STATUS_COLOR[inv.status]}`}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="mt-1 text-gray-600">{inv.description}</p>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : ''}</span>
                <span className="font-medium text-gray-800">${inv.total_cad} CAD</span>
              </div>
            </div>
          ))}
          {!invoices.length && <p className="text-sm text-gray-400">No invoices yet.</p>}
        </div>
      </div>
    </div>
  );
}
