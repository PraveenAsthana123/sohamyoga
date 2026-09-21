'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: number;
  name: string;
  category: string;
  material: string;
  price: number;
  stock: number;
  sku: string;
  status: string;
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  product_name: string;
  total: number;
  status: string;
  created_at: string;
}

export default function JewelleryStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'ai'>('inventory');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/jewellery-store')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setOrders(d.orders || []); })
      .finally(() => setLoading(false));
  }, []);

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch { setAiResponse('AI unavailable'); } finally { setAiLoading(false); }
  };

  const statusColor = (s: string) => ({ active: 'bg-green-100 text-green-700', 'low-stock': 'bg-yellow-100 text-yellow-700', 'out-of-stock': 'bg-red-100 text-red-700', pending: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jewellery Store</h1>
        <p className="text-gray-600 mt-1">Manage inventory, orders, and jewellery collections</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Products', value: products.length, color: 'bg-yellow-500' },
          { label: 'Inventory Value', value: `$${products.reduce((s, p) => s + (p.price * p.stock || 0), 0).toLocaleString()}`, color: 'bg-green-500' },
          { label: 'Total Orders', value: orders.length, color: 'bg-blue-500' },
          { label: 'Low Stock', value: products.filter(p => p.stock <= 3).length, color: 'bg-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['inventory', 'orders', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-yellow-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Product Copy' : t === 'orders' ? 'Orders' : 'Inventory'}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Jewellery Inventory</h2>
            <button className="bg-yellow-600 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-700">+ Add Item</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No inventory items yet. Add your first piece.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['SKU', 'Name', 'Category', 'Material', 'Price', 'Stock', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.category}</td>
                    <td className="px-4 py-3 text-gray-600">{p.material}</td>
                    <td className="px-4 py-3 text-gray-700">${(p.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{p.stock}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Order #', 'Customer', 'Item', 'Total', 'Status', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.order_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600">{o.product_name}</td>
                    <td className="px-4 py-3 text-gray-700">${(o.total || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status)}`}>{o.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Product Copywriter</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a piece of jewellery for product description, social post, or marketing copy..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50">{aiLoading ? 'Generating...' : 'Write Copy'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
