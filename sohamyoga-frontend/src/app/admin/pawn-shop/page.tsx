'use client';

import { useState, useEffect } from 'react';

interface Item {
  id: number;
  item_number: string;
  description: string;
  category: string;
  customer_name: string;
  loan_amount: number;
  appraised_value: number;
  pawn_date: string;
  due_date: string;
  status: string;
}

export default function PawnShopPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'inventory' | 'ai'>('active');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/pawn-shop')
      .then(r => r.json())
      .then(d => setItems(d.items || []))
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

  const statusColor = (s: string) => ({ pawned: 'bg-yellow-100 text-yellow-700', redeemed: 'bg-green-100 text-green-700', forfeited: 'bg-red-100 text-red-700', 'for-sale': 'bg-blue-100 text-blue-700' }[s] || 'bg-gray-100 text-gray-600');
  const activeItems = items.filter(i => i.status === 'pawned');
  const forSale = items.filter(i => i.status === 'for-sale');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pawn Shop</h1>
        <p className="text-gray-600 mt-1">Manage pawn loans, inventory, and valuations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Loans', value: activeItems.length, color: 'bg-yellow-500' },
          { label: 'Loan Value Out', value: `$${activeItems.reduce((s, i) => s + (i.loan_amount || 0), 0).toLocaleString()}`, color: 'bg-red-500' },
          { label: 'For Sale', value: forSale.length, color: 'bg-blue-500' },
          { label: 'Overdue', value: activeItems.filter(i => new Date(i.due_date) < new Date()).length, color: 'bg-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['active', 'inventory', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Appraiser' : t === 'inventory' ? 'For Sale' : 'Active Loans'}
          </button>
        ))}
      </div>

      {(activeTab === 'active' || activeTab === 'inventory') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">{activeTab === 'active' ? 'Active Pawn Loans' : 'Items For Sale'}</h2>
            <button className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-900">+ New Entry</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (activeTab === 'active' ? activeItems : forSale).length === 0 ? (
            <div className="p-8 text-center text-gray-500">No items found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['#', 'Description', 'Category', 'Customer', 'Loan', 'Appraised', activeTab === 'active' ? 'Due Date' : 'Pawn Date', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {(activeTab === 'active' ? activeItems : forSale).map(i => (
                  <tr key={i.id} className={`border-t border-gray-100 hover:bg-gray-50 ${activeTab === 'active' && new Date(i.due_date) < new Date() ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{i.item_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{i.description}</td>
                    <td className="px-4 py-3 text-gray-600">{i.category}</td>
                    <td className="px-4 py-3 text-gray-600">{i.customer_name}</td>
                    <td className="px-4 py-3 text-gray-700">${(i.loan_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">${(i.appraised_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{activeTab === 'active' ? i.due_date : i.pawn_date}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(i.status)}`}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Item Appraiser</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe an item for valuation guidance: brand, model, condition, age, accessories included..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-gray-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50">{aiLoading ? 'Appraising...' : 'Get Valuation'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
