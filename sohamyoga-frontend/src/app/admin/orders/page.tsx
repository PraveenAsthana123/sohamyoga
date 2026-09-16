'use client';

import { useEffect, useState, useCallback } from 'react';

interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total: number;
  currency: string;
  refund_amount: number;
  created_at: string;
}

interface StatusSummary { status: string; count: number; revenue: number }
interface Kpi { totalOrders: number; revenue30d: number; pending: number; avgOrderValue: number }

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700', processing: 'bg-indigo-100 text-indigo-700',
  partially_shipped: 'bg-purple-100 text-purple-700', shipped: 'bg-teal-100 text-teal-700',
  delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-red-50 text-red-600', returned: 'bg-orange-100 text-orange-700',
};

const NEXT_STATUS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'], pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'], processing: ['partially_shipped', 'shipped', 'cancelled'],
  partially_shipped: ['shipped', 'cancelled'], shipped: ['delivered'],
  delivered: ['returned'], cancelled: [], refunded: [], returned: ['refunded'],
};

const TABS = ['Overview', 'All Orders', 'Pending', 'Fulfilled', 'Refunds'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setStatusSummary(data.statusSummary ?? []);
      setKpi(data.kpi ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function transition(id: string, status: string, order?: Order) {
    let body: Record<string, unknown> = { status };
    if (status === 'refunded') {
      const amountStr = window.prompt(`Refund amount (max ${order?.total ?? 0} ${order?.currency ?? ''}):`, String(order?.total ?? ''));
      if (amountStr === null) return;
      const reason = window.prompt('Refund reason:');
      if (reason === null || !reason.trim()) return;
      body = { status, refundAmount: Number(amountStr), refundReason: reason.trim() };
    } else if (status === 'shipped' || status === 'partially_shipped') {
      const trackingNumber = window.prompt('Tracking number (leave blank if fully digital):');
      if (trackingNumber === null) return;
      if (trackingNumber.trim()) {
        const carrier = window.prompt('Carrier:');
        if (carrier === null || !carrier.trim()) return;
        body = { status, trackingNumber: trackingNumber.trim(), carrier: carrier.trim() };
      }
    }
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); window.alert(err.error || 'Transition failed.'); }
    await load();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markPaid: true }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); window.alert(err.error || 'Could not mark paid.'); }
    await load();
  }

  const displayed = orders.filter(o => {
    if (tab === 'Pending') return o.status === 'pending' || o.status === 'confirmed' || o.status === 'processing';
    if (tab === 'Fulfilled') return o.status === 'delivered' || o.status === 'shipped';
    if (tab === 'Refunds') return o.status === 'refunded' || o.status === 'returned';
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
        <p className="text-gray-500 text-sm mt-1">Live sales_order state machine — draft through delivered, refunded, returned.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Orders" value={kpi.totalOrders} />
          <KpiCard label="Revenue (30d)" value={`$${kpi.revenue30d.toFixed(2)}`} sub="CAD" />
          <KpiCard label="Pending" value={kpi.pending} sub="awaiting confirmation" />
          <KpiCard label="Avg Order Value" value={`$${kpi.avgOrderValue.toFixed(2)}`} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' ? (
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Orders by Status</h3>
            <div className="space-y-3">
              {statusSummary.map(s => (
                <div key={s.status} className="flex items-center gap-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium w-28 text-center ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {s.status.replaceAll('_', ' ')}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${kpi?.totalOrders ? (s.count / kpi.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-700 w-8 text-right">{s.count}</span>
                  <span className="text-xs text-gray-400 w-20 text-right">${s.revenue.toFixed(2)}</span>
                </div>
              ))}
              {statusSummary.length === 0 && <p className="text-gray-400 text-sm">No orders yet.</p>}
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : displayed.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No orders in this category.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">Order #</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(o => (
                      <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.order_number}</td>
                        <td className="px-4 py-3 text-gray-800">{o.customer_email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {o.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{o.payment_status}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{o.currency} {o.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {(NEXT_STATUS[o.status] ?? []).map(s => (
                              <button key={s} onClick={() => transition(o.id, s, o)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                                {s.replaceAll('_', ' ')}
                              </button>
                            ))}
                            {['pending', 'partially_paid'].includes(o.payment_status) && (
                              <button onClick={() => markPaid(o.id)} className="text-xs text-green-600 hover:underline">mark paid</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
