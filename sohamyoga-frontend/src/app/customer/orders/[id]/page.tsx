'use client';
// /customer/orders/[id] — real order detail: line items, shipment tracking,
// refund status. Ownership-checked server-side by customer_email.

import { useEffect, useState } from 'react';

interface OrderItem { productName: string; sku: string; quantity: number; unitPrice: number; totalAmount: number; isDigital: boolean; downloadUrl?: string }
interface Shipment { trackingNumber: string | null; carrier: string | null; status: string; shippedAt: string | null; deliveredAt: string | null }
interface OrderDetail {
  id: string; orderNumber: string; status: string; paymentStatus: string; fulfillmentStatus: string;
  subtotal: number; discountAmount: number; taxAmount: number; shippingAmount: number; total: number; currency: string;
  refundAmount: number; refundReason: string | null; createdAt: string; items: OrderItem[]; shipments: Shipment[];
}

export default function CustomerOrderDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/customer/orders/${id}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setOrder(d); })
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="max-w-2xl"><p className="text-sm text-red-600">{error}</p></div>;
  if (!order) return <div className="max-w-2xl"><p className="text-sm text-gray-400">Loading…</p></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a href="/customer/orders" className="text-xs text-indigo-600 hover:underline">&larr; Back to orders</a>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{order.status.replaceAll('_', ' ')}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Placed {new Date(order.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-gray-900">Items</h2>
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm border-b last:border-0 py-2">
            <div>
              <p className="font-medium">{it.productName}</p>
              <p className="text-xs text-gray-400">SKU {it.sku} · Qty {it.quantity}{it.isDigital ? ' · Digital' : ''}</p>
              {it.isDigital && it.downloadUrl && <a href={it.downloadUrl} className="text-xs text-indigo-600 underline">Download</a>}
            </div>
            <p className="font-medium">{order.currency} {it.totalAmount.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {order.shipments.length > 0 && (
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-gray-900">Shipments</h2>
          {order.shipments.map((s, i) => (
            <div key={i} className="text-sm">
              <p>{s.carrier ?? 'Carrier'} — {s.trackingNumber ?? 'no tracking number'}</p>
              <p className="text-xs text-gray-400">{s.status}{s.deliveredAt ? ` · Delivered ${new Date(s.deliveredAt).toLocaleDateString()}` : s.shippedAt ? ` · Shipped ${new Date(s.shippedAt).toLocaleDateString()}` : ''}</p>
            </div>
          ))}
        </div>
      )}

      {order.refundAmount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Refunded {order.currency} {order.refundAmount.toFixed(2)}{order.refundReason ? ` — ${order.refundReason}` : ''}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{order.currency} {order.subtotal.toFixed(2)}</span></div>
        {order.discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{order.currency} {order.discountAmount.toFixed(2)}</span></div>}
        {order.taxAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{order.currency} {order.taxAmount.toFixed(2)}</span></div>}
        {order.shippingAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{order.currency} {order.shippingAmount.toFixed(2)}</span></div>}
        <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span>{order.currency} {order.total.toFixed(2)}</span></div>
      </div>
    </div>
  );
}
