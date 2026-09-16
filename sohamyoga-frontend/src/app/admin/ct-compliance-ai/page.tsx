'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtComplianceData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  total_rules: number;
  passing: number;
  violations: number;
  open_incidents: number;
  alerts: string[];
  updated_at: string;
}

interface RegulationRow { regulation: string; total_rules: number; passing: number; violations: number; compliance_pct: number; }
interface IncidentRow { id: number; title: string; severity: string; status: string; regulation: string; created_at: string; }

const TABS = ['Overview', 'By Regulation', 'Incidents', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-700',
};

function KpiCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-gray-800'}`}>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function CtComplianceAiPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtComplianceData | null>(null);
  const [regulations, setRegulations] = useState<RegulationRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [incLoading, setIncLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-compliance-ai').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'By Regulation' && regulations.length === 0) {
      setRegsLoading(true);
      fetch('/api/admin/ct-compliance-ai/by-regulation').then(r => r.json()).then(d => setRegulations(d.regulations ?? d ?? [])).finally(() => setRegsLoading(false));
    }
    if (tab === 'Incidents' && incidents.length === 0) {
      setIncLoading(true);
      fetch('/api/admin/ct-compliance-ai/incidents').then(r => r.json()).then(d => setIncidents(d.incidents ?? d ?? [])).finally(() => setIncLoading(false));
    }
  }, [tab, regulations.length, incidents.length]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-compliance-ai/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, total_rules: data.total_rules, passing: data.passing, violations: data.violations, open_incidents: data.open_incidents }),
      });
      const j = await res.json();
      setBrief(j.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';
  const compliancePct = data && data.total_rules > 0 ? ((data.passing / data.total_rules) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header + Traffic Light */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Compliance Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Regulatory Rules · Violations · Incident Management · GDPR · CCPA</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{TL_EMOJI[tl]}</span>
              <div className="text-right">
                <p className="text-3xl font-bold">{data?.health_score ?? 0}<span className="text-base font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-400">Health Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(data?.alerts ?? []).length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Active Alerts</h3>
            <ul className="space-y-1">
              {data!.alerts.map((a, i) => <li key={i} className="text-yellow-700 text-sm">⚠️ {a}</li>)}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'Overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Rules" value={data?.total_rules ?? 0} />
              <KpiCard label="Passing" value={data?.passing ?? 0} color="text-emerald-600" />
              <KpiCard label="Violations" value={data?.violations ?? 0} color={Number(data?.violations) > 0 ? 'text-red-600' : 'text-gray-800'} />
              <KpiCard label="Compliance %" value={`${compliancePct}%`} color={Number(compliancePct) >= 95 ? 'text-emerald-600' : Number(compliancePct) >= 80 ? 'text-amber-600' : 'text-red-600'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Rule Compliance Breakdown</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Passing</span>
                    <span className="font-semibold text-emerald-600">{data?.passing ?? 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${compliancePct}%` }} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Violations</span>
                    <span className="font-semibold text-red-600">{data?.violations ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Incident Summary</h2>
                <div className="text-center">
                  <p className="text-4xl font-bold text-red-600">{data?.open_incidents ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Open Incidents</p>
                  <p className="text-xs text-gray-400 mt-2">Requiring immediate attention</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* By Regulation */}
        {tab === 'By Regulation' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Compliance by Regulation</h2>
            {regsLoading
              ? <p className="text-sm text-gray-400">Loading regulations…</p>
              : regulations.length === 0
                ? <p className="text-sm text-gray-400">No regulation data available.</p>
                : <div className="space-y-4">
                    {regulations.map((r, i) => (
                      <div key={i} className="border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-800">{r.regulation}</span>
                          <span className={`text-sm font-bold ${r.compliance_pct >= 95 ? 'text-emerald-600' : r.compliance_pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                            {Number(r.compliance_pct).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                          <div className={`h-2 rounded-full ${r.compliance_pct >= 95 ? 'bg-emerald-500' : r.compliance_pct >= 80 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${r.compliance_pct}%` }} />
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>{r.total_rules} rules</span>
                          <span className="text-emerald-600">{r.passing} passing</span>
                          <span className="text-red-600">{r.violations} violations</span>
                        </div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        )}

        {/* Incidents */}
        {tab === 'Incidents' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Compliance Incidents</h2>
            {incLoading
              ? <p className="text-sm text-gray-400">Loading incidents…</p>
              : incidents.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No open incidents. Compliance is clean.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Title</th><th className="pb-2">Regulation</th><th className="pb-2">Severity</th><th className="pb-2">Status</th><th className="pb-2">Created</th>
                    </tr></thead>
                    <tbody>
                      {incidents.map(inc => (
                        <tr key={inc.id} className="border-b last:border-0">
                          <td className="py-2 font-medium text-gray-800">{inc.title}</td>
                          <td className="py-2 text-gray-500 text-xs">{inc.regulation}</td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEV_COLOR[inc.severity] ?? 'bg-gray-100 text-gray-700'}`}>{inc.severity}</span></td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[inc.status] ?? 'bg-gray-100 text-gray-700'}`}>{inc.status}</span></td>
                          <td className="py-2 text-gray-400 text-xs">{new Date(inc.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Compliance Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Regulatory risk analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered compliance health analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
