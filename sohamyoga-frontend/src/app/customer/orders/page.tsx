'use client';
// /customer/orders — real customer-facing order history. sales_order/
// order_item had real admin-side writers (Quote->Order, Booking->Order) but
// zero customer-facing read path before this.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Order {
  id: string; orderNumber: string; status: string; paymentStatus: string; fulfillmentStatus: string;
  total: number; currency: string; createdAt: string; itemCount: number; trackingNumber?: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-white/70', pending: 'bg-amber-500/20 text-amber-300', confirmed: 'bg-blue-500/20 text-blue-300',
  processing: 'bg-indigo-500/20 text-indigo-300', partially_shipped: 'bg-purple-500/20 text-purple-300',
  shipped: 'bg-teal-500/20 text-teal-300', delivered: 'bg-green-500/20 text-green-300',
  cancelled: 'bg-red-500/20 text-red-300', refunded: 'bg-red-50 text-red-600', returned: 'bg-orange-500/20 text-orange-300',
  exchanged: 'bg-purple-500/20 text-purple-300',
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/customer/orders', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .catch(() => setError('Failed to load orders. Please refresh.'));
  }, []);

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <p className="mt-1 text-sm text-white/60">Real order history — status, fulfillment, and tracking.</p>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-900/20 rounded p-2">{error}</p>}
      <div className="space-y-2 text-white">
        {orders?.map(o => (
          <Link key={o.id} href={`/customer/orders/${o.id}`} className="block rounded-lg border border-white/20 bg-slate-800/70 p-3 text-sm hover:border-indigo-300">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.orderNumber}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[o.status] ?? 'bg-white/10'}`}>{o.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-1 text-white/70">{o.itemCount} item(s){o.trackingNumber ? ` · Tracking: ${o.trackingNumber}` : ''}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-white/60">
              <span>{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className="font-medium text-white">{o.currency} {o.total.toFixed(2)}</span>
            </div>
          </Link>
        ))}
        {orders && !orders.length && <p className="text-sm text-white/50">No orders yet.</p>}
        {!orders && !error && <p className="text-sm text-white/50">Loading…</p>}
      </div>
    </div>
  );
}
