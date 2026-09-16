'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Control = {
  id: string;
  name: string;
  category: string;
  status: string;
  risk_level: string;
  last_checked: string;
};

type ScanRecord = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  controls_checked: number;
  issues_found: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTROL_CATEGORIES = ['All', 'Identity', 'Access', 'Encryption', 'Audit', 'Network', 'Compliance'];

const STATUS_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  warn: 'bg-yellow-100 text-yellow-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

const CAT_ICONS: Record<string, string> = {
  Identity: '👤',
  Access: '🔑',
  Encryption: '🔒',
  Audit: '📋',
  Network: '🌐',
  Compliance: '✅',
};

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="64" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <div className="text-sm font-medium text-gray-600 -mt-1">Security Score</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityIdentityPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAdvice, setAiAdvice] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'scans'>('controls');
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/security-identity').then(r => r.json()),
      fetch('/api/admin/security-identity/scans').then(r => r.json()).catch(() => ({ scans: [] })),
    ]).then(([main, scanData]) => {
      setControls(main.controls ?? []);
      setOverallScore(main.overall_score ?? 0);
      setAlerts(main.alerts ?? []);
      setScans(scanData.scans ?? []);
      setLoading(false);
    }).catch(() => { setError('Failed to load security data'); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function runScan() {
    setScanning(true);
    try {
      await fetch('/api/admin/security-identity/scan', { method: 'POST' });
      setTimeout(load, 2000);
    } catch { /* ignore */ } finally { setScanning(false); }
  }

  async function getAiAdvice() {
    setAiLoading(true);
    setAiAdvice('');
    const failedControls = controls.filter(c => c.status === 'fail' || c.status === 'warn').map(c => c.name).join(', ');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `As a security advisor, analyze these security issues and provide prioritized remediation steps: ${failedControls || 'No specific issues — general hardening advice needed'}. ${aiPrompt ? `Additional context: ${aiPrompt}` : ''} Format as: 1) Critical actions (immediate), 2) High priority (this week), 3) Medium priority (this month).`,
        }),
      });
      const d = await r.json();
      setAiAdvice(d.result ?? d.text ?? JSON.stringify(d));
    } catch { setAiAdvice('Error connecting to AI.'); } finally { setAiLoading(false); }
  }

  const filtered = controls.filter(c => filterCat === 'All' || c.category === filterCat);

  const catStats = CONTROL_CATEGORIES.slice(1).map(cat => {
    const catControls = controls.filter(c => c.category === cat);
    const passing = catControls.filter(c => c.status === 'pass').length;
    return { cat, total: catControls.length, passing };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security & Identity</h1>
            <p className="text-gray-500 mt-1">Monitor controls, run scans, and review posture.</p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-5 py-2.5 bg-slate-800 text-white rounded font-medium text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {scanning ? 'Running Scan…' : 'Run Scan'}
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-5 space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <span>⚠️</span> {a}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">

          {/* Score */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
            {loading ? <div className="text-gray-400">Loading…</div> : <ScoreRing score={overallScore} />}
          </div>

          {/* Category stats */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {catStats.map(({ cat, total, passing }) => (
              <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{CAT_ICONS[cat]}</span>
                  <span className="text-sm font-medium text-gray-700">{cat}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">{total > 0 ? `${passing}/${total}` : '—'}</div>
                <div className="text-xs text-gray-400 mt-0.5">controls passing</div>
                {total > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-100 rounded">
                    <div
                      className="h-1.5 rounded bg-green-500"
                      style={{ width: `${(passing / total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
          {(['controls', 'scans'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'controls' ? 'Controls' : 'Scan History'}
            </button>
          ))}
        </div>

        {activeTab === 'controls' && (
          <>
            {/* Category filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CONTROL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterCat === cat ? 'bg-slate-800 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat !== 'All' && CAT_ICONS[cat] ? `${CAT_ICONS[cat]} ` : ''}{cat}
                </button>
              ))}
            </div>

            {/* Controls table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              {loading ? (
                <div className="text-center py-16 text-gray-400">Loading controls…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No controls found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Control', 'Category', 'Status', 'Risk', 'Last Checked'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600">{CAT_ICONS[c.category]} {c.category}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold capitalize ${RISK_COLORS[c.risk_level] ?? 'text-gray-500'}`}>{c.risk_level}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{c.last_checked ? new Date(c.last_checked).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'scans' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            {scans.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No scans yet. Run a scan to see history.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Started', 'Completed', 'Status', 'Controls Checked', 'Issues Found'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scans.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{s.controls_checked}</td>
                      <td className="px-4 py-3">
                        <span className={s.issues_found > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>{s.issues_found}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* AI Security Advisor */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Security Advisor</h2>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Optional: describe your environment or specific concern…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={getAiAdvice}
              disabled={aiLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiLoading ? 'Analyzing…' : 'Get Advice'}
            </button>
          </div>
          {aiAdvice && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto">{aiAdvice}</div>
          )}
        </div>
      </div>
    </div>
  );
}
