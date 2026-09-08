'use client';
// Real admin/CRM inbox for support_ticket. Previously zero admin surface
// existed anywhere (found live during the 2026-09-01 admin-panel gap
// audit) -- a ticket a customer filed went into a void no staff could see.
// Note: support_ticket has no description/body column in the current
// schema, only subject/category -- this view reflects that real limitation
// rather than inventing a message field that doesn't exist.

import { useEffect, useState } from 'react';

interface Ticket {
  id: string; customer_name: string; customer_email: string; subject: string; category: string;
  priority: string; status: string; first_response_at: string | null; resolved_at: string | null; created_at: string;
}

const STATUSES = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLOR: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' };
const STATUS_COLOR: Record<string, string> = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-purple-100 text-purple-700', pending_customer: 'bg-amber-100 text-amber-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500' };

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const load = () => { fetch('/api/admin/support-tickets', { cache: 'no-store' }).then(r => r.json()).then(d => setTickets(d.tickets ?? [])); };
  useEffect(load, []);

  async function update(id: string, patch: { status?: string; priority?: string }) {
    await fetch('/api/admin/support-tickets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    load();
  }

  const open = tickets.filter(t => ['open', 'in_progress', 'pending_customer'].includes(t.status));
  const closed = tickets.filter(t => !['open', 'in_progress', 'pending_customer'].includes(t.status));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="mt-1 text-sm text-gray-500">Real customer-filed tickets (support_ticket). Reflected live back on the customer's /customer/support page.</p>
      </header>

      <div className="app-card">
        <h2 className="mb-3 font-semibold text-gray-800">Open ({open.length})</h2>
        <div className="space-y-2">
          {open.map(t => <TicketRow key={t.id} t={t} onUpdate={update} />)}
          {!open.length && <p className="text-sm text-gray-400">No open tickets.</p>}
        </div>
      </div>

      <div className="app-card">
        <h2 className="mb-3 font-semibold text-gray-800">Resolved / Closed ({closed.length})</h2>
        <div className="space-y-2">
          {closed.map(t => <TicketRow key={t.id} t={t} onUpdate={update} />)}
          {!closed.length && <p className="text-sm text-gray-400">None yet.</p>}
        </div>
      </div>
    </div>
  );
}

function TicketRow({ t, onUpdate }: { t: Ticket; onUpdate: (id: string, patch: { status?: string; priority?: string }) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{t.subject}</span>
        <div className="flex gap-2">
          <select value={t.priority} onChange={e => onUpdate(t.id, { priority: e.target.value })} className={`rounded-full border-0 px-2 py-0.5 text-xs ${PRIORITY_COLOR[t.priority]}`}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={t.status} onChange={e => onUpdate(t.id, { status: e.target.value })} className={`rounded-full border-0 px-2 py-0.5 text-xs ${STATUS_COLOR[t.status]}`}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">{t.customer_name} ({t.customer_email}) · {t.category.replace('_', ' ')} · {new Date(t.created_at).toLocaleDateString()}</p>
    </div>
  );
}
