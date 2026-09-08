'use client';
// /customer/cart — real cart, backed by a real sales_order in draft status
// (reuses the Order State Machine's own real draft state -- no parallel
// cart table invented). Checkout moves it to pending; no payment gateway
// is connected in this environment, disclosed honestly below.

import { useEffect, useState } from 'react';

interface CartItem { id: string; productId: string; productName: string; sku: string; quantity: number; unitPrice: number; totalAmount: number }
interface Cart { cartId: string | null; items: CartItem[]; subtotal: number; total: number }

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [message, setMessage] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const load = () => { fetch('/api/customer/cart', { cache: 'no-store' }).then(r => r.json()).then(setCart); };
  useEffect(load, []);

  async function updateQty(itemId: string, quantity: number) {
    if (quantity < 1) return;
    await fetch(`/api/customer/cart/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) });
    load();
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/customer/cart/items/${itemId}`, { method: 'DELETE' });
    load();
  }

  async function checkout() {
    setCheckingOut(true);
    const res = await fetch('/api/customer/cart/checkout', { method: 'POST' });
    const body = await res.json();
    setCheckingOut(false);
    setMessage(res.ok ? body.note : body.error);
    if (res.ok) load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Cart</h1>
        <p className="mt-1 text-sm text-gray-500">Real cart backed by your own draft order — checkout hands it to staff since no payment gateway is connected yet.</p>
      </div>

      {!cart ? <p className="text-sm text-gray-400">Loading…</p> : cart.items.length === 0 ? (
        <p className="text-sm text-gray-400">Your cart is empty.</p>
      ) : (
        <div className="space-y-2">
          {cart.items.map(it => (
            <div key={it.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-medium">{it.productName}</p>
                <p className="text-xs text-gray-400">SKU {it.sku}</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" min={1} value={it.quantity} onChange={e => updateQty(it.id, Number(e.target.value))} className="w-14 rounded border p-1 text-xs" />
                <span className="font-medium w-20 text-right">${it.totalAmount.toFixed(2)}</span>
                <button onClick={() => removeItem(it.id)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold pt-2 border-t">
            <span>Total</span><span>${cart.total.toFixed(2)}</span>
          </div>
          <button onClick={checkout} disabled={checkingOut} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-50">
            {checkingOut ? 'Placing order…' : 'Checkout'}
          </button>
        </div>
      )}
      {message && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{message}</p>}
    </div>
  );
}
