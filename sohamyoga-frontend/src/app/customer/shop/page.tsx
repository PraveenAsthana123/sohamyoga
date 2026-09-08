'use client';
// /customer/shop — real product catalog browse + add-to-cart. The cart and
// checkout (/customer/cart) were already real (a draft sales_order), but
// nothing let a customer discover a productId to add in the first place.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Product { id: string; name: string; description: string | null; type: string; sku: string; price: number; inStock: boolean }

export default function ShopPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customer/products', { cache: 'no-store' }).then(r => r.json()).then(d => setProducts(d.products ?? []));
  }, []);

  async function addToCart(productId: string) {
    setAdding(productId);
    const res = await fetch('/api/customer/cart', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, quantity: 1 }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(null);
    setMessage(res.ok ? 'Added to cart.' : (body.error ?? 'Could not add to cart.'));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shop</h1>
          <p className="mt-1 text-sm text-gray-500">Real products, real cart. Checkout hands the order to staff — no payment gateway is connected yet.</p>
        </div>
        <Link href="/customer/cart" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          🛒 View Cart
        </Link>
      </div>

      {message && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{message}</p>}

      {!products ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !products.length ? (
        <p className="text-sm text-gray-400">No products available yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map(p => (
            <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{p.type.replaceAll('_', ' ')}</span>
              </div>
              {p.description && <p className="mt-1 text-xs text-gray-500">{p.description}</p>}
              <p className="mt-1 text-xs text-gray-400">SKU {p.sku}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold">${p.price.toFixed(2)}</span>
                <button
                  onClick={() => addToCart(p.id)}
                  disabled={!p.inStock || adding === p.id}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {!p.inStock ? 'Out of stock' : adding === p.id ? 'Adding…' : 'Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
