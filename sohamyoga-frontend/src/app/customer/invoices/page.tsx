'use client';
// /customer/invoices — real, read-only view of invoice_mirror (synced from
// ERPNext). Previously dead schema with no customer-facing page anywhere.

import { useEffect, useState } from 'react';

interface Invoice { id: string; invoice_number: string; status: string; amount_cad: string; tax_cad: string; total_cad: string; description: string | null; due_date: string | null; paid_at: string | null }

const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700', submitted: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-400',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    fetch('/api/customer/invoices', { cache: 'no-store' }).then(r => r.json()).then(d => setInvoices(d.invoices ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices & Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Synced from our billing system.</p>
      </div>
      <div className="space-y-2">
        {invoices?.map(inv => (
          <div key={inv.invoice_number} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{inv.invoice_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[inv.status] ?? 'bg-gray-100'}`}>{inv.status}</span>
            </div>
            <p className="mt-1 text-gray-600">{inv.description}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : ''}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-800">${inv.total_cad} CAD</span>
                <a href={`/api/customer/invoices/pdf?id=${inv.id}`} className="text-blue-600 underline">⬇ PDF</a>
              </div>
            </div>
          </div>
        ))}
        {invoices && !invoices.length && <p className="text-sm text-gray-400">No invoices yet.</p>}
        {!invoices && <p className="text-sm text-gray-400">Loading…</p>}
      </div>
    </div>
  );
}
