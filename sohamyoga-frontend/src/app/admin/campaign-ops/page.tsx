'use client';

import { useEffect, useState } from 'react';

interface CampaignOp { id: number; campaign_name: string; channel: string | null; objective: string | null; budget: number; start_date: string | null; end_date: string | null; impressions: number; clicks: number; conversions: number; revenue_attributed: number; cost_per_order: number; status: string; created_at: string; }
interface StageLog { id: number; campaign_name?: string; stage: string; notes: string | null; changed_by: string | null; changed_at: string; }
interface Summary { totalCampaigns: number; totalBudget: number; totalRevenue: number; }
interface ApiData { campaigns: CampaignOp[]; stageLogs: StageLog[]; summary: Summary; }

const STAGES = ['idea', 'draft', 'approved', 'scheduled', 'activated', 'observed', 'attributed', 'evaluated'] as const;
type Stage = typeof STAGES[number];

const TABS = ['Kanban', 'Campaign List', 'Stage Log', 'AI Campaign Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function fmtCur(n: number | null | undefined) { return `$${Number(n ?? 0).toFixed(2)}`; }

const stageBg: Record<Stage, string> = {
  idea: 'bg-gray-100',
  draft: 'bg-yellow-50',
  approved: 'bg-blue-50',
  scheduled: 'bg-indigo-50',
  activated: 'bg-green-50',
  observed: 'bg-teal-50',
  attributed: 'bg-emerald-50',
  evaluated: 'bg-purple-50',
};
const stageBadge: Record<Stage, string> = {
  idea: 'bg-gray-100 text-gray-700',
  draft: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-indigo-100 text-indigo-800',
  activated: 'bg-green-100 text-green-800',
  observed: 'bg-teal-100 text-teal-800',
  attributed: 'bg-emerald-100 text-emerald-800',
  evaluated: 'bg-purple-100 text-purple-800',
};

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function CampaignOpsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Kanban');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/campaign-ops')
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
        body: JSON.stringify({ model: 'llama3', prompt: `As a campaign strategist, create a full campaign brief for: ${aiPrompt}. Include: objective, target audience, channel mix, budget split, key messages, success metrics, and timeline.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { campaigns, stageLogs, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm">CO</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Campaign Ops</h1><p className="text-sm text-gray-500">Full lifecycle: Idea → Draft → Approved → Scheduled → Activated → Observed → Attributed → Evaluated</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Campaigns" value={fmtNum(summary.totalCampaigns)} color="text-gray-900" />
        <KpiCard label="Total Budget" value={fmtCur(summary.totalBudget)} color="text-orange-700" />
        <KpiCard label="Revenue Attributed" value={fmtCur(summary.totalRevenue)} color="text-green-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Kanban' && (
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {STAGES.map(stage => {
                const stageCampaigns = campaigns.filter(c => c.status === stage);
                return (
                  <div key={stage} className={`w-52 rounded-lg p-3 ${stageBg[stage]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${stageBadge[stage]}`}>{stage}</span>
                      <span className="text-xs text-gray-500">{stageCampaigns.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageCampaigns.length === 0
                        ? <p className="text-xs text-gray-400 italic text-center py-4">Empty</p>
                        : stageCampaigns.map(c => (
                          <div key={c.id} className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                            <p className="text-xs font-medium text-gray-900 truncate">{c.campaign_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{c.channel ?? '—'}</p>
                            <p className="text-xs text-gray-700 mt-0.5 font-medium">{fmtCur(c.budget)}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'Campaign List' && (
          <div className="overflow-x-auto">
            {campaigns.length === 0 ? <Empty msg="No campaigns yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Campaign', 'Channel', 'Budget', 'Impressions', 'Conversions', 'Revenue', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.campaign_name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.channel ?? '—'}</td>
                      <td className="px-4 py-3">{fmtCur(c.budget)}</td>
                      <td className="px-4 py-3">{fmtNum(c.impressions)}</td>
                      <td className="px-4 py-3">{fmtNum(c.conversions)}</td>
                      <td className="px-4 py-3 font-medium text-green-700">{fmtCur(c.revenue_attributed)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge[c.status as Stage] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Stage Log' && (
          <div className="overflow-x-auto">
            {stageLogs.length === 0 ? <Empty msg="No stage transitions logged yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Campaign', 'Stage', 'Changed By', 'Notes', 'When'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {stageLogs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{l.campaign_name ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${stageBadge[l.stage as Stage] ?? 'bg-gray-100 text-gray-600'}`}>{l.stage}</span></td>
                      <td className="px-4 py-3 text-gray-500">{l.changed_by ?? '—'}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500">{l.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(l.changed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Campaign Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Campaign Brief Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Describe your campaign goal (e.g. 'launch new vegan menu, target health-conscious millennials in downtown area, $500 budget')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Campaign Brief'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
