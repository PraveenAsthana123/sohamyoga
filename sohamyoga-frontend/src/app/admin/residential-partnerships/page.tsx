'use client';

import { useEffect, useState } from 'react';

interface ResidentialBuilding { id: number; building_name: string; address: string | null; manager_name: string | null; manager_email: string | null; unit_count: number; partnership_type: string; monthly_orders: number; status: string; created_at: string; }
interface ResidentPromo { id: number; promo_code: string | null; discount_pct: number; redemptions: number; valid_until: string | null; status: string; building_name?: string; }
interface Summary { totalBuildings: number; activeBuildings: number; totalUnits: number; }
interface ApiData { buildings: ResidentialBuilding[]; promos: ResidentPromo[]; summary: Summary; }

const TABS = ['Overview', 'Buildings', 'Promos', 'AI Outreach Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'active') return 'bg-green-100 text-green-800';
  if (s === 'inactive' || s === 'expired') return 'bg-red-100 text-red-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function ResidentialPartnershipsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/residential-partnerships')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write a building manager outreach email for: ${aiPrompt}. Propose a resident discount program, bulk delivery deal, and easy ordering via app.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { buildings, promos, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-sm">RP</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Residential Partnerships</h1><p className="text-sm text-gray-500">Apartment & condo building partnerships, resident programs</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Buildings" value={fmtNum(summary.totalBuildings)} color="text-gray-900" />
        <KpiCard label="Active" value={fmtNum(summary.activeBuildings)} color="text-green-700" />
        <KpiCard label="Total Units" value={fmtNum(summary.totalUnits)} color="text-cyan-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Residential Partnership Overview</h2>
            <p className="text-sm text-gray-500">Reach thousands of residents through building manager relationships. Offer exclusive resident promo codes and lobby pick-up programs.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-cyan-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Buildings</p><p className="text-xl font-bold text-cyan-700">{fmtNum(summary.totalBuildings)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Total Units</p><p className="text-xl font-bold text-green-700">{fmtNum(summary.totalUnits)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Active Promos</p><p className="text-xl font-bold">{fmtNum(promos.filter(p => p.status === 'active').length)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Buildings' && (
          <div className="overflow-x-auto">
            {buildings.length === 0 ? <Empty msg="No residential buildings yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Building', 'Manager', 'Units', 'Type', 'Monthly Orders', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {buildings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{b.building_name}</td>
                      <td className="px-4 py-3 text-gray-600">{b.manager_name ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(b.unit_count)}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{b.partnership_type}</td>
                      <td className="px-4 py-3">{fmtNum(b.monthly_orders)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(b.status)}`}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Promos' && (
          <div className="overflow-x-auto">
            {promos.length === 0 ? <Empty msg="No promo codes created yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Code', 'Building', 'Discount', 'Redemptions', 'Valid Until', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {promos.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{p.promo_code ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.building_name ?? '—'}</td>
                      <td className="px-4 py-3">{p.discount_pct}%</td>
                      <td className="px-4 py-3">{fmtNum(p.redemptions)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(p.valid_until)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Outreach Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Residential Outreach Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Describe the building (e.g. 'downtown condo, 150 units, young professionals')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Outreach'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
