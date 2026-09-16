'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'AI Factory' | 'AI Pipelines' | 'Opportunity Discovery' | 'Maturity Assessment' | 'Multi-Cloud' | 'Transformation Roadmap';
const TABS: Tab[] = ['AI Factory', 'AI Pipelines', 'Opportunity Discovery', 'Maturity Assessment', 'Multi-Cloud', 'Transformation Roadmap'];

interface FactoryModel {
  id: number;
  name: string;
  provider: string;
  type: string;
  version: string;
  endpoint: string;
  status: string;
  tags: string[];
  performance_score: number;
}

interface Pipeline {
  id: number;
  name: string;
  description: string;
  steps: string[];
  trigger_type: string;
  status: string;
  last_run: string | null;
  run_count: number;
}

interface Opportunity {
  id: number;
  title: string;
  department: string;
  current_process: string;
  ai_solution: string;
  effort: string;
  impact: string;
  status: string;
  roi_estimate: number;
}

interface MaturityScore {
  id: number;
  dimension: string;
  current_score: number;
  target_score: number;
  evidence: string;
  gap_actions: string[];
  assessed_at: string;
}

interface CloudDeployment {
  id: number;
  model_name: string;
  cloud_provider: string;
  region: string;
  instance_type: string;
  monthly_cost: number;
  status: string;
}

const EFFORT_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};
const IMPACT_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-purple-100 text-purple-700',
};
const PROVIDER_COLOR: Record<string, string> = {
  Ollama: 'bg-green-100 text-green-700',
  OpenAI: 'bg-blue-100 text-blue-700',
  Anthropic: 'bg-orange-100 text-orange-700',
  'On-Premise': 'bg-gray-100 text-gray-700',
};

const MATURITY_LABELS = ['', 'Initial', 'Developing', 'Defined', 'Managed', 'Optimizing'];

const ROADMAP_PHASES = [
  { phase: 'Foundation (Q4 2026)', color: 'bg-gray-100 border-gray-300', items: ['Deploy vector DB (pgvector)', 'Complete AI literacy training for all staff', 'Hire senior ML engineer'] },
  { phase: 'Pilot (Q1 2027)', color: 'bg-blue-50 border-blue-300', items: ['Launch RAG FAQ chatbot (PoC → prod)', 'Deploy lead scoring model', 'Establish AI Ethics Committee'] },
  { phase: 'Scale (Q2 2027)', color: 'bg-yellow-50 border-yellow-300', items: ['Content generation pipeline at scale', 'MLOps platform (MLflow) live', 'EU AI Act compliance assessment'] },
  { phase: 'Optimize (Q3 2027)', color: 'bg-green-50 border-green-300', items: ['Dynamic pricing model live', 'Real-time fraud detection', 'Full AI governance dashboard operational'] },
  { phase: 'Innovate (Q4 2027)', color: 'bg-purple-50 border-purple-300', items: ['Computer vision yoga pose feedback', 'Foundation model fine-tuning program', 'AI Center of Excellence established'] },
];

export default function AiFactoryPage() {
  const [tab, setTab] = useState<Tab>('AI Factory');
  const [models, setModels] = useState<FactoryModel[]>([]);
  const [federation, setFederation] = useState<Record<string, number>>({});
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [maturity, setMaturity] = useState<MaturityScore[]>([]);
  const [deployments, setDeployments] = useState<CloudDeployment[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [benchmarkId, setBenchmarkId] = useState<number | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<Record<string, unknown> | null>(null);
  const [scanDesc, setScanDesc] = useState('');
  const [scannedOpps, setScannedOpps] = useState<object[]>([]);
  const [assessDesc, setAssessDesc] = useState('');
  const [assessResult, setAssessResult] = useState<Record<string, unknown> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes, oRes, matRes, cRes] = await Promise.all([
        fetch('/api/admin/ai-factory'),
        fetch('/api/admin/ai-factory/pipelines'),
        fetch('/api/admin/ai-factory/opportunities'),
        fetch('/api/admin/ai-factory/maturity'),
        fetch('/api/admin/ai-factory/cloud'),
      ]);
      if (mRes.ok) { const d = await mRes.json(); setModels(d.models ?? []); setFederation(d.federation ?? {}); }
      if (pRes.ok) { const d = await pRes.json(); setPipelines(d.pipelines ?? []); }
      if (oRes.ok) { const d = await oRes.json(); setOpportunities(d.opportunities ?? []); }
      if (matRes.ok) { const d = await matRes.json(); setMaturity(d.maturity ?? []); }
      if (cRes.ok) { const d = await cRes.json(); setDeployments(d.deployments ?? []); setTotalMonthly(d.total_monthly ?? 0); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runBenchmark = async (id: number) => {
    setAiWorking(true);
    setBenchmarkId(id);
    setBenchmarkResult(null);
    try {
      const res = await fetch(`/api/admin/ai-factory/${id}/benchmark`, { method: 'POST' });
      const d = await res.json();
      setBenchmarkResult(d.benchmark);
      loadAll();
    } finally {
      setAiWorking(false);
    }
  };

  const runPipeline = async (id: number) => {
    await fetch(`/api/admin/ai-factory/pipelines/${id}/run`, { method: 'POST' });
    loadAll();
  };

  const scanOpportunities = async () => {
    setAiWorking(true);
    setScannedOpps([]);
    try {
      const res = await fetch('/api/admin/ai-factory/opportunities/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_description: scanDesc }),
      });
      const d = await res.json();
      setScannedOpps(d.opportunities ?? []);
    } finally {
      setAiWorking(false);
    }
  };

  const runMaturityAssess = async () => {
    setAiWorking(true);
    setAssessResult(null);
    try {
      const res = await fetch('/api/admin/ai-factory/maturity/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_description: assessDesc }),
      });
      const d = await res.json();
      setAssessResult(d.assessment);
    } finally {
      setAiWorking(false);
    }
  };

  const avgMaturity = maturity.length
    ? Math.round((maturity.reduce((s, m) => s + m.current_score, 0) / maturity.length) * 10) / 10
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">AI Factory & Transformation</h1>
        <p className="text-slate-300 text-sm mt-1">Model federation · Pipelines · Opportunity discovery · Maturity · Multi-cloud · Roadmap</p>
      </div>

      <div className="flex border-b bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {/* ── AI Factory ── */}
        {tab === 'AI Factory' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Federation Topology</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(federation).map(([provider, count]) => (
                  <div key={provider} className={`px-4 py-2 rounded-lg border ${PROVIDER_COLOR[provider] ?? 'bg-gray-100 text-gray-700'}`}>
                    <div className="font-bold">{provider}</div>
                    <div className="text-sm">{count} model{count > 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map(m => (
                <div key={m.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{m.name}</h3>
                      <div className="text-xs text-gray-500">v{m.version} · {m.type?.replace('_', ' ')}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PROVIDER_COLOR[m.provider] ?? ''}`}>{m.provider}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(m.tags ?? []).map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{t}</span>)}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${m.performance_score}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-600">{Math.round(Number(m.performance_score))}</span>
                  </div>
                  <button onClick={() => runBenchmark(m.id)} disabled={aiWorking && benchmarkId === m.id}
                    className="w-full py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50">
                    {aiWorking && benchmarkId === m.id ? 'Benchmarking...' : 'Run Benchmark'}
                  </button>
                  {benchmarkResult && benchmarkId === m.id && (
                    <div className="mt-2 bg-blue-50 rounded p-2 text-xs text-gray-700 space-y-1">
                      <div className="flex justify-between"><span>Latency P50</span><b>{(benchmarkResult as Record<string, number>).latency_p50_ms}ms</b></div>
                      <div className="flex justify-between"><span>Throughput</span><b>{(benchmarkResult as Record<string, number>).throughput_tokens_per_sec} tok/s</b></div>
                      <div className="flex justify-between"><span>Quality</span><b>{(benchmarkResult as Record<string, number>).quality_score}/100</b></div>
                      <div className="flex justify-between"><span>Cost/1k tok</span><b>${(benchmarkResult as Record<string, number>).cost_per_1k_tokens_usd}</b></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Pipelines ── */}
        {tab === 'AI Pipelines' && !loading && (
          <div className="space-y-4">
            {pipelines.map(p => (
              <div key={p.id} className="bg-white rounded-lg border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{p.name}</h3>
                    <div className="text-sm text-gray-500">{p.description}</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    <div className="text-xs text-gray-400 mt-1">{p.trigger_type} · {p.run_count} runs</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                  {(Array.isArray(p.steps) ? p.steps : []).map((step: string, i: number) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded whitespace-nowrap">{step}</div>
                      {i < (Array.isArray(p.steps) ? p.steps : []).length - 1 && <span className="text-gray-300">→</span>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => runPipeline(p.id)} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm">
                    ▶ Run Now
                  </button>
                  {p.last_run && (
                    <span className="text-xs text-gray-400">Last run: {new Date(p.last_run).toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Opportunity Discovery ── */}
        {tab === 'Opportunity Discovery' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-2">AI Opportunity Scanner</h2>
              <p className="text-sm text-gray-500 mb-3">Describe your business and Ollama will identify the top 5 AI automation opportunities</p>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-24 mb-3"
                placeholder="Describe your business processes, team size, current tools, and pain points..."
                value={scanDesc}
                onChange={e => setScanDesc(e.target.value)}
              />
              <button onClick={scanOpportunities} disabled={aiWorking || !scanDesc}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
                {aiWorking ? 'Scanning...' : 'Scan for AI Opportunities'}
              </button>
              {scannedOpps.length > 0 && (
                <div className="mt-4 space-y-2">
                  {(scannedOpps as Array<Record<string, unknown>>).map((o, i) => (
                    <div key={i} className="border rounded p-3 bg-purple-50">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-gray-800 text-sm">{o.title as string}</h4>
                        <div className="flex gap-1">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${EFFORT_COLOR[o.effort as string] ?? ''}`}>{o.effort as string}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${IMPACT_COLOR[o.impact as string] ?? ''}`}>{o.impact as string}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{o.department as string} · {o.current_process as string}</div>
                      <div className="text-xs text-blue-600 mt-1">AI: {o.ai_solution as string}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Opportunity Prioritization Matrix</h2>
              <div className="relative bg-gray-50 rounded border" style={{ height: 320 }}>
                <div className="absolute top-2 left-2 text-xs text-gray-400 font-medium">Impact ↑</div>
                <div className="absolute bottom-2 right-2 text-xs text-gray-400 font-medium">Effort →</div>
                {opportunities.map((o, i) => {
                  const effortX = { low: 20, medium: 50, high: 80 }[o.effort] ?? 50;
                  const impactY = { low: 80, medium: 50, high: 15 }[o.impact] ?? 50;
                  return (
                    <div key={o.id} className="absolute" style={{ left: `${effortX}%`, top: `${impactY}%`, transform: 'translate(-50%,-50%)' }}>
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow ${i % 3 === 0 ? 'bg-blue-500' : i % 3 === 1 ? 'bg-green-500' : 'bg-purple-500'}`} title={o.title} />
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap bg-white px-1 rounded shadow text-center" style={{ fontSize: '10px' }}>{o.title.length > 20 ? o.title.slice(0, 18) + '…' : o.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b font-semibold text-gray-700">Opportunity Registry</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Title', 'Dept', 'Effort', 'Impact', 'Status', 'ROI (hrs/mo)'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map(o => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{o.title}</td>
                      <td className="px-3 py-2 text-gray-500">{o.department}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${EFFORT_COLOR[o.effort] ?? ''}`}>{o.effort}</span></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${IMPACT_COLOR[o.impact] ?? ''}`}>{o.impact}</span></td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${o.status === 'approved' ? 'bg-green-100 text-green-700' : o.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-700">{Number(o.roi_estimate).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Maturity Assessment ── */}
        {tab === 'Maturity Assessment' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Avg Maturity Level</div>
                <div className="text-2xl font-bold text-blue-600">{avgMaturity} / 5</div>
                <div className="text-xs text-gray-400">{MATURITY_LABELS[Math.round(avgMaturity)] ?? ''}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Dimensions Assessed</div>
                <div className="text-2xl font-bold text-gray-700">{maturity.length}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Open Gap Actions</div>
                <div className="text-2xl font-bold text-orange-600">{maturity.reduce((s, m) => s + (m.gap_actions ?? []).length, 0)}</div>
              </div>
            </div>

            {/* Spider chart data table */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">Maturity by Dimension</h2>
              <div className="space-y-3">
                {maturity.map(m => (
                  <div key={m.id} className="border-b last:border-0 pb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-700">{m.dimension}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Target: {m.target_score}</span>
                        <span className="font-bold text-blue-600">{m.current_score}/5</span>
                        <span className="text-xs text-gray-400">{MATURITY_LABELS[m.current_score]}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={`flex-1 h-3 rounded-sm ${n <= m.current_score ? 'bg-blue-500' : n <= m.target_score ? 'bg-blue-100' : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{m.evidence}</div>
                    <div className="flex flex-wrap gap-1">
                      {(m.gap_actions ?? []).map((a, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded">→ {a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-2">AI Maturity Assessment</h2>
              <p className="text-sm text-gray-500 mb-3">Describe your organization and Ollama will assess your AI maturity</p>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-24 mb-3"
                placeholder="Describe your organization: size, industry, current AI use, data infrastructure, team skills..."
                value={assessDesc}
                onChange={e => setAssessDesc(e.target.value)}
              />
              <button onClick={runMaturityAssess} disabled={aiWorking || !assessDesc}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {aiWorking ? 'Assessing...' : 'Run AI Maturity Assessment'}
              </button>
              {assessResult && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded p-4 text-sm text-gray-700">
                  <div className="font-semibold text-blue-800 mb-2">Overall Level: {(assessResult as Record<string, unknown>).overall_level as number}/5</div>
                  {(['Strategy','Data','Technology','People','Governance','Culture'] as const).map(dim => {
                    const d = (assessResult as Record<string, { score: number; evidence: string }>)[dim];
                    if (!d) return null;
                    return (
                      <div key={dim} className="flex gap-3 py-1 border-b last:border-0">
                        <span className="w-24 font-medium">{dim}</span>
                        <span className="text-blue-700 font-bold">{d.score}/5</span>
                        <span className="text-gray-500 text-xs">{d.evidence}</span>
                      </div>
                    );
                  })}
                  <div className="mt-2 text-blue-800 font-medium">Priority: {(assessResult as Record<string, unknown>).key_recommendation as string}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Multi-Cloud ── */}
        {tab === 'Multi-Cloud' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Monthly Cloud Spend</div>
                <div className="text-2xl font-bold text-blue-600">${Number(totalMonthly).toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">On-Premise (Local)</div>
                <div className="text-2xl font-bold text-green-600">{deployments.filter(d => d.cloud_provider === 'On-Premise').length} models</div>
                <div className="text-xs text-gray-400">$0/month</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Cloud API Models</div>
                <div className="text-2xl font-bold text-orange-600">{deployments.filter(d => d.cloud_provider !== 'On-Premise').length} models</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Deployment Map</h2>
              <div className="grid grid-cols-1 gap-3">
                {deployments.map(d => (
                  <div key={d.id} className="flex items-center gap-4 border rounded p-3">
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${PROVIDER_COLOR[d.cloud_provider] ?? 'bg-gray-100 text-gray-700'}`}>{d.cloud_provider}</div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{d.model_name}</div>
                      <div className="text-xs text-gray-500">{d.region} · {d.instance_type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${Number(d.monthly_cost).toFixed(2)}/mo</div>
                      <span className="text-xs text-green-600">{d.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Transformation Roadmap ── */}
        {tab === 'Transformation Roadmap' && !loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">AI Transformation Roadmap — Phased Initiative Timeline</h2>
              <div className="space-y-4">
                {ROADMAP_PHASES.map(phase => (
                  <div key={phase.phase} className={`border rounded-lg p-4 ${phase.color}`}>
                    <h3 className="font-bold text-gray-800 mb-2">{phase.phase}</h3>
                    <ul className="space-y-1">
                      {phase.items.map((item, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span className="text-gray-400">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Maturity → Roadmap Alignment</h2>
              <div className="grid grid-cols-2 gap-4">
                {maturity.map(m => (
                  <div key={m.id} className="border rounded p-3">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium text-gray-700">{m.dimension}</span>
                      <span className="text-xs text-gray-500">{m.current_score} → {m.target_score}</span>
                    </div>
                    <div className="text-xs text-orange-600">{(m.gap_actions ?? [])[0] ?? '—'}</div>
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
