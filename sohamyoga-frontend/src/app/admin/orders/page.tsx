'use client';
// Real Order Management -- the sales_order table already had a rich real
// state machine (status/payment_status/fulfillment_status) but no admin
// page existed anywhere to view or transition orders. First real build.

import { useEffect, useState } from 'react';

interface Order {
  id: string; orderNumber: string; customerEmail: string; status: string; paymentStatus: string;
  fulfillmentStatus: string; total: number; currency: string; createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', partially_shipped: 'bg-purple-100 text-purple-700',
  shipped: 'bg-teal-100 text-teal-700', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700', refunded: 'bg-red-50 text-red-600', returned: 'bg-orange-100 text-orange-700',
  exchanged: 'bg-purple-100 text-purple-700',
};
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'], pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'],
  processing: ['partially_shipped', 'shipped', 'cancelled'], partially_shipped: ['shipped', 'cancelled'],
  shipped: ['delivered'], delivered: ['returned'], cancelled: [], refunded: [], returned: ['refunded'], exchanged: [],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = () => {
    setLoading(true);
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    fetch(`/api/admin/orders${qs}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setOrders(d?.orders ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter]);

  async function transition(id: string, status: string, order?: Order) {
    let body: Record<string, unknown> = { status };
    if (status === 'refunded') {
      const amountStr = window.prompt(`Refund amount (max ${order?.total ?? 0} ${order?.currency ?? ''}):`, String(order?.total ?? ''));
      if (amountStr === null) return;
      const reason = window.prompt('Refund reason:');
      if (reason === null || !reason.trim()) return;
      body = { status, refundAmount: Number(amountStr), refundReason: reason.trim() };
    } else if (status === 'shipped' || status === 'partially_shipped') {
      const trackingNumber = window.prompt('Tracking number (leave blank if this order is fully digital):');
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
    load();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markPaid: true }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); window.alert(err.error || 'Could not mark paid.'); }
    load();
  }

  async function exchange(id: string) {
    const replacementProductName = window.prompt('Replacement product name:');
    if (!replacementProductName?.trim()) return;
    const replacementSku = window.prompt('Replacement SKU:');
    if (!replacementSku?.trim()) return;
    const priceStr = window.prompt('Replacement unit price:', '0');
    if (priceStr === null) return;
    const res = await fetch(`/api/admin/orders/${id}/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replacementProductName: replacementProductName.trim(), replacementSku: replacementSku.trim(), replacementUnitPrice: Number(priceStr) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) window.alert(body.error || 'Exchange failed.');
    else window.alert(`Exchange created: new order ${String(body.replacementOrderId).slice(0, 8)}.`);
    load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real sales_order state machine — draft → pending → confirmed → processing → shipped → delivered.</p>
      </div>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
        <option value="all">All statuses</option>
        {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
      </select>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
              {['Order #', 'Customer', 'Status', 'Payment', 'Fulfillment', 'Total', 'Actions'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-mono text-xs">{o.orderNumber}</td>
                  <td className="px-4 py-2">{o.customerEmail}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status]}`}>{o.status.replaceAll('_', ' ')}</span></td>
                  <td className="px-4 py-2 text-gray-500">{o.paymentStatus}</td>
                  <td className="px-4 py-2 text-gray-500">{o.fulfillmentStatus}</td>
                  <td className="px-4 py-2">{o.currency} {o.total.toFixed(2)}</td>
                  <td className="px-4 py-2 flex gap-2">
                    {(NEXT_STATUS[o.status] ?? []).map(s => (
                      <button key={s} onClick={() => transition(o.id, s, o)} className="text-xs text-blue-600 hover:underline">{s.replaceAll('_', ' ')}</button>
                    ))}
                    {['pending', 'partially_paid'].includes(o.paymentStatus) && (
                      <button onClick={() => markPaid(o.id)} className="text-xs text-green-600 hover:underline">mark paid</button>
                    )}
                    {o.status === 'returned' && (
                      <button onClick={() => exchange(o.id)} className="text-xs text-purple-600 hover:underline">exchange</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length && <p className="text-sm text-gray-400 text-center py-8">No orders yet.</p>}
        </div>
      )}
    </div>
  );
}
