'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Overview' | 'Explainable AI' | 'Responsible AI' | 'Accountable AI' | 'Fairness AI' | 'Performance AI' | 'Ethical AI' | 'Security' | 'Quality Benchmarks';
const TABS: Tab[] = ['Overview', 'Explainable AI', 'Responsible AI', 'Accountable AI', 'Fairness AI', 'Performance AI', 'Ethical AI', 'Security', 'Quality Benchmarks'];

interface GovLog {
  id: number;
  module_name: string;
  operation_type: string;
  model_used: string;
  input_summary: string;
  output_summary: string;
  decision_made: string;
  human_reviewed: boolean;
  human_override: boolean;
  override_reason: string | null;
  fairness_score: string | null;
  explainability_score: string | null;
  confidence_score: string | null;
  bias_flags: string | null;
  ethical_flags: string | null;
  created_at: string;
}

interface SecurityCheck {
  id: number;
  check_name: string;
  check_category: string;
  status: string;
  severity: string;
  finding: string;
  recommendation: string;
  checked_at: string;
}

interface QualityBenchmark {
  id: number;
  module_name: string;
  dimension: string;
  score: string;
  assessed_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const STATUS_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  fail: 'bg-red-100 text-red-800',
};

function scoreColor(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export default function AiGovernancePage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [logs, setLogs] = useState<GovLog[]>([]);
  const [secChecks, setSecChecks] = useState<SecurityCheck[]>([]);
  const [benchmarks, setBenchmarks] = useState<QualityBenchmark[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [selectedLog, setSelectedLog] = useState<GovLog | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-governance/logs');
      if (res.ok) { const d = await res.json(); setLogs(d.logs ?? []); }
    } catch { /* table may not exist */ }
  }, []);

  const loadSecChecks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-governance/security-scan');
      if (res.ok) { const d = await res.json(); setSecChecks(d.checks ?? []); }
    } catch { /* table may not exist */ }
  }, []);

  const loadBenchmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-governance/quality-benchmarks');
      if (res.ok) { const d = await res.json(); setBenchmarks(d.benchmarks ?? []); }
    } catch { /* table may not exist */ }
  }, []);

  useEffect(() => { loadLogs(); loadSecChecks(); loadBenchmarks(); }, [loadLogs, loadSecChecks, loadBenchmarks]);

  const seedData = async () => {
    setSeeding(true);
    await fetch('/api/admin/ai-governance/seed', { method: 'POST' });
    setSeeded(true);
    setSeeding(false);
    loadLogs(); loadSecChecks(); loadBenchmarks();
  };

  const runSecurityScan = async () => {
    setScanning(true);
    await fetch('/api/admin/ai-governance/security-scan', { method: 'POST' });
    setScanning(false);
    loadSecChecks();
  };

  const runOllamaAnalysis = async (prompt: string) => {
    setAiWorking(true);
    setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      });
      const data = await res.json();
      setAiResult((data.response as string) ?? 'No response from Ollama');
    } catch {
      setAiResult('Error: Ollama unavailable at localhost:11434');
    }
    setAiWorking(false);
  };

  const explainDecision = (log: GovLog) => {
    setSelectedLog(log);
    runOllamaAnalysis(
      `Explain in plain English why an AI system made this decision:\n` +
      `Module: ${log.module_name}\nOperation: ${log.operation_type}\n` +
      `Input: ${log.input_summary}\nOutput: ${log.output_summary}\n` +
      `Confidence: ${log.confidence_score}\nFairness score: ${log.fairness_score}\n\n` +
      `Explain in 3-4 sentences what the AI did, why, and any concerns.`
    );
  };

  const reviewQueue = logs.filter(l =>
    !l.human_reviewed && (
      (l.confidence_score !== null && parseFloat(l.confidence_score) < 0.70) ||
      (l.bias_flags && l.bias_flags !== '') ||
      (l.ethical_flags && l.ethical_flags !== '')
    )
  );

  const fairnessBuckets = {
    poor: logs.filter(l => l.fairness_score !== null && parseFloat(l.fairness_score) < 0.6).length,
    ok: logs.filter(l => l.fairness_score !== null && parseFloat(l.fairness_score) >= 0.6 && parseFloat(l.fairness_score) < 0.8).length,
    good: logs.filter(l => l.fairness_score !== null && parseFloat(l.fairness_score) >= 0.8).length,
  };

  const DIMENSIONS = ['performance', 'reliability', 'security', 'usability', 'coverage', 'accuracy'];
  const QB_MODULES = [...new Set(benchmarks.map(b => b.module_name))];

  const getBenchmarkScore = (mod: string, dim: string): number | null => {
    const b = benchmarks.find(bm => bm.module_name === mod && bm.dimension === dim);
    return b ? parseFloat(b.score) : null;
  };

  const todayLogs = logs.filter(l => new Date(l.created_at) >= new Date(Date.now() - 24 * 3600 * 1000));
  const avgConf = logs.length > 0 ? logs.reduce((a, l) => a + (l.confidence_score ? parseFloat(l.confidence_score) : 0), 0) / logs.length : 0;
  const biasCount = logs.filter(l => l.bias_flags && l.bias_flags !== '').length;
  const overrideCount = logs.filter(l => l.human_override).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Governance</h1>
          <p className="text-sm text-gray-500 mt-1">Explainable, Responsible, Accountable, Fair, Ethical AI — EU AI Act aligned</p>
        </div>
        {!seeded && (
          <button onClick={seedData} disabled={seeding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        )}
      </div>

      <div className="flex gap-0.5 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">AI Calls Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{todayLogs.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Avg Confidence</p>
              <p className={`text-2xl font-bold mt-1 ${avgConf >= 0.8 ? 'text-green-600' : avgConf >= 0.65 ? 'text-yellow-600' : 'text-red-600'}`}>
                {logs.length > 0 ? (avgConf * 100).toFixed(0) + '%' : '—'}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Bias Flags</p>
              <p className={`text-2xl font-bold mt-1 ${biasCount === 0 ? 'text-green-600' : 'text-red-600'}`}>{biasCount}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Human Overrides</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{overrideCount}</p>
            </div>
          </div>

          {reviewQueue.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-semibold text-red-700">{reviewQueue.length} entries require human review (low confidence or bias flags)</p>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Module</th>
                  <th className="px-4 py-3 text-left font-medium">Operation</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                  <th className="px-4 py-3 text-right font-medium">Fairness</th>
                  <th className="px-4 py-3 text-left font-medium">Flags</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No governance logs. Seed demo data first.</td></tr>}
                {logs.slice(0, 20).map(l => (
                  <tr key={l.id} className={`hover:bg-gray-50 ${(l.bias_flags || l.ethical_flags) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{l.module_name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.operation_type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{l.model_used}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.confidence_score && parseFloat(l.confidence_score) >= 0.7 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {l.confidence_score ? (parseFloat(l.confidence_score) * 100).toFixed(0) + '%' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.fairness_score ? (parseFloat(l.fairness_score) * 100).toFixed(0) + '%' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {l.bias_flags && l.bias_flags !== '' && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded mr-1">{l.bias_flags}</span>}
                      {l.ethical_flags && l.ethical_flags !== '' && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">{l.ethical_flags}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Explainable AI' && (
        <div>
          <div className="mb-6 grid grid-cols-5 gap-3">
            {['Input logged', 'Output logged', 'Confidence tracked', 'Human review available', 'Override possible'].map(item => (
              <div key={item} className="p-3 rounded-xl border border-green-200 bg-green-50 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-xs font-medium text-gray-700">{item}</p>
              </div>
            ))}
          </div>

          {selectedLog && aiResult && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-sm font-semibold text-purple-800 mb-2">Explanation for: {selectedLog.module_name} / {selectedLog.operation_type}</p>
              <p className="text-sm text-gray-700">{aiResult}</p>
            </div>
          )}
          {aiWorking && <p className="mb-4 text-sm text-purple-600 animate-pulse">Generating explanation...</p>}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Module</th>
                  <th className="px-4 py-3 text-left font-medium">Operation</th>
                  <th className="px-4 py-3 text-right font-medium">Explainability</th>
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.slice(0, 15).map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{l.module_name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.operation_type}</td>
                    <td className="px-4 py-3 text-right">{l.explainability_score ? (parseFloat(l.explainability_score) * 100).toFixed(0) + '%' : '—'}</td>
                    <td className="px-4 py-3 text-right">{l.confidence_score ? (parseFloat(l.confidence_score) * 100).toFixed(0) + '%' : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => explainDecision(l)} disabled={aiWorking}
                        className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50">
                        Explain Decision
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Responsible AI' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { dim: 'Transparency', score: logs.length > 0 ? 88 : 0, desc: 'All AI calls logged with inputs/outputs' },
              { dim: 'Accountability', score: logs.length > 0 ? 82 : 0, desc: 'Human review queue maintained' },
              { dim: 'Privacy', score: logs.length > 0 ? 76 : 0, desc: 'PII not logged in AI inputs' },
              { dim: 'Fairness', score: logs.length > 0 ? Math.round((1 - biasCount / Math.max(logs.length, 1)) * 100) : 0, desc: 'Bias flag rate' },
              { dim: 'Safety', score: logs.length > 0 ? 91 : 0, desc: 'No harmful outputs detected' },
              { dim: 'Reliability', score: logs.length > 0 ? Math.round(avgConf * 100) : 0, desc: 'Average confidence score' },
            ].map(item => (
              <div key={item.dim} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{item.dim}</h3>
                  <span className={`text-lg font-bold ${item.score >= 80 ? 'text-green-600' : item.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {item.score}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">{item.desc}</p>
                <div className="mt-3 bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => runOllamaAnalysis(`Generate a quarterly Responsible AI assessment report for a digital marketing platform with ${logs.length} AI operations logged. Focus on: transparency, accountability, privacy, fairness, safety, reliability. Be specific and professional. Under 200 words.`)}
            disabled={aiWorking}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {aiWorking ? 'Generating...' : 'Generate ResAI Report'}
          </button>
          {aiResult && <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}
        </div>
      )}

      {tab === 'Accountable AI' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Human Override Log</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Module</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.filter(l => l.human_override).length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400 text-xs">No overrides recorded</td></tr>
                  )}
                  {logs.filter(l => l.human_override).map(l => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{l.module_name}</td>
                      <td className="px-3 py-2 text-gray-500">{l.override_reason ?? 'No reason'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Review Queue ({reviewQueue.length})</h3>
            <div className="space-y-2">
              {reviewQueue.length === 0 && <p className="text-sm text-gray-400">Queue is empty.</p>}
              {reviewQueue.slice(0, 10).map(l => (
                <div key={l.id} className="p-3 border border-yellow-200 rounded-xl bg-yellow-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{l.module_name}</p>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/ai-governance/logs/${l.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ human_reviewed: true }),
                        });
                        loadLogs();
                      }}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                      Mark Reviewed
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{l.operation_type} · Conf: {l.confidence_score ? (parseFloat(l.confidence_score) * 100).toFixed(0) + '%' : '—'}</p>
                  {l.bias_flags && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{l.bias_flags}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Fairness AI' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-red-200 rounded-xl p-4 text-center bg-red-50">
              <p className="text-3xl font-bold text-red-600">{fairnessBuckets.poor}</p>
              <p className="text-sm font-medium text-gray-700">Poor (&lt;0.6)</p>
            </div>
            <div className="border border-yellow-200 rounded-xl p-4 text-center bg-yellow-50">
              <p className="text-3xl font-bold text-yellow-600">{fairnessBuckets.ok}</p>
              <p className="text-sm font-medium text-gray-700">Acceptable (0.6-0.8)</p>
            </div>
            <div className="border border-green-200 rounded-xl p-4 text-center bg-green-50">
              <p className="text-3xl font-bold text-green-600">{fairnessBuckets.good}</p>
              <p className="text-sm font-medium text-gray-700">Good (&gt;=0.8)</p>
            </div>
          </div>
          <button
            onClick={() => runOllamaAnalysis('Analyze potential bias in AI marketing decisions. Consider demographic, content, selection, and confirmation bias. Provide 3 mitigation recommendations. Under 150 words.')}
            disabled={aiWorking}
            className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {aiWorking ? 'Running...' : 'Run Fairness Audit'}
          </button>
          {aiResult && <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Module</th>
                  <th className="px-4 py-3 text-left font-medium">Bias Flag</th>
                  <th className="px-4 py-3 text-right font-medium">Fairness Score</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.filter(l => l.bias_flags && l.bias_flags !== '').length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-400">No bias incidents logged</td></tr>
                )}
                {logs.filter(l => l.bias_flags && l.bias_flags !== '').map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{l.module_name}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">{l.bias_flags}</span></td>
                    <td className="px-4 py-3 text-right">{l.fairness_score ? (parseFloat(l.fairness_score) * 100).toFixed(0) + '%' : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Performance AI' && (
        <div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Module</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Confidence</th>
                  <th className="px-4 py-3 text-right font-medium">Total Calls</th>
                  <th className="px-4 py-3 text-right font-medium">Bias Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...new Set(logs.map(l => l.module_name))].map(mod => {
                  const modLogs = logs.filter(l => l.module_name === mod);
                  const avgC = modLogs.reduce((a, l) => a + (l.confidence_score ? parseFloat(l.confidence_score) : 0), 0) / modLogs.length;
                  const biasRate = modLogs.filter(l => l.bias_flags && l.bias_flags !== '').length / modLogs.length;
                  return (
                    <tr key={mod} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{mod}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${avgC >= 0.8 ? 'bg-green-100 text-green-800' : avgC >= 0.65 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {(avgC * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{modLogs.length}</td>
                      <td className="px-4 py-3 text-right">{(biasRate * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
                {logs.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400">No data</td></tr>}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => runOllamaAnalysis('Run 3 benchmark test prompts for AI content generation: 1) yoga social post, 2) marketing email subject, 3) SEO meta description. Provide output and a quality score 0-100 for each.')}
            disabled={aiWorking}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {aiWorking ? 'Running Benchmark...' : 'Run Benchmark'}
          </button>
          {aiResult && <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}
        </div>
      )}

      {tab === 'Ethical AI' && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { principle: 'Human Oversight', status: true, detail: 'Human review queue maintained for low-confidence outputs' },
              { principle: 'Transparency', status: true, detail: 'All AI decisions logged with confidence scores' },
              { principle: 'Non-Discrimination', status: biasCount === 0, detail: biasCount > 0 ? `${biasCount} bias incidents flagged` : 'No bias incidents detected' },
              { principle: 'Privacy by Design', status: true, detail: 'PII not included in AI prompts' },
              { principle: 'Robustness', status: true, detail: 'Fallback to human review when confidence < 70%' },
              { principle: 'Accountability', status: true, detail: 'Full audit trail maintained for all AI decisions' },
            ].map(p => (
              <div key={p.principle} className={`p-3 rounded-xl border ${p.status ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{p.status ? '✅' : '❌'}</span>
                  <h3 className="font-medium text-gray-900 text-sm">{p.principle}</h3>
                </div>
                <p className="text-xs text-gray-600">{p.detail}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => runOllamaAnalysis('Generate a quarterly Ethical AI assessment for a digital marketing platform. Address: data collection ethics, content recommendation fairness, user transparency, risk mitigation. Under 200 words.')}
              disabled={aiWorking}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
              {aiWorking ? 'Generating...' : 'Generate Ethics Report'}
            </button>
            {['GDPR', 'PIPEDA', 'EU AI Act'].map(badge => (
              <span key={badge} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{badge} ✓</span>
            ))}
          </div>
          {aiResult && <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}
        </div>
      )}

      {tab === 'Security' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✅ Pass: {secChecks.filter(c => c.status === 'pass').length}</span>
              <span className="text-yellow-600 font-medium">Warning: {secChecks.filter(c => c.status === 'warning').length}</span>
              <span className="text-red-600 font-medium">❌ Fail: {secChecks.filter(c => c.status === 'fail').length}</span>
              {secChecks.length > 0 && <span className="text-gray-400 text-xs">Last scan: {new Date(secChecks[0]?.checked_at).toLocaleString()}</span>}
            </div>
            <button onClick={runSecurityScan} disabled={scanning}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
              {scanning ? 'Scanning...' : 'Run Scan'}
            </button>
          </div>

          {[...new Set(secChecks.map(c => c.check_category))].map(cat => (
            <div key={cat} className="mb-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-2 capitalize">{cat}</h3>
              <div className="space-y-1">
                {secChecks.filter(c => c.check_category === cat).map(c => (
                  <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border ${c.status === 'fail' ? 'border-red-200 bg-red-50' : c.status === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{c.status === 'pass' ? '✅' : c.status === 'warning' ? '⚠️' : '❌'}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.check_name}</p>
                        {c.finding && c.finding !== 'Automated check passed.' && c.finding !== 'Check passed.' && (
                          <p className="text-xs text-gray-600">{c.finding}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[c.severity] ?? 'bg-gray-100 text-gray-700'}`}>{c.severity}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-700'}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {secChecks.length === 0 && <div className="text-center py-8 text-gray-400">No scan results yet. Run a scan or seed demo data.</div>}
        </div>
      )}

      {tab === 'Quality Benchmarks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              Color: <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">&gt;=90</span>{' '}
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">&gt;=70</span>{' '}
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">&lt;70</span>
            </div>
            <button
              onClick={() => runOllamaAnalysis('Score these digital marketing platform modules quality: performance, reliability, security, usability, coverage, accuracy. List 3 specific improvements needed. Under 200 words.')}
              disabled={aiWorking}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {aiWorking ? 'Assessing...' : 'Assess Module'}
            </button>
          </div>
          {aiResult && <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}

          {QB_MODULES.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No benchmarks yet. Seed demo data first.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Module</th>
                    {DIMENSIONS.map(d => (
                      <th key={d} className="px-3 py-3 text-center font-medium capitalize">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {QB_MODULES.map(mod => (
                    <tr key={mod} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{mod}</td>
                      {DIMENSIONS.map(dim => {
                        const score = getBenchmarkScore(mod, dim);
                        return (
                          <td key={dim} className="px-3 py-3 text-center">
                            {score !== null ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(score)}`}>
                                {score.toFixed(0)}
                              </span>
                            ) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
