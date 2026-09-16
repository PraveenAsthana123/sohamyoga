'use client';

import { useCallback, useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

interface Ticket {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  csat_score: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface Summary {
  total: number;
  open: number;
  in_progress: number;
  resolved_today: number;
  avg_resolution_hours: number | null;
}

type TabKey = 'All Tickets' | 'Open' | 'Resolved' | 'Escalated' | 'Metrics';
const TABS: TabKey[] = ['All Tickets', 'Open', 'Resolved', 'Escalated', 'Metrics'];

const STATUSES = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  pending_customer: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function TicketTable({
  tickets,
  onUpdate,
}: {
  tickets: Ticket[];
  onUpdate: (id: string, patch: { status?: string; priority?: string }) => void;
}) {
  if (!tickets.length)
    return <p className="py-6 text-center text-sm text-gray-400">No tickets in this view.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {['Subject', 'Customer', 'Category', 'Priority', 'Status', 'CSAT', 'Created'].map((h) => (
              <th key={h} className="px-3 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="max-w-xs truncate px-3 py-2 font-medium text-gray-800">{t.subject}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-700">{t.customer_name}</div>
                <div className="text-xs text-gray-400">{t.customer_email}</div>
              </td>
              <td className="px-3 py-2 text-gray-500">{t.category.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2">
                <select
                  value={t.priority}
                  onChange={(e) => onUpdate(t.id, { priority: e.target.value })}
                  className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[t.priority] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <select
                  value={t.status}
                  onChange={(e) => onUpdate(t.id, { status: e.target.value })}
                  className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-gray-500">{t.csat_score ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminSupportTicketsPage() {
  const [tab, setTab] = useState<TabKey>('All Tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/support-tickets', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTickets(data.tickets ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (id: string, patch: { status?: string; priority?: string }) => {
      await fetch('/api/admin/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      load();
    },
    [load],
  );

  const open = tickets.filter((t) => ['open', 'in_progress', 'pending_customer'].includes(t.status));
  const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
  const escalated = tickets.filter((t) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');

  const resolvedToday = resolved.filter((t) => {
    if (!t.resolved_at) return false;
    const d = new Date(t.resolved_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const resolutionTimes = resolved
    .filter((t) => t.resolved_at)
    .map((t) => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000);
  const avgResolutionHours =
    resolutionTimes.length ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) : null;

  const summary: Summary = {
    total: tickets.length,
    open: open.length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved_today: resolvedToday,
    avg_resolution_hours: avgResolutionHours,
  };

  const tabTickets: Record<TabKey, Ticket[]> = {
    'All Tickets': tickets,
    Open: open,
    Resolved: resolved,
    Escalated: escalated,
    Metrics: [],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Real customer-filed tickets from support_ticket. Staff inbox — changes reflect live on customer portal.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Tickets" value={summary.total} color="blue" />
          <KpiCard label="Open / In Progress" value={summary.open} color="amber" />
          <KpiCard label="Resolved Today" value={summary.resolved_today} color="green" />
          <KpiCard
            label="Avg Resolution"
            value={summary.avg_resolution_hours !== null ? `${summary.avg_resolution_hours}h` : '—'}
            sub="hours, resolved tickets"
            color="blue"
          />
        </div>

        <div className="border-b flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
              {t !== 'Metrics' && (
                <span className="ml-1 text-xs text-gray-400">({tabTickets[t].length})</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading tickets…</div>
        ) : tab === 'Metrics' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">By Status</h3>
              {STATUSES.map((s) => {
                const count = tickets.filter((t) => t.status === s).length;
                return (
                  <div key={s} className="mb-2 flex items-center justify-between text-sm">
                    <Badge label={s} colorClass={STATUS_COLOR[s] ?? 'bg-gray-100 text-gray-600'} />
                    <span className="font-medium text-gray-700">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-800">By Priority</h3>
              {PRIORITIES.map((p) => {
                const count = tickets.filter((t) => t.priority === p).length;
                return (
                  <div key={p} className="mb-2 flex items-center justify-between text-sm">
                    <Badge label={p} colorClass={PRIORITY_COLOR[p] ?? 'bg-gray-100 text-gray-600'} />
                    <span className="font-medium text-gray-700">{count}</span>
                  </div>
                );
              })}
              {avgResolutionHours !== null && (
                <p className="mt-4 text-xs text-gray-500">
                  Average resolution time across {resolved.length} resolved tickets: {avgResolutionHours}h
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-white shadow-sm">
            <TicketTable tickets={tabTickets[tab]} onUpdate={update} />
          </div>
        )}
      </div>
    </div>
  );
}
