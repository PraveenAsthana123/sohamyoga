'use client';

import { useEffect, useState } from 'react';

interface CommunityPartner { id: number; organization_name: string; contact_name: string | null; email: string | null; phone: string | null; neighborhood: string | null; partnership_type: string; monthly_orders: number; status: string; created_at: string; }
interface CommunityEvent { id: number; event_name: string | null; event_date: string | null; expected_orders: number; actual_orders: number; status: string; organization_name?: string; }
interface Summary { totalPartners: number; activePartners: number; totalMonthlyOrders: number; }
interface ApiData { partners: CommunityPartner[]; events: CommunityEvent[]; summary: Summary; }

const TABS = ['Overview', 'Partners', 'Events', 'AI Outreach Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'active') return 'bg-green-100 text-green-800';
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

export default function CommunityPartnershipsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/community-partnerships')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write a professional partnership outreach email for: ${aiPrompt}. Focus on mutual community benefit, recurring group orders, and easy logistics.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { partners, events, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">CP</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Community Partnerships</h1><p className="text-sm text-gray-500">Community associations, neighborhood groups, recurring demand</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Partners" value={fmtNum(summary.totalPartners)} color="text-gray-900" />
        <KpiCard label="Active Partners" value={fmtNum(summary.activePartners)} color="text-green-700" />
        <KpiCard label="Monthly Orders" value={fmtNum(summary.totalMonthlyOrders)} color="text-indigo-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Community Partnership Overview</h2>
            <p className="text-sm text-gray-500">Build recurring revenue through community organizations — HOAs, religious groups, neighborhood associations, and local clubs.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-indigo-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Active</p><p className="text-xl font-bold text-indigo-700">{fmtNum(summary.activePartners)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Monthly Orders</p><p className="text-xl font-bold text-green-700">{fmtNum(summary.totalMonthlyOrders)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Upcoming Events</p><p className="text-xl font-bold">{fmtNum(events.filter(e => e.status === 'planned').length)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Partners' && (
          <div className="overflow-x-auto">
            {partners.length === 0 ? <Empty msg="No community partners yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Organization', 'Contact', 'Email', 'Neighborhood', 'Type', 'Monthly Orders', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {partners.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.organization_name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contact_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.neighborhood ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{p.partnership_type}</td>
                      <td className="px-4 py-3">{fmtNum(p.monthly_orders)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Events' && (
          <div className="overflow-x-auto">
            {events.length === 0 ? <Empty msg="No community events yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Event', 'Partner', 'Date', 'Expected Orders', 'Actual Orders', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{e.event_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{e.organization_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(e.event_date)}</td>
                      <td className="px-4 py-3">{fmtNum(e.expected_orders)}</td>
                      <td className="px-4 py-3">{fmtNum(e.actual_orders)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(e.status)}`}>{e.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Outreach Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Partnership Outreach Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the community org (e.g. 'HOA for Maple Ridge neighborhood, 200 families')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Outreach Email'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
