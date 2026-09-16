'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Vendor Registry' | 'Technology Decisions' | 'AI Guardrails' | 'Data Privacy' | 'Assessment Report';
const TABS: Tab[] = ['Vendor Registry', 'Technology Decisions', 'AI Guardrails', 'Data Privacy', 'Assessment Report'];

interface Vendor {
  id: number;
  name: string;
  category: string;
  capabilities: string[];
  pricing_model: string;
  data_residency: string[];
  compliance: string[];
  score: number;
  status: string;
  notes: string | null;
}

interface TechDecision {
  id: number;
  use_case: string;
  selected_tool: string;
  alternatives: string[];
  rationale: string;
  decided_by: string;
  decided_at: string;
  review_date: string;
}

interface Guardrail {
  id: number;
  name: string;
  rule_type: string;
  pattern: string;
  action: string;
  enabled: boolean;
  triggered_count: number;
}

interface PrivacyAssessment {
  id: number;
  system_name: string;
  data_types: string[];
  pii_present: boolean;
  retention_days: number;
  encryption: string;
  findings: string[];
  risk_level: string;
}

interface TestResult {
  verdict: string;
  triggered: Array<{ name: string; action: string; rule_type: string }>;
  passed: Array<{ name: string }>;
  triggered_count: number;
  passed_count: number;
}

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  evaluating: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};
const RISK_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${color}`}>
      {Math.round(score)}
    </div>
  );
}

export default function AiVendorPage() {
  const [tab, setTab] = useState<Tab>('Vendor Registry');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [decisions, setDecisions] = useState<TechDecision[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [assessResult, setAssessResult] = useState<Record<string, unknown> | null>(null);
  const [assessVendorId, setAssessVendorId] = useState<number | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [analyzeId, setAnalyzeId] = useState<number | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<Record<string, unknown> | null>(null);
  const [reportVendorId, setReportVendorId] = useState<number | null>(null);
  const [reportResult, setReportResult] = useState<Record<string, unknown> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, dRes, gRes, pRes] = await Promise.all([
        fetch('/api/admin/ai-vendor'),
        fetch('/api/admin/ai-vendor/technology'),
        fetch('/api/admin/ai-vendor/guardrails'),
        fetch('/api/admin/ai-vendor/privacy'),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVendors(d.vendors ?? []); }
      if (dRes.ok) { const d = await dRes.json(); setDecisions(d.decisions ?? []); }
      if (gRes.ok) { const d = await gRes.json(); setGuardrails(d.guardrails ?? []); }
      if (pRes.ok) { const d = await pRes.json(); setPrivacy(d.assessments ?? []); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runAssessment = async (id: number) => {
    setAiWorking(true);
    setAssessVendorId(id);
    setAssessResult(null);
    try {
      const res = await fetch(`/api/admin/ai-vendor/${id}/assess`, { method: 'POST' });
      const d = await res.json();
      setAssessResult(d.scorecard);
      loadAll();
    } finally {
      setAiWorking(false);
    }
  };

  const runGuardrailTest = async () => {
    if (!testPrompt) return;
    const res = await fetch('/api/admin/ai-vendor/guardrails/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: testPrompt }),
    });
    const d = await res.json();
    setTestResult(d);
    loadAll();
  };

  const runPrivacyAnalysis = async (id: number) => {
    setAiWorking(true);
    setAnalyzeId(id);
    setAnalyzeResult(null);
    try {
      const res = await fetch(`/api/admin/ai-vendor/privacy/${id}/analyze`, { method: 'POST' });
      const d = await res.json();
      setAnalyzeResult(d.analysis);
    } finally {
      setAiWorking(false);
    }
  };

  const runVendorReport = async (id: number) => {
    setAiWorking(true);
    setReportVendorId(id);
    setReportResult(null);
    try {
      const res = await fetch(`/api/admin/ai-vendor/${id}/assess`, { method: 'POST' });
      const d = await res.json();
      setReportResult(d.scorecard);
    } finally {
      setAiWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">AI Vendor & Technology Management</h1>
        <p className="text-slate-300 text-sm mt-1">Vendor assessment · Technology selection · Guardrails · Data privacy</p>
      </div>

      <div className="flex border-b bg-white px-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {/* ── Vendor Registry ── */}
        {tab === 'Vendor Registry' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map(v => (
                <div key={v.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{v.name}</h3>
                      <div className="text-sm text-gray-500">{v.category}</div>
                    </div>
                    <ScoreBadge score={Number(v.score)} />
                  </div>
                  <div className="mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[v.status] ?? 'bg-gray-100 text-gray-600'}`}>{v.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="font-medium">Pricing:</span> {v.pricing_model}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(v.capabilities ?? []).slice(0, 3).map(c => (
                      <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{c}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(v.compliance ?? []).map(c => (
                      <span key={c} className="px-1.5 py-0.5 bg-green-50 text-green-600 text-xs rounded">{c}</span>
                    ))}
                  </div>
                  {v.notes && <p className="text-xs text-gray-400 mb-3">{v.notes}</p>}
                  <button onClick={() => runAssessment(v.id)} disabled={aiWorking && assessVendorId === v.id}
                    className="w-full py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50">
                    {aiWorking && assessVendorId === v.id ? 'Assessing...' : 'Run AI Assessment'}
                  </button>
                  {assessResult && assessVendorId === v.id && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                      {(['security','compliance','cost','capability','support'] as const).map(dim => (
                        <div key={dim} className="flex justify-between py-0.5">
                          <span className="capitalize">{dim}</span>
                          <span className="font-medium">{(assessResult as Record<string, number>)[dim]}/100</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Technology Decisions ── */}
        {tab === 'Technology Decisions' && !loading && (
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b font-semibold text-gray-700">Technology Decision Log</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Use Case', 'Selected Tool', 'Alternatives', 'Rationale', 'Decided By', 'Decided', 'Review Date'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map(d => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{d.use_case}</td>
                    <td className="px-3 py-2 text-blue-600">{d.selected_tool}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{(Array.isArray(d.alternatives) ? d.alternatives : []).join(', ')}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs">{d.rationale}</td>
                    <td className="px-3 py-2">{d.decided_by}</td>
                    <td className="px-3 py-2 text-gray-400">{d.decided_at ? new Date(d.decided_at).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{d.review_date ? new Date(d.review_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AI Guardrails ── */}
        {tab === 'AI Guardrails' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Guardrail Test Console</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  placeholder="Enter a test prompt to check against all enabled guardrails..."
                  value={testPrompt}
                  onChange={e => setTestPrompt(e.target.value)}
                />
                <button onClick={runGuardrailTest} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Test</button>
              </div>
              {testResult && (
                <div className={`mt-3 rounded p-3 ${testResult.verdict === 'blocked' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="font-semibold mb-2">
                    Verdict: <span className={testResult.verdict === 'blocked' ? 'text-red-700' : 'text-green-700'}>{testResult.verdict.toUpperCase()}</span>
                  </div>
                  {testResult.triggered.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-red-700 mb-1">Triggered ({testResult.triggered_count}):</div>
                      {testResult.triggered.map((t, i) => (
                        <div key={i} className="text-xs text-red-600">• {t.name} → {t.action}</div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">{testResult.passed_count} rules passed</div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b font-semibold text-gray-700">Guardrail Rules</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Type', 'Action', 'Enabled', 'Triggers'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guardrails.map(g => (
                    <tr key={g.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{g.name}</td>
                      <td className="px-3 py-2 text-gray-500">{g.rule_type?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.action === 'block' ? 'bg-red-100 text-red-700' : g.action === 'redact' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {g.action}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {g.enabled ? 'on' : 'off'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-700">{g.triggered_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Data Privacy ── */}
        {tab === 'Data Privacy' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {(['high', 'medium', 'low'] as const).map(level => (
                <div key={level} className={`rounded-lg p-4 border ${RISK_COLOR[level]}`}>
                  <div className="text-sm font-medium capitalize">{level} Risk</div>
                  <div className="text-2xl font-bold">{privacy.filter(p => p.risk_level === level).length}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {privacy.map(p => (
                <div key={p.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{p.system_name}</h3>
                      <div className="text-sm text-gray-500">Retention: {p.retention_days} days · Encryption: {p.encryption}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLOR[p.risk_level] ?? ''}`}>{p.risk_level} risk</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.pii_present ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {p.pii_present ? 'PII Present' : 'No PII'}
                    </span>
                    {(p.data_types ?? []).map(dt => (
                      <span key={dt} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{dt}</span>
                    ))}
                  </div>
                  {(p.findings ?? []).length > 0 && (
                    <ul className="text-sm text-gray-600 mb-3 space-y-1">
                      {p.findings.map((f, i) => <li key={i} className="flex gap-1">⚠ {f}</li>)}
                    </ul>
                  )}
                  <button onClick={() => runPrivacyAnalysis(p.id)} disabled={aiWorking && analyzeId === p.id}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs disabled:opacity-50">
                    {aiWorking && analyzeId === p.id ? 'Analyzing...' : 'GDPR/PIPEDA Gap Analysis'}
                  </button>
                  {analyzeResult && analyzeId === p.id && (
                    <div className="mt-3 bg-purple-50 rounded p-3 text-xs text-gray-700">
                      {(['gdpr', 'pipeda', 'hipaa'] as const).map(reg => {
                        const r = (analyzeResult as Record<string, { status: string; gaps?: string[]; actions?: string[] }>)[reg];
                        if (!r) return null;
                        return (
                          <div key={reg} className="mb-2">
                            <div className="font-semibold uppercase text-xs text-gray-500 mb-1">{reg}: <span className="text-gray-700">{r.status}</span></div>
                            {(r.gaps ?? []).map((g, i) => <div key={i} className="text-red-600">Gap: {g}</div>)}
                            {(r.actions ?? []).map((a, i) => <div key={i} className="text-green-700">Action: {a}</div>)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Assessment Report ── */}
        {tab === 'Assessment Report' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">Generate Vendor Assessment Report</h2>
              <select
                className="border rounded px-3 py-2 text-sm mb-3 w-full max-w-xs"
                value={reportVendorId ?? ''}
                onChange={e => setReportVendorId(Number(e.target.value) || null)}
              >
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button onClick={() => reportVendorId && runVendorReport(reportVendorId)} disabled={!reportVendorId || aiWorking}
                className="block px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {aiWorking ? 'Generating...' : 'Generate AI Assessment'}
              </button>
              {reportResult && reportVendorId && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded p-4">
                  <h3 className="font-semibold text-blue-800 mb-3">{vendors.find(v => v.id === reportVendorId)?.name} — Assessment Scorecard</h3>
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    {(['security', 'compliance', 'cost', 'capability', 'support'] as const).map(dim => (
                      <div key={dim} className="text-center">
                        <div className="text-xs text-gray-500 capitalize mb-1">{dim}</div>
                        <div className={`text-xl font-bold ${Number((reportResult as Record<string, number>)[dim]) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {(reportResult as Record<string, number>)[dim]}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-sm font-medium text-gray-700">Overall: <span className="text-blue-700 text-lg font-bold">{(reportResult as Record<string, unknown>).overall as number}/100</span></div>
                    <div className="text-sm text-gray-600 mt-1">{(reportResult as Record<string, unknown>).summary as string}</div>
                    <div className="mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${(reportResult as Record<string, unknown>).recommendation === 'approve' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        Recommendation: {(reportResult as Record<string, unknown>).recommendation as string}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Vendor Comparison Matrix</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500">Vendor</th>
                    <th className="text-left px-3 py-2 text-gray-500">Score</th>
                    <th className="text-left px-3 py-2 text-gray-500">Status</th>
                    <th className="text-left px-3 py-2 text-gray-500">Pricing</th>
                    <th className="text-left px-3 py-2 text-gray-500">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${Number(v.score) >= 85 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${v.score}%` }} />
                          </div>
                          <span className="font-medium">{Math.round(Number(v.score))}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[v.status] ?? ''}`}>{v.status}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{v.pricing_model}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{(v.compliance ?? []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
