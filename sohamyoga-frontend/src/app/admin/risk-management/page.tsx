'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Risk Dashboard','Risk Register','Third-Party Risk','Compliance Walkthroughs','Audit Sampling','AI Risk Advisor'] as const;
type Tab = typeof TABS[number];

interface Risk {
  id: number; title: string; category: string; description: string;
  likelihood: number; impact: number; risk_score: number;
  owner: string; controls: string[]; status: string; treatment: string; created_at: string;
}
interface Vendor {
  id: number; vendor_name: string; service: string; data_shared: string[];
  criticality: string; last_assessment: string | null; risk_level: string;
  findings: string[]; next_review: string | null;
}
interface Walkthrough {
  id: number; process_name: string; control_owner: string; walkthrough_date: string | null;
  tester: string; steps: unknown[]; findings: string[]; result: string;
}
interface AuditSample {
  id: number; population_name: string; population_size: number; sample_size: number;
  method: string; items_sampled: unknown[]; exceptions_found: number; exception_rate: number;
}
interface HeatmapCell { likelihood: number; impact: number; score: number; count: number; risks: unknown[]; }

const RISK_SCORE_COLOR = (score: number) => {
  if (score >= 20) return 'bg-red-600 text-white';
  if (score >= 12) return 'bg-orange-400 text-white';
  if (score >= 6) return 'bg-yellow-300 text-gray-800';
  return 'bg-green-200 text-gray-800';
};
const RISK_SCORE_BADGE = (score: number) => {
  if (score >= 20) return 'bg-red-100 text-red-700';
  if (score >= 12) return 'bg-orange-100 text-orange-700';
  if (score >= 6) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};
const RISK_LABEL = (score: number) => score >= 20 ? 'Critical' : score >= 12 ? 'High' : score >= 6 ? 'Medium' : 'Low';
const CRITICALITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};
const RESULT_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  'partial-pass': 'bg-yellow-100 text-yellow-700',
};
const CATEGORIES = ['Operational','Technology','Cyber','Third-Party','Privacy'];

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

export default function RiskManagementPage() {
  const [tab, setTab] = useState<Tab>('Risk Dashboard');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [samples, setSamples] = useState<AuditSample[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[][]>([]);
  const [heatSummary, setHeatSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [aiAssessment, setAiAssessment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [popSize, setPopSize] = useState('');
  const [calcResult, setCalcResult] = useState<{ sample_size: number; formula: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const url = categoryFilter ? `/api/admin/risk-management?category=${categoryFilter}` : '/api/admin/risk-management';
    const [rR, vR, wR, sR, hmR] = await Promise.all([
      fetch(url).catch(() => null),
      fetch('/api/admin/risk-management/third-party').catch(() => null),
      fetch('/api/admin/risk-management/walkthroughs').catch(() => null),
      fetch('/api/admin/risk-management/sampling').catch(() => null),
      fetch('/api/admin/risk-management/heatmap').catch(() => null),
    ]);
    if (rR?.ok) { const d = await rR.json(); setRisks(d.risks || []); }
    if (vR?.ok) { const d = await vR.json(); setVendors(d.vendors || []); }
    if (wR?.ok) { const d = await wR.json(); setWalkthroughs(d.walkthroughs || []); }
    if (sR?.ok) { const d = await sR.json(); setSamples(d.samples || []); }
    if (hmR?.ok) { const d = await hmR.json(); setHeatmap(d.matrix || []); setHeatSummary(d.summary || {}); }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const assessRisk = async (risk: Risk) => {
    setSelectedRisk(risk);
    setAiAssessment('');
    setTab('AI Risk Advisor');
    setAiLoading(true);
    const r = await fetch(`/api/admin/risk-management/${risk.id}/assess`, { method: 'POST' }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setAiAssessment(d.assessment || ''); }
    setAiLoading(false);
  };

  const calcSampleSize = async () => {
    if (!popSize) return;
    const r = await fetch('/api/admin/risk-management/sampling/calculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ population_size: parseInt(popSize) }),
    }).catch(() => null);
    if (r?.ok) { setCalcResult(await r.json()); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Risk Management</h1>
        <p className="text-slate-300 text-sm mt-0.5">Operational · Technology · Cyber · Third-Party · Privacy · Compliance · Sampling</p>
      </div>

      <div className="border-b bg-white px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {loading && <p className="text-gray-500 text-sm mb-4">Loading…</p>}

        {tab === 'Risk Dashboard' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Risk Dashboard</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border-l-4 border-red-600 bg-red-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Critical Risks</p>
                <p className="text-2xl font-bold text-red-700">{heatSummary.critical}</p>
              </div>
              <div className="border-l-4 border-orange-500 bg-orange-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">High Risks</p>
                <p className="text-2xl font-bold text-orange-700">{heatSummary.high}</p>
              </div>
              <div className="border-l-4 border-yellow-500 bg-yellow-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Medium Risks</p>
                <p className="text-2xl font-bold text-yellow-700">{heatSummary.medium}</p>
              </div>
              <div className="border-l-4 border-green-500 bg-green-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Low Risks</p>
                <p className="text-2xl font-bold text-green-700">{heatSummary.low}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4 mb-6">
              <h3 className="font-semibold text-sm mb-3">Risk Heatmap (5×5 Likelihood × Impact)</h3>
              <div className="mb-2 flex gap-4 text-xs text-gray-500">
                <span>← Likelihood (1=Rare, 5=Almost Certain)</span>
                <span className="ml-auto">↑ Impact (1=Insignificant, 5=Catastrophic)</span>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
                <div />
                {[1,2,3,4,5].map(imp => <div key={imp} className="text-center text-xs text-gray-400 py-1">I={imp}</div>)}
                {[5,4,3,2,1].map(lh => (
                  <>
                    <div key={`lh-${lh}`} className="text-xs text-gray-400 flex items-center pr-2">L={lh}</div>
                    {[1,2,3,4,5].map(imp => {
                      const cell = heatmap[lh - 1]?.[imp - 1];
                      const score = lh * imp;
                      return (
                        <div key={`${lh}-${imp}`}
                          className={`rounded flex items-center justify-center h-12 text-sm font-bold ${RISK_SCORE_COLOR(score)} cursor-pointer hover:opacity-90 transition-opacity`}
                          title={`L${lh}×I${imp}=Score ${score}: ${cell?.count || 0} risk(s)`}>
                          {cell?.count && cell.count > 0 ? cell.count : ''}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                {[{l:'Critical (≥20)',c:'bg-red-600 text-white'},{l:'High (12-19)',c:'bg-orange-400 text-white'},{l:'Medium (6-11)',c:'bg-yellow-300 text-gray-800'},{l:'Low (<6)',c:'bg-green-200 text-gray-800'}].map(({l,c}) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded ${c.split(' ')[0]}`} />
                    <span className="text-gray-600">{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <h3 className="font-semibold text-sm p-4 border-b">Top Risks by Score</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs">Risk</th>
                    <th className="text-left px-4 py-2 text-xs">Category</th>
                    <th className="text-left px-4 py-2 text-xs">Score</th>
                    <th className="text-left px-4 py-2 text-xs">Owner</th>
                    <th className="text-left px-4 py-2 text-xs">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {risks.slice(0, 8).map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium max-w-xs">{r.title}</td>
                      <td className="px-4 py-2"><Badge label={r.category} colorClass="bg-gray-100 text-gray-600" /></td>
                      <td className="px-4 py-2">
                        <Badge label={`${r.risk_score} · ${RISK_LABEL(r.risk_score)}`} colorClass={RISK_SCORE_BADGE(r.risk_score)} />
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{r.owner || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{r.status}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => assessRisk(r)} className="text-xs text-blue-600 hover:underline">Assess</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Risk Register' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">Risk Register</h2>
              <div className="ml-auto flex gap-2">
                {['', ...CATEGORIES].map(c => (
                  <button key={c} onClick={() => setCategoryFilter(c)}
                    className={`px-3 py-1 rounded text-sm ${categoryFilter === c ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                    {c || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {risks.map(r => (
                <div key={r.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded flex items-center justify-center font-bold text-lg ${RISK_SCORE_COLOR(r.risk_score)}`}>
                      {r.risk_score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{r.title}</h3>
                        <Badge label={RISK_LABEL(r.risk_score)} colorClass={RISK_SCORE_BADGE(r.risk_score)} />
                        <Badge label={r.category} colorClass="bg-gray-100 text-gray-600" />
                      </div>
                      {r.description && <p className="text-xs text-gray-500 mb-2">{r.description}</p>}
                      <div className="flex gap-4 text-xs text-gray-400 mb-2">
                        <span>Likelihood: {r.likelihood}/5</span>
                        <span>Impact: {r.impact}/5</span>
                        <span>Treatment: {r.treatment}</span>
                        {r.owner && <span>Owner: {r.owner}</span>}
                      </div>
                      {safeArray(r.controls).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {safeArray(r.controls).map((c, i) => (
                            <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => assessRisk(r)}
                      className="flex-shrink-0 bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700">
                      AI Assess
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Third-Party Risk' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Third-Party Risk</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map(v => (
                <div key={v.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{v.vendor_name}</h3>
                    <Badge label={v.criticality} colorClass={CRITICALITY_COLORS[v.criticality] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  {v.service && <p className="text-sm text-gray-500 mb-2">{v.service}</p>}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400">Risk Level:</span>
                    <Badge label={v.risk_level} colorClass={CRITICALITY_COLORS[v.risk_level] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  {safeArray(v.data_shared).length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Data Shared:</p>
                      <div className="flex flex-wrap gap-1">
                        {safeArray(v.data_shared).map((d, i) => (
                          <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {safeArray(v.findings).length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Findings:</p>
                      {safeArray(v.findings).map((f, i) => (
                        <p key={i} className="text-xs text-gray-600">· {f}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    {v.last_assessment && <span>Last assessed: {new Date(v.last_assessment).toLocaleDateString()}</span>}
                    {v.next_review && <span>Next review: {new Date(v.next_review).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Compliance Walkthroughs' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Compliance Walkthroughs</h2>
            <div className="space-y-4">
              {walkthroughs.map(w => (
                <div key={w.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{w.process_name}</h3>
                    <Badge label={w.result} colorClass={RESULT_COLORS[w.result] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mb-3">
                    {w.control_owner && <span>Owner: {w.control_owner}</span>}
                    {w.tester && <span>Tester: {w.tester}</span>}
                    {w.walkthrough_date && <span>Date: {new Date(w.walkthrough_date).toLocaleDateString()}</span>}
                  </div>
                  {Array.isArray(w.steps) && w.steps.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Steps ({w.steps.length}):</p>
                      <div className="space-y-1">
                        {(w.steps as { step: number; description: string; evidence?: string }[]).map((s, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium flex-shrink-0">{s.step || i+1}</span>
                            <span className="text-gray-600">{s.description}</span>
                            {s.evidence && <span className="text-gray-400">· Evidence: {s.evidence}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {safeArray(w.findings).length > 0 && (
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-xs font-medium text-red-600 mb-1">Findings:</p>
                      {safeArray(w.findings).map((f, i) => (
                        <p key={i} className="text-xs text-red-500">· {f}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Audit Sampling' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Audit Sampling</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-semibold text-sm mb-3">Sample Size Calculator (95% confidence, 5% tolerable deviation)</h3>
              <div className="flex gap-3">
                <input value={popSize} onChange={e => setPopSize(e.target.value)} type="number" min="1"
                  placeholder="Population size (e.g., 500)"
                  className="border rounded px-3 py-2 text-sm w-64" />
                <button onClick={calcSampleSize} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700">
                  Calculate
                </button>
              </div>
              {calcResult && (
                <div className="mt-3 bg-indigo-50 rounded p-3">
                  <p className="text-sm font-semibold text-indigo-700">Recommended Sample Size: <span className="text-2xl">{calcResult.sample_size}</span></p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">{calcResult.formula}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {samples.map(s => (
                <div key={s.id} className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-2">{s.population_name}</h3>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-gray-700">{s.population_size.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Population</p>
                    </div>
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-blue-700">{s.sample_size}</p>
                      <p className="text-xs text-gray-400">Sample Size</p>
                    </div>
                    <div className="bg-red-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-red-700">{s.exceptions_found}</p>
                      <p className="text-xs text-gray-400">Exceptions</p>
                    </div>
                    <div className={`rounded p-2 text-center ${Number(s.exception_rate) > 5 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-lg font-bold ${Number(s.exception_rate) > 5 ? 'text-red-700' : 'text-green-700'}`}>{s.exception_rate}%</p>
                      <p className="text-xs text-gray-400">Exception Rate</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">Method: {s.method}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'AI Risk Advisor' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">AI Risk Advisor</h2>
            {!selectedRisk ? (
              <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400">
                <p className="text-sm">Select a risk from the Risk Register or Risk Dashboard to get an AI-powered assessment.</p>
                <button onClick={() => setTab('Risk Register')} className="mt-3 text-blue-600 text-sm hover:underline">Go to Risk Register</button>
              </div>
            ) : (
              <div>
                <div className="bg-white rounded-lg border p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded flex items-center justify-center font-bold text-lg ${RISK_SCORE_COLOR(selectedRisk.risk_score)}`}>
                      {selectedRisk.risk_score}
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedRisk.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge label={selectedRisk.category} colorClass="bg-gray-100 text-gray-600" />
                        <Badge label={RISK_LABEL(selectedRisk.risk_score)} colorClass={RISK_SCORE_BADGE(selectedRisk.risk_score)} />
                        <Badge label={selectedRisk.treatment} colorClass="bg-indigo-100 text-indigo-700" />
                      </div>
                    </div>
                    <button onClick={() => assessRisk(selectedRisk)} disabled={aiLoading}
                      className="ml-auto bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                      {aiLoading ? 'Assessing…' : 'Re-run Assessment'}
                    </button>
                  </div>
                </div>
                {aiLoading ? (
                  <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">Running AI risk assessment via Ollama…</div>
                ) : aiAssessment ? (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">AI Risk Assessment</h3>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{aiAssessment}</pre>
                  </div>
                ) : (
                  <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">
                    Click Re-run Assessment to generate an Ollama-powered risk analysis.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
