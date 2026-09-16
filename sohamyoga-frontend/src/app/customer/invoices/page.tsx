'use client';
// /customer/invoices — real, read-only view of invoice_mirror (synced from
// ERPNext). Previously dead schema with no customer-facing page anywhere.

import { useEffect, useState } from 'react';

interface Invoice { id: string; invoice_number: string; status: string; amount_cad: string; tax_cad: string; total_cad: string; description: string | null; due_date: string | null; paid_at: string | null }

const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-500/20 text-green-300', overdue: 'bg-red-500/20 text-red-300', submitted: 'bg-amber-500/20 text-amber-300',
  draft: 'bg-white/10 text-white/70', cancelled: 'bg-white/10 text-white/50',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/customer/invoices', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setInvoices(d.invoices ?? []))
      .catch(() => setError('Failed to load invoices. Please refresh.'));
  }, []);

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoices & Billing</h1>
        <p className="mt-1 text-sm text-white/60">Synced from our billing system.</p>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-900/20 rounded p-2">{error}</p>}
      <div className="space-y-2 text-white">
        {invoices?.map(inv => (
          <div key={inv.invoice_number} className="rounded-lg border border-white/20 backdrop-blur-md bg-white/10 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{inv.invoice_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[inv.status] ?? 'bg-white/10'}`}>{inv.status}</span>
            </div>
            {inv.description && <p className="mt-1 text-white/70">{inv.description}</p>}
            <div className="mt-1 flex items-center justify-between text-xs text-white/60">
              <span>{inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : ''}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-800">${inv.total_cad} CAD</span>
                <a href={`/api/customer/invoices/pdf?id=${inv.id}`} className="text-blue-600 underline">⬇ PDF</a>
              </div>
            </div>
          </div>
        ))}
        {invoices && !invoices.length && <p className="text-sm text-white/50">No invoices yet.</p>}
        {!invoices && !error && <p className="text-sm text-white/50">Loading…</p>}
      </div>
    </div>
  );
}
