'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'opportunities', 'requirements', 'delivery', 'upsell'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', opportunities: 'Opportunities', requirements: 'Requirements & Discovery',
  delivery: 'Project Delivery', upsell: 'Upsell Playbooks',
};

interface Opportunity { id: number; client_name: string; contact?: string; description?: string; stage: string; value: number; win_probability: number; requirements?: Array<{ id: number; title: string; priority: string; status: string }>; solution_design?: string; demo_date?: string; created_at: string; }
interface Delivery { id: number; opportunity_id?: number; name: string; status: string; milestones?: Array<{ name: string; due: string; status: string }>; team_members?: string[]; start_date?: string; end_date?: string; health: string; client_name?: string; opp_value?: number; }
interface Playbook { id: number; trigger_event: string; offer?: string; script?: string; success_rate: number; }
interface Pipeline { total: string; total_value: string; weighted_value: string; won: string; avg_win_prob: string; }

const STAGE_COLORS: Record<string, string> = {
  discovery: 'bg-blue-100 text-blue-700', qualified: 'bg-indigo-100 text-indigo-700',
  proposal: 'bg-purple-100 text-purple-700', negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700', closed_lost: 'bg-red-100 text-red-600',
};
const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500',
};
const STAGES = ['discovery', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const MILESTONE_STATUS_COLORS: Record<string, string> = {
  done: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-500',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function SolutionConsultingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [solutionText, setSolutionText] = useState<Record<number, string>>({});
  // Upsell generation
  const [upsellForm, setUpsellForm] = useState({ trigger_event: '', offer: '', client_name: '', client_context: '' });
  const [generatingUpsell, setGeneratingUpsell] = useState(false);
  const [upsellResult, setUpsellResult] = useState<{ opening_line: string; closing_cta: string; playbook: Playbook } | null>(null);

  const fetchOpps = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/solution-consulting').catch(() => null);
    if (res?.ok) { const d = await res.json(); setOpportunities(d.opportunities || []); setPipeline(d.pipeline); }
    setLoading(false);
  }, []);

  const fetchDeliveries = useCallback(async () => {
    const res = await fetch('/api/admin/solution-consulting/deliveries').catch(() => null);
    if (res?.ok) { const d = await res.json(); setDeliveries(d.deliveries || []); }
  }, []);

  const fetchPlaybooks = useCallback(async () => {
    const res = await fetch('/api/admin/solution-consulting/upsell').catch(() => null);
    if (res?.ok) { const d = await res.json(); setPlaybooks(d.playbooks || []); }
  }, []);

  useEffect(() => { fetchOpps(); }, [fetchOpps]);
  useEffect(() => { if (tab === 'delivery') fetchDeliveries(); }, [tab, fetchDeliveries]);
  useEffect(() => { if (tab === 'upsell') fetchPlaybooks(); }, [tab, fetchPlaybooks]);

  const generateSolution = async (opp: Opportunity) => {
    setGenerating(opp.id);
    const res = await fetch(`/api/admin/solution-consulting/${opp.id}/solution`, { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setSolutionText(prev => ({ ...prev, [opp.id]: d.solution_design }));
      await fetchOpps();
    }
    setGenerating(null);
  };

  const generateUpsell = async () => {
    if (!upsellForm.trigger_event || !upsellForm.offer) return;
    setGeneratingUpsell(true); setUpsellResult(null);
    const res = await fetch('/api/admin/solution-consulting/upsell/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upsellForm),
    }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setUpsellResult(d); await fetchPlaybooks(); }
    setGeneratingUpsell(false);
  };

  const pipelineByStage: Record<string, Opportunity[]> = {};
  for (const stage of STAGES) pipelineByStage[stage] = opportunities.filter(o => o.stage === stage);
  const totalValue = opportunities.reduce((s, o) => s + Number(o.value || 0), 0);
  const weightedValue = opportunities.reduce((s, o) => s + Number(o.value || 0) * (o.win_probability / 100), 0);
  const wonCount = opportunities.filter(o => o.stage === 'closed_won').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Solution Consulting</h1>
        <p className="text-slate-300 text-sm mt-1">Presales · Discovery · Project Delivery · Upsell / Cross-sell</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Pipeline Value" value={`$${totalValue.toLocaleString()}`} color="teal" />
                  <KpiCard label="Weighted Value" value={`$${Math.round(weightedValue).toLocaleString()}`} sub="by win probability" color="blue" />
                  <KpiCard label="Won Deals" value={wonCount} color="green" />
                  <KpiCard label="Avg Win Probability" value={pipeline?.avg_win_prob ? `${pipeline.avg_win_prob}%` : '—'} color="purple" />
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3">Pipeline by Stage</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {STAGES.map(stage => (
                      <div key={stage} className="bg-gray-50 border rounded p-3 text-center">
                        <div className="text-2xl font-bold text-gray-800">{pipelineByStage[stage]?.length || 0}</div>
                        <Badge label={stage.replace('_', ' ')} colorClass={STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600'} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3">Recent Opportunities</h2>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Client</th><th>Stage</th><th>Value</th><th>Win %</th></tr></thead>
                    <tbody>{opportunities.slice(0, 5).map(o => (
                      <tr key={o.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{o.client_name}</td>
                        <td><Badge label={o.stage.replace('_', ' ')} colorClass={STAGE_COLORS[o.stage] || 'bg-gray-100 text-gray-600'} /></td>
                        <td>${Number(o.value).toLocaleString()}</td>
                        <td>{o.win_probability}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'opportunities' && (
          <div className="space-y-4">
            {STAGES.filter(s => pipelineByStage[s]?.length > 0).map(stage => (
              <div key={stage}>
                <h2 className="font-semibold text-gray-600 text-sm uppercase mb-2 mt-4">{stage.replace('_', ' ')} ({pipelineByStage[stage].length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pipelineByStage[stage].map(opp => (
                    <div key={opp.id} className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${selectedOpp?.id === opp.id ? 'ring-2 ring-teal-500' : 'hover:shadow-md'}`}
                      onClick={() => setSelectedOpp(opp.id === selectedOpp?.id ? null : opp)}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-800">{opp.client_name}</div>
                          {opp.contact && <div className="text-xs text-gray-500 mt-0.5">{opp.contact}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-800">${Number(opp.value).toLocaleString()}</div>
                          <div className="text-xs text-gray-400">{opp.win_probability}% win</div>
                        </div>
                      </div>
                      {opp.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{opp.description}</p>}
                      {selectedOpp?.id === opp.id && (
                        <div className="mt-3 pt-3 border-t">
                          <button onClick={(e) => { e.stopPropagation(); generateSolution(opp); }} disabled={generating === opp.id}
                            className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs disabled:opacity-50">
                            {generating === opp.id ? 'Generating with Ollama...' : 'Generate Solution Design'}
                          </button>
                          {(solutionText[opp.id] || opp.solution_design) && (
                            <div className="mt-3 bg-teal-50 border border-teal-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {solutionText[opp.id] || opp.solution_design}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'requirements' && (
          <div className="space-y-4">
            {opportunities.filter(o => o.requirements && Array.isArray(o.requirements) && o.requirements.length > 0).map(opp => (
              <div key={opp.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">{opp.client_name}</h3>
                  <Badge label={opp.stage.replace('_', ' ')} colorClass={STAGE_COLORS[opp.stage] || 'bg-gray-100 text-gray-600'} />
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b text-xs">
                    <th className="pb-2">Requirement</th><th>Priority</th><th>Status</th>
                  </tr></thead>
                  <tbody>{(opp.requirements || []).map(req => (
                    <tr key={req.id} className="border-b last:border-0">
                      <td className="py-2">{req.title}</td>
                      <td><Badge label={req.priority} colorClass={req.priority === 'high' ? 'bg-red-100 text-red-600' : req.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'} /></td>
                      <td><Badge label={req.status} colorClass={req.status === 'confirmed' ? 'bg-green-100 text-green-700' : req.status === 'done' ? 'bg-blue-100 text-blue-700' : req.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {tab === 'delivery' && (
          <div className="space-y-4">
            {deliveries.map(d => (
              <div key={d.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{d.name}</h3>
                    {d.client_name && <p className="text-xs text-gray-500 mt-0.5">Client: {d.client_name}</p>}
                    {d.team_members?.length ? <p className="text-xs text-gray-400 mt-0.5">Team: {d.team_members.join(', ')}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${HEALTH_COLORS[d.health] || 'bg-gray-400'}`} title={`Health: ${d.health}`} />
                    <Badge label={d.status.replace('_', ' ')} colorClass={d.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : d.status === 'planning' ? 'bg-gray-100 text-gray-600' : d.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} />
                  </div>
                </div>
                {d.start_date && d.end_date && (
                  <p className="text-xs text-gray-400 mb-3">{new Date(d.start_date).toLocaleDateString()} — {new Date(d.end_date).toLocaleDateString()}</p>
                )}
                <div className="space-y-1">
                  {(d.milestones || []).map((m, i) => {
                    const total = (d.milestones || []).length;
                    const pct = Math.round((i / (total - 1 || 1)) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className="w-20 text-gray-400 text-right">{new Date(m.due).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
                        <div className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" style={{ backgroundColor: m.status === 'done' ? '#10b981' : m.status === 'in_progress' ? '#3b82f6' : 'white' }} />
                        <div className="font-medium text-gray-700">{m.name}</div>
                        <Badge label={m.status.replace('_', ' ')} colorClass={MILESTONE_STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-500'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'upsell' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">Generate Upsell Script with AI</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div><label className="text-sm text-gray-600">Trigger Event</label>
                    <input value={upsellForm.trigger_event} onChange={e => setUpsellForm(p => ({ ...p, trigger_event: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. Project Go-Live, 3-Month Check-in" /></div>
                  <div><label className="text-sm text-gray-600">Offer / Product</label>
                    <input value={upsellForm.offer} onChange={e => setUpsellForm(p => ({ ...p, offer: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. Annual Support Package" /></div>
                  <div><label className="text-sm text-gray-600">Client Name (optional)</label>
                    <input value={upsellForm.client_name} onChange={e => setUpsellForm(p => ({ ...p, client_name: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. Apex Technologies" /></div>
                  <div><label className="text-sm text-gray-600">Client Context (optional)</label>
                    <textarea value={upsellForm.client_context} onChange={e => setUpsellForm(p => ({ ...p, client_context: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1 h-16 resize-none" placeholder="e.g. Enterprise SaaS company, 12-month client, recently launched v2" /></div>
                  <button onClick={generateUpsell} disabled={generatingUpsell || !upsellForm.trigger_event || !upsellForm.offer}
                    className="bg-teal-600 text-white px-4 py-2 rounded text-sm w-full disabled:opacity-50">
                    {generatingUpsell ? 'Generating with Ollama...' : 'Generate Upsell Script'}
                  </button>
                </div>
                <div>
                  {upsellResult ? (
                    <div className="bg-teal-50 border border-teal-100 rounded p-4 h-full">
                      <p className="text-xs font-semibold text-teal-600 uppercase mb-1">Opening Line</p>
                      <p className="text-sm font-medium text-gray-800 mb-3">{upsellResult.opening_line}</p>
                      <p className="text-xs font-semibold text-teal-600 uppercase mb-1">Full Script</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{upsellResult.playbook.script}</p>
                      <p className="text-xs font-semibold text-teal-600 uppercase mb-1">Closing CTA</p>
                      <p className="text-sm font-medium text-gray-800">{upsellResult.closing_cta}</p>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded p-8 flex items-center justify-center text-gray-400 text-sm h-full">
                      Fill in trigger event and offer, then generate
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-700 mb-3">Existing Playbooks</h2>
              <div className="space-y-3">
                {playbooks.map(pb => (
                  <div key={pb.id} className="bg-white rounded-lg border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-800">{pb.trigger_event}</div>
                        {pb.offer && <div className="text-xs text-teal-600 mt-0.5">Offer: {pb.offer}</div>}
                      </div>
                      <Badge label={`${pb.success_rate}% success`} colorClass={Number(pb.success_rate) >= 35 ? 'bg-green-100 text-green-700' : Number(pb.success_rate) >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'} />
                    </div>
                    {pb.script && <p className="text-xs text-gray-500 line-clamp-3">{pb.script}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
