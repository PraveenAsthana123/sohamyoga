'use client';

import { useEffect, useState } from 'react';

interface FranchiseLocation { id: number; location_name: string; address: string | null; territory_km: number; franchisee_name: string | null; email: string | null; phone: string | null; opening_date: string | null; monthly_revenue: number; royalty_pct: number; status: string; created_at: string; }
interface FranchiseCompliance { id: number; location_name?: string; check_type: string | null; result: string; inspector: string | null; checked_date: string | null; notes: string | null; status: string; }
interface Summary { totalLocations: number; activeLocations: number; totalRevenue: number; totalRoyalties: number; }
interface ApiData { locations: FranchiseLocation[]; compliance: FranchiseCompliance[]; summary: Summary; }

const TABS = ['Locations', 'Compliance', 'Royalty Calculator', 'AI Ops Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function fmtCur(n: number | null | undefined) { return `$${Number(n ?? 0).toFixed(2)}`; }
function badge(s: string) {
  if (s === 'active' || s === 'pass') return 'bg-green-100 text-green-800';
  if (s === 'inactive' || s === 'fail') return 'bg-red-100 text-red-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (s === 'open') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function FranchiseManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Locations');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/franchise-management')
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
        body: JSON.stringify({ model: 'llama3', prompt: `As a franchise operations expert, create a standard operating procedure for: ${aiPrompt}. Include quality checklist, compliance requirements, and KPIs.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { locations, compliance, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm">FR</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Franchise Management</h1><p className="text-sm text-gray-500">Territory management, compliance, royalties, franchisor reporting</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Locations" value={fmtNum(summary.totalLocations)} color="text-gray-900" />
        <KpiCard label="Active" value={fmtNum(summary.activeLocations)} color="text-green-700" />
        <KpiCard label="Monthly Revenue" value={fmtCur(summary.totalRevenue)} color="text-teal-700" />
        <KpiCard label="Royalties" value={fmtCur(summary.totalRoyalties)} color="text-purple-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Locations' && (
          <div className="overflow-x-auto">
            {locations.length === 0 ? <Empty msg="No franchise locations yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Location', 'Franchisee', 'Territory', 'Monthly Rev', 'Royalty%', 'Royalty $', 'Opened', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {locations.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.location_name}</td>
                      <td className="px-4 py-3 text-gray-600">{l.franchisee_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{l.territory_km} km</td>
                      <td className="px-4 py-3 font-medium">{fmtCur(l.monthly_revenue)}</td>
                      <td className="px-4 py-3">{l.royalty_pct}%</td>
                      <td className="px-4 py-3 text-purple-700 font-medium">{fmtCur(Number(l.monthly_revenue) * Number(l.royalty_pct) / 100)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(l.opening_date)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(l.status)}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Compliance' && (
          <div className="overflow-x-auto">
            {compliance.length === 0 ? <Empty msg="No compliance records yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Location', 'Check Type', 'Result', 'Inspector', 'Date', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {compliance.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{c.location_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.check_type ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(c.result)}`}>{c.result}</span></td>
                      <td className="px-4 py-3 text-gray-500">{c.inspector ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(c.checked_date)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(c.status)}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Royalty Calculator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Royalty Summary</h2>
            {locations.length === 0 ? <Empty msg="No locations yet." /> : (
              <div className="space-y-3">
                {locations.map(l => (
                  <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div>
                      <p className="font-medium text-gray-900">{l.location_name}</p>
                      <p className="text-sm text-gray-500">{l.franchisee_name ?? '—'} · {l.royalty_pct}% royalty</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Monthly Revenue</p>
                      <p className="font-bold text-gray-900">{fmtCur(l.monthly_revenue)}</p>
                      <p className="text-sm font-medium text-purple-700">Royalty: {fmtCur(Number(l.monthly_revenue) * Number(l.royalty_pct) / 100)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="font-bold text-gray-900">Total Monthly Royalties</p>
                  <p className="text-xl font-bold text-purple-700">{fmtCur(summary.totalRoyalties)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'AI Ops Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Franchise Ops Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describe the ops challenge (e.g. 'food safety checklist for new franchise opening')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate SOP'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
