'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Improvement Dashboard','Lean & Six Sigma','Waste Analysis','Approval Optimizer','Task Mining','Conformance Checker'] as const;
type Tab = typeof TABS[number];

interface Initiative {
  id: number; name: string; methodology: string; process_name: string;
  current_metric: number; target_metric: number; unit: string;
  status: string; owner: string; savings_usd: number; created_at: string;
}
interface WasteFinding {
  id: number; process_name: string; waste_type: string; description: string;
  impact: string; estimated_cost_usd: number; status: string; action_plan: string;
}
interface Bottleneck {
  id: number; process_name: string; step_name: string; avg_wait_hours: number;
  approver: string; bypass_eligible: boolean; recommendation: string;
}
interface MiningRun {
  id: number; process_name: string; events_analyzed: number; variants_found: number;
  automation_candidates: { task: string; confidence: number }[]; conformance_score: number; run_at: string;
}

const DMAIC_STAGES = ['define','measure','analyze','improve','control'] as const;
const STAGE_COLORS: Record<string, string> = {
  define: 'bg-blue-100 text-blue-700',
  measure: 'bg-indigo-100 text-indigo-700',
  analyze: 'bg-yellow-100 text-yellow-700',
  improve: 'bg-orange-100 text-orange-700',
  control: 'bg-green-100 text-green-700',
};
const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};
const WASTE_COLORS: Record<string, string> = {
  Transport: 'bg-blue-500',
  Inventory: 'bg-purple-500',
  Motion: 'bg-teal-500',
  Waiting: 'bg-red-500',
  Overproduction: 'bg-orange-500',
  Overprocessing: 'bg-yellow-500',
  Defects: 'bg-pink-500',
  Skills: 'bg-gray-500',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

export default function ProcessOptimizationPage() {
  const [tab, setTab] = useState<Tab>('Improvement Dashboard');
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [waste, setWaste] = useState<WasteFinding[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [mining, setMining] = useState<MiningRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedInit, setSelectedInit] = useState<Initiative | null>(null);
  const [aiOutput, setAiOutput] = useState('');
  const [scanDesc, setScanDesc] = useState('');
  const [scanResults, setScanResults] = useState<WasteFinding[]>([]);
  const [approvalRecs, setApprovalRecs] = useState('');
  const [conformanceInput, setConformanceInput] = useState({ process_name: '', intended_flow: '', actual_flow: '' });
  const [conformanceResult, setConformanceResult] = useState('');
  const [miningProcess, setMiningProcess] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/process-optimization').catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setInitiatives(d.initiatives || []);
      setWaste(d.waste || []);
      setBottlenecks(d.bottlenecks || []);
      setMining(d.mining || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const analyzeInit = async () => {
    if (!selectedInit) return;
    setAiLoading(true);
    setAiOutput('');
    const r = await fetch(`/api/admin/process-optimization/${selectedInit.id}/analyze`, { method: 'POST' }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setAiOutput(d.analysis || ''); }
    setAiLoading(false);
  };

  const scanWaste = async () => {
    if (!scanDesc) return;
    setAiLoading(true);
    setScanResults([]);
    const r = await fetch('/api/admin/process-optimization/waste/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: scanDesc }),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setScanResults(d.findings || []); }
    setAiLoading(false);
  };

  const optimizeApprovals = async () => {
    setAiLoading(true);
    setApprovalRecs('');
    const r = await fetch('/api/admin/process-optimization/approvals/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setApprovalRecs(d.recommendations || ''); }
    setAiLoading(false);
  };

  const runMining = async () => {
    if (!miningProcess) return;
    setAiLoading(true);
    const r = await fetch('/api/admin/process-optimization/task-mining', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process_name: miningProcess }),
    }).catch(() => null);
    if (r?.ok) { await fetchAll(); }
    setAiLoading(false);
  };

  const checkConformance = async () => {
    if (!conformanceInput.process_name) return;
    setAiLoading(true);
    setConformanceResult('');
    const r = await fetch('/api/admin/process-optimization/conformance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conformanceInput),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setConformanceResult(d.analysis || ''); }
    setAiLoading(false);
  };

  const totalSavings = initiatives.reduce((sum, i) => sum + (Number(i.savings_usd) || 0), 0);
  const wasteByType = waste.reduce((acc, w) => { acc[w.waste_type] = (acc[w.waste_type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Process Optimization</h1>
        <p className="text-slate-300 text-sm mt-0.5">Six Sigma · Lean · Waste Analysis · Approval Optimization · Task Mining · Conformance</p>
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

        {tab === 'Improvement Dashboard' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Improvement Dashboard</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border-l-4 border-blue-500 bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Active Initiatives</p>
                <p className="text-2xl font-bold">{initiatives.length}</p>
              </div>
              <div className="border-l-4 border-green-500 bg-green-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Total Savings (Est.)</p>
                <p className="text-2xl font-bold">${totalSavings.toLocaleString()}</p>
              </div>
              <div className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Waste Findings</p>
                <p className="text-2xl font-bold">{waste.length}</p>
              </div>
              <div className="border-l-4 border-amber-500 bg-amber-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Approval Bottlenecks</p>
                <p className="text-2xl font-bold">{bottlenecks.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">Initiatives by Stage</h3>
                {DMAIC_STAGES.map(s => {
                  const count = initiatives.filter(i => i.status === s).length;
                  return (
                    <div key={s} className="flex items-center gap-3 mb-2">
                      <Badge label={s.toUpperCase()} colorClass={STAGE_COLORS[s]} />
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${initiatives.length ? (count / initiatives.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm font-medium w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">Waste by Type</h3>
                {Object.entries(wasteByType).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3 mb-2">
                    <span className={`w-3 h-3 rounded-sm ${WASTE_COLORS[type] || 'bg-gray-400'}`} />
                    <span className="text-sm flex-1">{type}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Lean & Six Sigma' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Lean & Six Sigma Initiatives</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {initiatives.map(init => (
                <div key={init.id}
                  onClick={() => { setSelectedInit(init); setAiOutput(''); }}
                  className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedInit?.id === init.id ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm">{init.name}</h3>
                    <Badge label={init.status?.toUpperCase()} colorClass={STAGE_COLORS[init.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Badge label={init.methodology} colorClass="bg-indigo-100 text-indigo-700" />
                    {init.process_name && <span className="text-xs text-gray-500">{init.process_name}</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 mb-1">
                    <span>Current: <strong>{init.current_metric} {init.unit}</strong></span>
                    <span>Target: <strong>{init.target_metric} {init.unit}</strong></span>
                  </div>
                  <div className="text-xs text-green-600 font-medium">Est. savings: ${Number(init.savings_usd).toLocaleString()}</div>
                  {init.owner && <div className="text-xs text-gray-400 mt-1">Owner: {init.owner}</div>}
                </div>
              ))}
            </div>
            {selectedInit && (
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">DMAIC Analysis: {selectedInit.name}</h3>
                  <button onClick={analyzeInit} disabled={aiLoading}
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {aiLoading ? 'Analyzing…' : 'Run AI DMAIC Analysis'}
                  </button>
                </div>
                {aiOutput ? (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{aiOutput}</pre>
                ) : (
                  <p className="text-gray-400 text-sm">Click Run AI DMAIC Analysis to get Ollama-powered improvement recommendations.</p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'Waste Analysis' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Waste Analysis (8 Lean Types)</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-semibold text-sm mb-3">AI Waste Scanner</h3>
              <textarea value={scanDesc} onChange={e => setScanDesc(e.target.value)} rows={4}
                placeholder="Describe a business process in detail to scan for waste…"
                className="w-full text-sm border rounded px-3 py-2 mb-3 resize-none" />
              <button onClick={scanWaste} disabled={aiLoading || !scanDesc}
                className="bg-orange-600 text-white text-sm px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50">
                {aiLoading ? 'Scanning…' : 'Scan for Waste'}
              </button>
            </div>
            {scanResults.length > 0 && (
              <div className="bg-white rounded-lg border p-4 mb-4">
                <h3 className="font-semibold text-sm mb-3">Scan Results</h3>
                <div className="space-y-2">
                  {scanResults.map((f, i) => (
                    <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded border">
                      <span className={`w-3 h-3 mt-1 rounded-sm flex-shrink-0 ${WASTE_COLORS[f.waste_type] || 'bg-gray-400'}`} />
                      <div>
                        <div className="flex gap-2 mb-0.5">
                          <span className="text-xs font-semibold">{f.waste_type}</span>
                          <Badge label={f.impact} colorClass={IMPACT_COLORS[f.impact] || 'bg-gray-100 text-gray-600'} />
                        </div>
                        <p className="text-xs text-gray-600">{f.description}</p>
                        {f.action_plan && <p className="text-xs text-blue-600 mt-0.5">Action: {f.action_plan}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg border overflow-hidden">
              <h3 className="font-semibold text-sm p-4 border-b">Waste Register</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs">Type</th>
                    <th className="text-left px-4 py-2 text-xs">Process</th>
                    <th className="text-left px-4 py-2 text-xs">Description</th>
                    <th className="text-left px-4 py-2 text-xs">Impact</th>
                    <th className="text-left px-4 py-2 text-xs">Est. Cost</th>
                    <th className="text-left px-4 py-2 text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waste.map((w, i) => (
                    <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${WASTE_COLORS[w.waste_type] || 'bg-gray-400'}`} />
                          <span className="text-xs font-medium">{w.waste_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{w.process_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate">{w.description}</td>
                      <td className="px-4 py-2"><Badge label={w.impact} colorClass={IMPACT_COLORS[w.impact] || 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-4 py-2 text-xs font-medium">${Number(w.estimated_cost_usd).toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{w.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Approval Optimizer' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Approval Optimizer</h2>
            <div className="bg-white rounded-lg border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3">Process</th>
                    <th className="text-left px-4 py-3">Step</th>
                    <th className="text-left px-4 py-3">Avg Wait</th>
                    <th className="text-left px-4 py-3">Approver</th>
                    <th className="text-left px-4 py-3">Bypass OK</th>
                    <th className="text-left px-4 py-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {bottlenecks.map((b, i) => (
                    <tr key={b.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium">{b.process_name}</td>
                      <td className="px-4 py-3 text-gray-600">{b.step_name}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${Number(b.avg_wait_hours) > 48 ? 'text-red-600' : Number(b.avg_wait_hours) > 24 ? 'text-amber-600' : 'text-green-600'}`}>
                          {b.avg_wait_hours}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.approver || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge label={b.bypass_eligible ? 'Yes' : 'No'} colorClass={b.bypass_eligible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{b.recommendation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">AI Approval Chain Optimization</h3>
                <button onClick={optimizeApprovals} disabled={aiLoading}
                  className="bg-purple-600 text-white text-sm px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50">
                  {aiLoading ? 'Optimizing…' : 'Get AI Recommendations'}
                </button>
              </div>
              {approvalRecs ? (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{approvalRecs}</pre>
              ) : (
                <p className="text-gray-400 text-sm">Click Get AI Recommendations for Ollama-powered approval chain suggestions.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'Task Mining' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Task Mining</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-semibold text-sm mb-3">Trigger New Mining Run</h3>
              <div className="flex gap-3">
                <input value={miningProcess} onChange={e => setMiningProcess(e.target.value)}
                  placeholder="Process name (e.g., Invoice Processing)"
                  className="flex-1 border rounded px-3 py-2 text-sm" />
                <button onClick={runMining} disabled={aiLoading || !miningProcess}
                  className="bg-teal-600 text-white text-sm px-4 py-2 rounded hover:bg-teal-700 disabled:opacity-50">
                  {aiLoading ? 'Running…' : 'Run Mining'}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {mining.map(run => (
                <div key={run.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{run.process_name}</h3>
                    <span className="text-xs text-gray-400">{new Date(run.run_at).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-blue-700">{run.events_analyzed?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Events Analyzed</p>
                    </div>
                    <div className="bg-purple-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-purple-700">{run.variants_found}</p>
                      <p className="text-xs text-gray-500">Variants Found</p>
                    </div>
                    <div className="bg-green-50 rounded p-2 text-center">
                      <p className="text-lg font-bold text-green-700">{run.conformance_score}%</p>
                      <p className="text-xs text-gray-500">Conformance Score</p>
                    </div>
                  </div>
                  {run.automation_candidates && Array.isArray(run.automation_candidates) && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Automation Candidates:</p>
                      <div className="flex flex-wrap gap-2">
                        {run.automation_candidates.map((c, i) => (
                          <span key={i} className="bg-teal-100 text-teal-700 text-xs px-2 py-1 rounded">
                            {c.task} ({Math.round((c.confidence || 0) * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Conformance Checker' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Conformance Checker</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <input value={conformanceInput.process_name} onChange={e => setConformanceInput(p => ({ ...p, process_name: e.target.value }))}
                  placeholder="Process name" className="border rounded px-3 py-2 text-sm" />
                <textarea value={conformanceInput.intended_flow} onChange={e => setConformanceInput(p => ({ ...p, intended_flow: e.target.value }))}
                  placeholder="Intended process flow (step by step)…" rows={4}
                  className="border rounded px-3 py-2 text-sm resize-none" />
                <textarea value={conformanceInput.actual_flow} onChange={e => setConformanceInput(p => ({ ...p, actual_flow: e.target.value }))}
                  placeholder="Actual observed flow (what really happens)…" rows={4}
                  className="border rounded px-3 py-2 text-sm resize-none" />
              </div>
              <button onClick={checkConformance} disabled={aiLoading || !conformanceInput.process_name}
                className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
                {aiLoading ? 'Checking…' : 'Check Conformance'}
              </button>
            </div>
            {conformanceResult ? (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">Conformance Analysis</h3>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{conformanceResult}</pre>
              </div>
            ) : (
              <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">
                Enter the intended and actual process flows, then click Check Conformance.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
