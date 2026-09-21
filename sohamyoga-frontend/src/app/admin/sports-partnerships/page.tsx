'use client';

import { useEffect, useState } from 'react';

interface SportsPartner { id: number; team_name: string; sport: string | null; league: string | null; contact_name: string | null; email: string | null; player_count: number; season_start: string | null; season_end: string | null; status: string; created_at: string; }
interface GameDayOrder { id: number; team_name: string | null; game_date: string | null; order_type: string; headcount: number; amount: number; status: string; }
interface Summary { totalPartners: number; activePartners: number; totalRevenue: number; }
interface ApiData { partners: SportsPartner[]; orders: GameDayOrder[]; summary: Summary; }

const TABS = ['Overview', 'Teams', 'Game-Day Orders', 'AI Outreach Generator'] as const;
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

export default function SportsPartnershipsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/sports-partnerships')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write a sports team partnership pitch for: ${aiPrompt}. Focus on game-day group orders, team meal plans, and season-long bulk pricing.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { partners, orders, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">SP</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Sports Partnerships</h1><p className="text-sm text-gray-500">Sports clubs, season group orders, game-day catering</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Teams" value={fmtNum(summary.totalPartners)} color="text-gray-900" />
        <KpiCard label="Active" value={fmtNum(summary.activePartners)} color="text-green-700" />
        <KpiCard label="Revenue" value={fmtCur(summary.totalRevenue)} color="text-emerald-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Sports Partnership Overview</h2>
            <p className="text-sm text-gray-500">Partner with local sports teams and clubs for season-long meal programs, post-game orders, and tournament catering.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Teams</p><p className="text-xl font-bold text-emerald-700">{fmtNum(summary.totalPartners)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Game-Day Orders</p><p className="text-xl font-bold text-green-700">{fmtNum(orders.length)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Total Revenue</p><p className="text-xl font-bold">{fmtCur(summary.totalRevenue)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Teams' && (
          <div className="overflow-x-auto">
            {partners.length === 0 ? <Empty msg="No sports team partners yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Team', 'Sport', 'League', 'Contact', 'Players', 'Season', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {partners.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.team_name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.sport ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.league ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.contact_name ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(p.player_count)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmt(p.season_start)} — {fmt(p.season_end)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Game-Day Orders' && (
          <div className="overflow-x-auto">
            {orders.length === 0 ? <Empty msg="No game-day orders yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Team', 'Game Date', 'Type', 'Headcount', 'Amount', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{o.team_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(o.game_date)}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{o.order_type}</td>
                      <td className="px-4 py-3">{fmtNum(o.headcount)}</td>
                      <td className="px-4 py-3 font-medium">{fmtCur(o.amount)}</td>
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
            <h2 className="text-lg font-semibold">AI Sports Partnership Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Describe the team (e.g. 'local soccer club, 25 players, weekend games')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Pitch'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
