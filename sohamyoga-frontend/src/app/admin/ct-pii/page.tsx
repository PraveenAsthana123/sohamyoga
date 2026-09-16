'use client';
import { useEffect, useState, useCallback } from 'react';

interface CtPiiData {
  health_score: number;
  traffic_light: 'red' | 'yellow' | 'green';
  scans_run: number;
  pii_found: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  last_scan: string | null;
  alerts: string[];
  updated_at: string;
}

interface ScanHistoryRow { id: number; scanned_at: string; source: string; pii_found: number; risk_level: string; status: string; }
interface ScanResult { scan_id: number; pii_found: number; risk_level: string; findings: string[]; duration_ms: number; }

const TABS = ['Overview', 'Scan History', 'Run Scan', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const RISK_COLOR: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
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

export default function CtPiiPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtPiiData | null>(null);
  const [history, setHistory] = useState<ScanHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scanTarget, setScanTarget] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/admin/ct-pii').then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'Scan History' && history.length === 0) {
      setHistoryLoading(true);
      fetch('/api/admin/ct-pii/history').then(r => r.json()).then(d => setHistory(d.history ?? d ?? [])).finally(() => setHistoryLoading(false));
    }
  }, [tab, history.length]);

  const runScan = async () => {
    setScanning(true); setScanResult(null);
    try {
      const res = await fetch('/api/admin/ct-pii/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: scanTarget || 'all' }),
      });
      setScanResult(await res.json());
      load();
    } finally { setScanning(false); }
  };

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-pii/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, scans_run: data.scans_run, pii_found: data.pii_found, risk_level: data.risk_level }),
      });
      const j = await res.json();
      setBrief(j.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header + Traffic Light */}
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PII Detection Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Personal Data Scanning · Risk Assessment · Compliance Monitoring</p>
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
              <KpiCard label="Scans Run" value={data?.scans_run ?? 0} />
              <KpiCard label="PII Detected" value={data?.pii_found ?? 0} color={Number(data?.pii_found) > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <KpiCard label="Risk Level" value={data?.risk_level ?? '--'} color={RISK_COLOR[data?.risk_level ?? 'low']?.includes('red') ? 'text-red-600' : 'text-gray-800'} />
              <KpiCard label="Last Scan" value={data?.last_scan ? new Date(data.last_scan).toLocaleDateString() : 'Never'} />
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Risk Status</h2>
              <div className="flex items-center gap-4">
                <span className={`rounded-xl px-4 py-2 text-sm font-bold uppercase ${RISK_COLOR[data?.risk_level ?? 'low']}`}>
                  {data?.risk_level ?? 'Unknown'}
                </span>
                <div>
                  <p className="text-sm text-gray-700">{data?.pii_found ?? 0} PII records detected across {data?.scans_run ?? 0} scans</p>
                  {data?.last_scan && <p className="text-xs text-gray-400 mt-1">Last scan: {new Date(data.last_scan).toLocaleString()}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan History */}
        {tab === 'Scan History' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">PII Scan History</h2>
            {historyLoading
              ? <p className="text-sm text-gray-400">Loading history…</p>
              : history.length === 0
                ? <p className="text-sm text-gray-400">No scan history available.</p>
                : <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Date</th><th className="pb-2">Source</th><th className="pb-2">PII Found</th><th className="pb-2">Risk Level</th><th className="pb-2">Status</th>
                    </tr></thead>
                    <tbody>
                      {history.map(r => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 text-gray-500 text-xs">{new Date(r.scanned_at).toLocaleString()}</td>
                          <td className="py-2 font-medium text-gray-800">{r.source}</td>
                          <td className="py-2 text-gray-700">{r.pii_found}</td>
                          <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_COLOR[r.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>{r.risk_level}</span></td>
                          <td className="py-2 text-gray-500 text-xs">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            }
          </div>
        )}

        {/* Run Scan */}
        {tab === 'Run Scan' && (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Run PII Scan</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scan Target (optional — leave blank for full scan)</label>
              <input
                value={scanTarget}
                onChange={e => setScanTarget(e.target.value)}
                placeholder="e.g. users, orders, contacts, or leave blank for all"
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button onClick={runScan} disabled={scanning}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
              {scanning ? 'Scanning…' : 'Run PII Scan'}
            </button>
            {scanResult && (
              <div className={`rounded-xl border p-5 ${scanResult.pii_found > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{scanResult.pii_found > 0 ? '⚠️' : '✅'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">Scan #{scanResult.scan_id} Complete</p>
                    <p className="text-xs text-gray-500">Risk: {scanResult.risk_level} · Duration: {scanResult.duration_ms}ms</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-2">{scanResult.pii_found} PII items found</p>
                {scanResult.findings.length > 0 && (
                  <ul className="space-y-1">
                    {scanResult.findings.map((f, i) => <li key={i} className="text-sm text-gray-600">• {f}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Advisor */}
        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI PII Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Privacy risk analysis · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Generate Report'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Report" to get AI-powered PII risk analysis.</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
