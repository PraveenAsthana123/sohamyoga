'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'FinOps Dashboard' | 'Cost Optimizer' | 'Security Controls' | 'Vulnerability Tracker';
const TABS: Tab[] = ['FinOps Dashboard', 'Cost Optimizer', 'Security Controls', 'Vulnerability Tracker'];

interface CloudCost { id: number; provider: string; service_name: string; month: string; cost_usd: number; budget_usd: number; anomaly: boolean; }
interface OptAction { id: number; title: string; service: string; action_type: string; estimated_savings: number; effort: string; status: string; }
interface SecurityControl { id: number; control_name: string; category: string; status: string; last_checked: string; evidence: string; risk_if_missing: string; }
interface Vulnerability { id: number; title: string; severity: string; cve_id: string; affected_system: string; status: string; remediation: string; discovered_at: string; }

const SEV_COLOR: Record<string, string> = { critical: 'bg-red-200 text-red-900', high: 'bg-red-100 text-red-800', medium: 'bg-orange-100 text-orange-700', low: 'bg-yellow-100 text-yellow-700' };
const SEC_COLOR: Record<string, string> = { compliant: 'bg-green-100 text-green-700', partial: 'bg-yellow-100 text-yellow-700', non_compliant: 'bg-red-100 text-red-700' };
const EFFORT_COLOR: Record<string, string> = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' };

export default function FinOpsHubPage() {
  const [tab, setTab] = useState<Tab>('FinOps Dashboard');
  const [costs, setCosts] = useState<CloudCost[]>([]);
  const [actions, setActions] = useState<OptAction[]>([]);
  const [controls, setControls] = useState<SecurityControl[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [stats, setStats] = useState<{ total_spend: string; total_budget: string; anomaly_count: string }>({ total_spend: '0', total_budget: '0', anomaly_count: '0' });
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [securityScan, setSecurityScan] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const [cRes, aRes, sRes, vRes] = await Promise.all([
      fetch('/api/admin/finops-hub'),
      fetch('/api/admin/finops-hub/actions'),
      fetch('/api/admin/finops-hub/security'),
      fetch('/api/admin/finops-hub/vulnerabilities'),
    ]);
    if (cRes.ok) { const d = await cRes.json() as { costs: CloudCost[]; stats: typeof stats }; setCosts(d.costs || []); setStats(d.stats); }
    if (aRes.ok) setActions(await aRes.json() as OptAction[]);
    if (sRes.ok) setControls(await sRes.json() as SecurityControl[]);
    if (vRes.ok) setVulns(await vRes.json() as Vulnerability[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/finops-hub/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setAnalysisResult(await res.json() as Record<string, unknown>);
      await loadData();
    } finally { setLoading(false); }
  };

  const runSecurityScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/finops-hub/security/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setSecurityScan(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const updateVuln = async (id: number, status: string) => {
    await fetch(`/api/admin/finops-hub/vulnerabilities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await loadData();
  };

  // Aggregate costs by provider for chart
  const byProvider: Record<string, number> = {};
  costs.forEach(c => { byProvider[c.provider] = (byProvider[c.provider] || 0) + Number(c.cost_usd); });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">FinOps Hub</h1>
        <p className="text-slate-300 text-sm">Cloud cost management, optimization actions, security controls & vulnerability tracking</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">${Number(stats.total_spend).toFixed(0)}</span><span className="text-gray-500 text-sm ml-1">Total Spend</span></div>
        <div><span className="text-2xl font-bold text-slate-800">${Number(stats.total_budget).toFixed(0)}</span><span className="text-gray-500 text-sm ml-1">Total Budget</span></div>
        <div><span className={`text-2xl font-bold ${Number(stats.anomaly_count) > 0 ? 'text-red-600' : 'text-green-700'}`}>{stats.anomaly_count}</span><span className="text-gray-500 text-sm ml-1">Anomalies</span></div>
        <div><span className="text-2xl font-bold text-orange-600">{vulns.filter(v => v.status === 'open').length}</span><span className="text-gray-500 text-sm ml-1">Open Vulns</span></div>
        <div><span className={`text-2xl font-bold ${controls.filter(c => c.status === 'non_compliant').length > 0 ? 'text-red-600' : 'text-green-700'}`}>{Math.round((controls.filter(c => c.status === 'compliant').length / Math.max(controls.length, 1)) * 100)}%</span><span className="text-gray-500 text-sm ml-1">Security Score</span></div>
      </div>

      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* FinOps Dashboard */}
        {tab === 'FinOps Dashboard' && (
          <div className="space-y-6">
            {/* Provider breakdown */}
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(byProvider).map(([prov, spend]) => (
                <div key={prov} className="bg-white rounded-lg border p-4">
                  <p className="font-medium text-sm text-slate-700">{prov}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">${Number(spend).toFixed(0)}</p>
                  {costs.filter(c => c.provider === prov && c.anomaly).length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded mt-2 inline-block">⚠ {costs.filter(c => c.provider === prov && c.anomaly).length} anomaly</span>
                  )}
                </div>
              ))}
            </div>
            {/* Cost table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Provider','Service','Month','Cost','Budget','Variance','Anomaly'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{costs.map(c => {
                  const variance = ((Number(c.cost_usd) - Number(c.budget_usd)) / Number(c.budget_usd) * 100).toFixed(0);
                  return (
                    <tr key={c.id} className={`border-t hover:bg-gray-50 ${c.anomaly ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{c.provider}</td>
                      <td className="px-4 py-3 text-gray-700">{c.service_name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.month}</td>
                      <td className="px-4 py-3 font-bold">${Number(c.cost_usd).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">${Number(c.budget_usd).toFixed(2)}</td>
                      <td className={`px-4 py-3 font-medium ${Number(variance) > 0 ? 'text-red-600' : 'text-green-700'}`}>{Number(variance) > 0 ? '+' : ''}{variance}%</td>
                      <td className="px-4 py-3">{c.anomaly ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠ Anomaly</span> : <span className="text-xs text-gray-300">—</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cost Optimizer */}
        {tab === 'Cost Optimizer' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Cost Analyzer</h2>
              <button onClick={runAnalysis} disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mb-4">
                {loading ? 'Analyzing...' : '🤖 Analyze All Costs'}
              </button>
              {analysisResult && (
                <div className="space-y-3">
                  <div className={`rounded p-3 ${String(analysisResult.budget_health) === 'over' ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs font-bold">Budget Health: <span className="capitalize">{String(analysisResult.budget_health)}</span></p>
                  </div>
                  <div className="bg-green-50 rounded p-3"><p className="text-xs font-bold text-green-800">Potential Savings</p><p className="text-2xl font-bold text-green-700">${String(analysisResult.total_potential_savings)}</p></div>
                  <div><p className="text-xs font-bold text-gray-700">Key Findings</p>{(analysisResult.key_findings as string[]).map((f: string, i: number) => <p key={i} className="text-xs text-gray-600">• {f}</p>)}</div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Optimization Actions</h2>
              <div className="space-y-3">
                {actions.map(a => (
                  <div key={a.id} className="border rounded p-4">
                    <div className="flex justify-between items-start">
                      <div><p className="font-medium text-sm">{a.title}</p><p className="text-xs text-gray-500">{a.service} · {a.action_type}</p></div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${EFFORT_COLOR[a.effort]}`}>{a.effort}</span>
                        <span className="text-sm font-bold text-green-700">${Number(a.estimated_savings).toFixed(0)}/mo</span>
                      </div>
                    </div>
                  </div>
                ))}
                {analysisResult && (analysisResult.optimizations as Record<string,unknown>[])?.map((o, i) => (
                  <div key={i} className="border border-blue-200 rounded p-4 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div><p className="font-medium text-sm">{String(o.title)}</p><p className="text-xs text-gray-600">{String(o.rationale)}</p></div>
                      <span className="text-sm font-bold text-blue-700">${String(o.estimated_savings)}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Security Controls */}
        {tab === 'Security Controls' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-2">Security Posture</h2>
              <div className="text-center my-4">
                <p className="text-5xl font-bold text-blue-700">{Math.round((controls.filter(c => c.status === 'compliant').length / Math.max(controls.length, 1)) * 100)}</p>
                <p className="text-sm text-gray-500">/ 100 Score</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                {(['compliant','partial','non_compliant'] as const).map(s => (
                  <div key={s} className={`rounded p-2 ${SEC_COLOR[s]}`}>
                    <p className="text-lg font-bold">{controls.filter(c => c.status === s).length}</p>
                    <p className="text-xs capitalize">{s.replace('_',' ')}</p>
                  </div>
                ))}
              </div>
              <button onClick={runSecurityScan} disabled={loading}
                className="w-full bg-slate-700 text-white py-2 rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                {loading ? 'Scanning...' : '🔐 AI Security Scan'}
              </button>
              {securityScan && (
                <div className="mt-4 space-y-2">
                  <div className={`rounded p-3 ${Number(securityScan.overall_score) >= 80 ? 'bg-green-50' : 'bg-orange-50'}`}>
                    <p className="text-xs font-bold">Overall Score: {String(securityScan.overall_score)}/100 — {String(securityScan.risk_level)} risk</p>
                  </div>
                  <p className="text-xs text-gray-700 italic">{String(securityScan.recommendation)}</p>
                </div>
              )}
            </div>
            <div className="col-span-2 space-y-3">
              {controls.map(c => (
                <div key={c.id} className="bg-white border rounded p-4">
                  <div className="flex justify-between items-start">
                    <div><p className="font-medium text-sm">{c.control_name}</p><p className="text-xs text-gray-500">{c.category}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded ${SEC_COLOR[c.status]}`}>{c.status.replace('_',' ')}</span>
                  </div>
                  {c.evidence && <p className="text-xs text-gray-600 mt-2">Evidence: {c.evidence}</p>}
                  {c.risk_if_missing && <p className="text-xs text-red-600 mt-1">Risk: {c.risk_if_missing}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vulnerability Tracker */}
        {tab === 'Vulnerability Tracker' && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {(['critical','high','medium','low'] as const).map(s => (
                <div key={s} className={`rounded-lg border p-4 text-center ${SEV_COLOR[s]}`}>
                  <p className="text-xs font-medium capitalize">{s}</p>
                  <p className="text-2xl font-bold">{vulns.filter(v => v.severity === s).length}</p>
                  <p className="text-xs">{vulns.filter(v => v.severity === s && v.status === 'open').length} open</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {vulns.map(v => (
                <div key={v.id} className={`bg-white border rounded p-4 ${v.status === 'resolved' ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${SEV_COLOR[v.severity]}`}>{v.severity}</span>
                        {v.cve_id && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{v.cve_id}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded ${v.status === 'resolved' ? 'bg-green-100 text-green-700' : v.status === 'in_remediation' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{v.status}</span>
                      </div>
                      <p className="font-medium text-sm">{v.title}</p>
                      <p className="text-xs text-gray-500 mt-1">System: {v.affected_system}</p>
                      {v.remediation && <p className="text-xs text-gray-600 mt-1">Fix: {v.remediation}</p>}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {v.status === 'open' && <button onClick={() => updateVuln(v.id, 'in_remediation')} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Start Fix</button>}
                      {v.status === 'in_remediation' && <button onClick={() => updateVuln(v.id, 'resolved')} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Mark Resolved</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
