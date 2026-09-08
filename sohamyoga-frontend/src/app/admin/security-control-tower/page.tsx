'use client';
import { useEffect, useState, useCallback } from 'react';

// AI Control Tower — real SAST/SCA/IaC/DAST scanning dashboard. Every number
// on this page comes from an actual tool run (semgrep, npm audit, trivy,
// checkov, OWASP ZAP) via /api/admin/security/*, never a fabricated score.

type Category = 'sast' | 'sca' | 'iac' | 'dast';
interface ScannerDef { category: Category; tool: string; target: string }
interface ScanRun {
  id: string; category: Category; tool: string; target: string; status: string;
  triggered_by: string; started_at: string; completed_at: string | null; duration_ms: number | null;
  summary: Record<string, number>; error_message: string | null;
}
interface Finding {
  id: string; severity: string; title: string; description: string | null; file_path: string | null;
  line_number: number | null; package_name: string | null; installed_version: string | null;
  fixed_version: string | null; cve_id: string | null; rule_id: string | null; status: string;
  category: Category; tool: string; target: string; last_seen_at: string;
}

const CATEGORY_LABEL: Record<Category, string> = { sast: 'SAST', sca: 'SCA', iac: 'IaC', dast: 'DAST' };
const CATEGORY_DESC: Record<Category, string> = {
  sast: 'Static Application Security Testing — semgrep against app source (p/security-audit, p/owasp-top-ten rulesets)',
  sca: 'Software Composition Analysis — npm audit + trivy fs against dependency lockfiles',
  iac: 'Infrastructure as Code — trivy config + checkov against real Dockerfiles (docker-compose.yml is not supported by either tool in the installed versions)',
  dast: 'Dynamic Application Security Testing — OWASP ZAP baseline scan against the running app',
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300', high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300', low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-600 border-gray-300',
};
const TABS: Array<Category | 'dashboard' | 'history'> = ['dashboard', 'sast', 'sca', 'iac', 'dast', 'history'];

export default function SecurityControlTowerPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('dashboard');
  const [scanners, setScanners] = useState<ScannerDef[]>([]);
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [openSummary, setOpenSummary] = useState<{ severity: string; count: string }[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, f] = await Promise.all([
        fetch('/api/admin/security/scanners').then(x => x.json()),
        fetch('/api/admin/security/scans').then(x => x.json()),
        fetch('/api/admin/security/findings').then(x => x.json()),
      ]);
      setScanners(s.scanners ?? []);
      setScans(r.scans ?? []);
      setFindings(f.findings ?? []);
      setOpenSummary(f.openSummary ?? []);
    } catch {
      setError('Failed to load security data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runScan = async (s: ScannerDef) => {
    const key = `${s.category}/${s.tool}/${s.target}`;
    setRunning(key);
    try {
      const res = await fetch('/api/admin/security/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error ?? 'Scan failed.');
      await load();
    } finally {
      setRunning(null);
    }
  };

  const updateFinding = async (id: string, status: string) => {
    await fetch(`/api/admin/security/findings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const sevCount = (sev: string) => Number(openSummary.find(o => o.severity === sev)?.count ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI Control Tower — Security</h1>
          <p className="text-sm text-gray-500 mt-1">Real SAST · SCA · IaC · DAST scanning, no fabricated results</p>
        </div>

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap capitalize transition-colors ${tab === t ? 'bg-slate-800 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t === 'dashboard' ? 'Dashboard' : t === 'history' ? 'Scan History' : CATEGORY_LABEL[t]}
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <>
            {tab === 'dashboard' && (
              <DashboardTab sevCount={sevCount} scans={scans} findings={findings} />
            )}
            {(tab === 'sast' || tab === 'sca' || tab === 'iac' || tab === 'dast') && (
              <CategoryTab
                category={tab}
                scanners={scanners.filter(s => s.category === tab)}
                scans={scans.filter(s => s.category === tab)}
                findings={findings.filter(f => f.category === tab)}
                running={running}
                onRun={runScan}
                onUpdateFinding={updateFinding}
              />
            )}
            {tab === 'history' && <HistoryTab scans={scans} />}
          </>
        )}
      </div>
    </div>
  );
}

function DashboardTab({ sevCount, scans, findings }: { sevCount: (s: string) => number; scans: ScanRun[]; findings: Finding[] }) {
  const totalScans = scans.length;
  const lastRunByCategory = (['sast', 'sca', 'iac', 'dast'] as Category[]).map(cat => ({
    category: cat, run: scans.find(s => s.category === cat),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
          <div key={sev} className={`rounded-xl border p-4 ${SEVERITY_COLOR[sev]}`}>
            <p className="text-xs font-medium uppercase">{sev}</p>
            <p className="text-2xl font-bold mt-1">{sevCount(sev)}</p>
            <p className="text-xs opacity-70">open findings</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Last Run per Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {lastRunByCategory.map(({ category, run }) => (
            <div key={category} className="border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">{CATEGORY_LABEL[category]}</p>
              {run ? (
                <>
                  <p className="text-sm text-gray-700 mt-1">{new Date(run.started_at).toLocaleString()}</p>
                  <p className={`text-xs mt-1 ${run.status === 'completed' ? 'text-emerald-600' : run.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{run.status}</p>
                </>
              ) : <p className="text-xs text-gray-400 mt-1">Never run yet</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Open Findings (top 10)</h3>
        {findings.length === 0 ? <p className="text-sm text-gray-400">No open findings — run a scan from a category tab.</p> : (
          <div className="space-y-2">
            {findings.slice(0, 10).map(f => (
              <div key={f.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLOR[f.severity]}`}>{f.severity}</span>
                <span className="text-xs text-gray-400 uppercase w-12">{f.category}</span>
                <span className="text-sm text-gray-700 flex-1 truncate">{f.title}</span>
                <span className="text-xs text-gray-400">{f.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Total scan runs recorded: {totalScans}. Nightly job: <code>security-scan</code> at 01:30 UTC runs every scanner below automatically.</p>
    </div>
  );
}

function CategoryTab({ category, scanners, scans, findings, running, onRun, onUpdateFinding }: {
  category: Category; scanners: ScannerDef[]; scans: ScanRun[]; findings: Finding[]; running: string | null;
  onRun: (s: ScannerDef) => void; onUpdateFinding: (id: string, status: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-1">{CATEGORY_LABEL[category]}</h3>
        <p className="text-xs text-gray-500 mb-4">{CATEGORY_DESC[category]}</p>
        <div className="flex flex-wrap gap-3">
          {scanners.map(s => {
            const key = `${s.category}/${s.tool}/${s.target}`;
            const lastRun = scans.find(r => r.tool === s.tool && r.target === s.target);
            return (
              <div key={key} className="border rounded-lg p-3 min-w-[220px]">
                <p className="text-sm font-medium text-gray-800">{s.tool}</p>
                <p className="text-xs text-gray-500">{s.target}</p>
                {lastRun && (
                  <p className="text-xs text-gray-400 mt-1">Last: {new Date(lastRun.started_at).toLocaleString()} · {lastRun.status}</p>
                )}
                <button onClick={() => onRun(s)} disabled={running === key}
                  className="mt-2 w-full bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {running === key ? 'Running…' : 'Run Scan'}
                </button>
              </div>
            );
          })}
        </div>
        {scanners.some(s => scans.find(r => r.tool === s.tool && r.target === s.target)?.error_message) && (
          <div className="mt-4 space-y-1">
            {scans.filter(r => r.error_message).map(r => (
              <p key={r.id} className="text-xs text-red-600">Error ({r.tool}/{r.target}): {r.error_message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left px-4 py-2">Severity</th><th className="text-left px-4 py-2">Title</th><th className="text-left px-4 py-2">Location</th><th className="text-left px-4 py-2">Tool</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {findings.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No open findings for {CATEGORY_LABEL[category]} yet.</td></tr>}
            {findings.map(f => (
              <tr key={f.id} className="border-t align-top">
                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLOR[f.severity]}`}>{f.severity}</span></td>
                <td className="px-4 py-2">
                  <p className="font-medium text-gray-800">{f.title}</p>
                  {f.description && <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{f.description.slice(0, 220)}</p>}
                  {f.package_name && <p className="text-xs text-gray-400 mt-0.5">{f.package_name}{f.installed_version ? ` @ ${f.installed_version}` : ''}{f.fixed_version ? ` → fix: ${f.fixed_version}` : ''}</p>}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{f.file_path ?? '—'}{f.line_number ? `:${f.line_number}` : ''}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{f.tool}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => onUpdateFinding(f.id, 'acknowledged')} className="text-amber-600 hover:underline text-xs mr-2">Ack</button>
                  <button onClick={() => onUpdateFinding(f.id, 'fixed')} className="text-emerald-600 hover:underline text-xs mr-2">Fixed</button>
                  <button onClick={() => onUpdateFinding(f.id, 'false_positive')} className="text-gray-500 hover:underline text-xs">Not real</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTab({ scans }: { scans: ScanRun[] }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr><th className="text-left px-4 py-2">Started</th><th className="text-left px-4 py-2">Category</th><th className="text-left px-4 py-2">Tool</th><th className="text-left px-4 py-2">Target</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Duration</th><th className="text-left px-4 py-2">Summary</th><th className="text-left px-4 py-2">By</th></tr>
        </thead>
        <tbody>
          {scans.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No scans run yet.</td></tr>}
          {scans.map(s => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-2 text-xs text-gray-500">{new Date(s.started_at).toLocaleString()}</td>
              <td className="px-4 py-2 uppercase text-xs">{s.category}</td>
              <td className="px-4 py-2">{s.tool}</td>
              <td className="px-4 py-2">{s.target}</td>
              <td className="px-4 py-2">
                <span className={`text-xs font-medium ${s.status === 'completed' ? 'text-emerald-600' : s.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{s.status}</span>
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {Object.entries(s.summary ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}
              </td>
              <td className="px-4 py-2 text-xs text-gray-400">{s.triggered_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
