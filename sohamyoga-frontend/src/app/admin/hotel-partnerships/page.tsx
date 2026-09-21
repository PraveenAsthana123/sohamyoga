'use client';

import { useEffect, useState } from 'react';

interface HotelPartner { id: number; hotel_name: string; address: string | null; contact_name: string | null; email: string | null; phone: string | null; room_count: number; partnership_type: string; monthly_orders: number; status: string; created_at: string; }
interface HotelOrder { id: number; hotel_name: string | null; order_type: string; room_count: number; amount: number; order_date: string | null; status: string; }
interface Summary { totalHotels: number; activeHotels: number; totalRevenue: number; }
interface ApiData { hotels: HotelPartner[]; orders: HotelOrder[]; summary: Summary; }

const TABS = ['Overview', 'Hotels', 'Orders', 'AI Outreach Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function fmtCur(n: number | null | undefined) { return `$${Number(n ?? 0).toFixed(2)}`; }
function badge(s: string) {
  if (s === 'active' || s === 'completed') return 'bg-green-100 text-green-800';
  if (s === 'inactive' || s === 'cancelled') return 'bg-red-100 text-red-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function HotelPartnershipsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/hotel-partnerships')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  async function generateAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: `Write a hotel partnership proposal email for: ${aiPrompt}. Focus on front-desk referral commissions, guest room delivery, crew meal programs, and concierge recommendations.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { hotels, orders, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-sm">HP</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Hotel Partnerships</h1><p className="text-sm text-gray-500">Front-desk referrals, guest orders, crew meals, concierge</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Hotels" value={fmtNum(summary.totalHotels)} color="text-gray-900" />
        <KpiCard label="Active" value={fmtNum(summary.activeHotels)} color="text-green-700" />
        <KpiCard label="Revenue" value={fmtCur(summary.totalRevenue)} color="text-amber-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Hotel Partnership Overview</h2>
            <p className="text-sm text-gray-500">Leverage hotel front desks and concierge teams as a referral channel. Offer crew meal deals and QR code ordering from room directories.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-amber-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Partner Hotels</p><p className="text-xl font-bold text-amber-700">{fmtNum(summary.totalHotels)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Total Orders</p><p className="text-xl font-bold text-green-700">{fmtNum(orders.length)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Revenue</p><p className="text-xl font-bold">{fmtCur(summary.totalRevenue)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Hotels' && (
          <div className="overflow-x-auto">
            {hotels.length === 0 ? <Empty msg="No hotel partners yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Hotel', 'Contact', 'Rooms', 'Type', 'Monthly Orders', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {hotels.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{h.hotel_name}</td>
                      <td className="px-4 py-3 text-gray-600">{h.contact_name ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(h.room_count)}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{h.partnership_type}</td>
                      <td className="px-4 py-3">{fmtNum(h.monthly_orders)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(h.status)}`}>{h.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Orders' && (
          <div className="overflow-x-auto">
            {orders.length === 0 ? <Empty msg="No hotel orders yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Hotel', 'Type', 'Rooms', 'Amount', 'Date', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{o.hotel_name ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{o.order_type}</td>
                      <td className="px-4 py-3">{fmtNum(o.room_count)}</td>
                      <td className="px-4 py-3 font-medium">{fmtCur(o.amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(o.order_date)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(o.status)}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Outreach Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Hotel Partnership Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Describe the hotel (e.g. '4-star downtown hotel, 200 rooms, business travelers')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Proposal'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
