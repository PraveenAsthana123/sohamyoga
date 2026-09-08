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
  draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', partially_shipped: 'bg-purple-100 text-purple-700',
  shipped: 'bg-teal-100 text-teal-700', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700', refunded: 'bg-red-50 text-red-600', returned: 'bg-orange-100 text-orange-700',
  exchanged: 'bg-purple-100 text-purple-700',
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    fetch('/api/customer/orders', { cache: 'no-store' }).then(r => r.json()).then(d => setOrders(d.orders ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="mt-1 text-sm text-gray-500">Real order history — status, fulfillment, and tracking.</p>
      </div>
      <div className="space-y-2">
        {orders?.map(o => (
          <Link key={o.id} href={`/customer/orders/${o.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 text-sm hover:border-indigo-300">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.orderNumber}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[o.status] ?? 'bg-gray-100'}`}>{o.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-1 text-gray-600">{o.itemCount} item(s){o.trackingNumber ? ` · Tracking: ${o.trackingNumber}` : ''}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className="font-medium text-gray-800">{o.currency} {o.total.toFixed(2)}</span>
            </div>
          </Link>
        ))}
        {orders && !orders.length && <p className="text-sm text-gray-400">No orders yet.</p>}
        {!orders && <p className="text-sm text-gray-400">Loading…</p>}
      </div>
    </div>
  );
}
