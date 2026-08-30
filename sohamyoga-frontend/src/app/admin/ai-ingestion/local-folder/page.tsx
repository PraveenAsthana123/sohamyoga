'use client';
// Phase 4 — File Ingestion, Desktop Folder Monitoring admin page. Same 8-tab
// shell as Phases 1-2 (Operational Portal Page & Tab Standard).

import { useEffect, useState, useCallback } from 'react';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface SourceRow {
  id: string; name: string; externalId: string; sourceType: string; discoveryStatus: string;
  connectorKey: string; createdAt: string; lastDiscoveredAt: string | null; versionCount: number;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', changed: 'bg-amber-100 text-amber-700', unavailable: 'bg-red-100 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>}
      {children}
    </div>
  );
}
function fmt(ts: string | null | undefined): string { return ts ? new Date(ts).toLocaleString() : '—'; }

export default function LocalFolderPage() {
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await fetchJson<{ sources: SourceRow[] }>('/api/admin/ingestion/sources');
    setSources((s?.sources ?? []).filter(x => x.connectorKey === 'local_folder'));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleScan() {
    setBusy(true); setScanMsg(null);
    const res = await fetch('/api/admin/ingestion/local-folder/scan', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setScanMsg(res.ok ? `Scanned: ${body.filesDiscovered} found, ${body.filesNew} new, ${body.filesChanged} changed.` : (body.error ?? 'Scan failed.'));
    setBusy(false);
    if (res.ok) load();
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Phase 4 — File Ingestion &amp; Desktop Folder Monitoring</h1>
        <p className="text-sm text-gray-500">Part of the AI Ingestion pipeline. See src/domain/ingestion/integration-spec.md for scope notes.</p>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {loading ? <Card><p className="text-sm text-gray-400">Loading…</p></Card> : <>

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Files tracked">{sources.length}</Card>
          <Card title="Changed since last scan">{sources.filter(s => s.discoveryStatus === 'changed').length}</Card>
          <Card title="Watched folder">Set via <code className="rounded bg-gray-100 px-1">WATCHED_FOLDER_PATH</code> (server env)</Card>
        </div>
      )}
      {tab === 'report' && <Card title="Report"><p className="text-sm text-gray-800">{sources.length} local file(s) tracked, {sources.reduce((n, s) => n + s.versionCount, 0)} version(s) total.</p></Card>}
      {tab === 'manual' && (
        <div className="space-y-4">
          <Card title="Goal / Objective">
            <p className="text-sm text-gray-800 mb-1"><strong>Goal:</strong> Track plain-text files in one admin-configured local folder as sources, honestly, without fabricating support for formats not yet parsed.</p>
            <p className="text-sm text-gray-800"><strong>Objective:</strong> Discover .txt/.md files, hash content, version on change.</p>
          </Card>
          <Card title="Process — Scan now">
            <button onClick={handleScan} disabled={busy} className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Scan now</button>
            {scanMsg && <p className="mt-2 text-xs text-gray-600">{scanMsg}</p>}
            <p className="mt-2 text-xs text-gray-400">Requires <code className="rounded bg-gray-100 px-1">WATCHED_FOLDER_PATH</code> set server-side to a real local folder.</p>
          </Card>
          <Card title="Transactional history">
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {sources.map(s => (
                <li key={s.id} className="border-b border-gray-50 pb-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs text-gray-400">{fmt(s.lastDiscoveredAt)}</span>{' '}
                  <span className="font-medium text-gray-700">{s.name}</span> <StatusBadge status={s.discoveryStatus} />
                </li>
              ))}
              {!sources.length && <li className="text-sm text-gray-400">No files tracked yet.</li>}
            </ul>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary"><p className="text-sm text-gray-800">.txt and .md files in one configured folder, content hashing, versioning.</p></Card>
            <Card title="Exclusion boundary"><p className="text-sm text-gray-800">DOCX/PDF/HTML/CSV/XLSX parsers, active/archive subfolder lifecycle, quarantine — deferred (see integration-spec.md).</p></Card>
          </div>
        </div>
      )}
      {tab === 'automatic' && (
        <Card title="Job Schedule">
          <p className="text-sm text-gray-800">Real automation: <span className="font-mono">local-folder-scan</span> — every 15 minutes.</p>
          <p className="mt-1 text-sm text-gray-400">Honest no-op until WATCHED_FOLDER_PATH is configured.</p>
        </Card>
      )}
      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['explainability', 'experiment', 'experience'] as const).map(s => (<button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>))}</div>
          {aiExpSub === 'explainability' && <Card title="Explainability"><p className="text-sm text-gray-800">No AI/LLM step — deterministic file read + hash.</p></Card>}
          {aiExpSub === 'experiment' && <Card title="Experiment"><p className="text-sm text-gray-800">N/A.</p></Card>}
          {aiExpSub === 'experience' && <Card title="Experience"><p className="text-sm text-gray-800">Drop a .txt/.md file in the watched folder — it's tracked and versioned automatically within 15 minutes, or immediately via Scan now.</p></Card>}
        </div>
      )}
      {tab === 'ai-governance' && <Card title="AI Governance"><p className="text-sm text-gray-800">No model in the loop. Files are read from a single admin-configured local path only — no arbitrary filesystem access.</p></Card>}
      {tab === 'ai-risk' && <Card title="AI Risk"><p className="text-sm text-gray-800">Known risk: files over 10MB are flagged (LARGE_SOURCE) and skipped rather than blindly read, per Phase 1's own large-file rule. A single unreadable file logs a warning and does not abort the scan.</p></Card>}
      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['research-ai', 'responsible-ai'] as const).map(s => (<button key={s} onClick={() => setResAiSub(s)} className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s === 'research-ai' ? 'Research AI' : 'Responsible AI'}</button>))}</div>
          {resAiSub === 'research-ai' && <Card title="Research AI"><p className="text-sm text-gray-800">Not yet automated.</p></Card>}
          {resAiSub === 'responsible-ai' && <Card title="Responsible AI"><p className="text-sm text-gray-800">Only reads files inside the admin-configured folder path — no broader filesystem traversal.</p></Card>}
        </div>
      )}
      </>}
    </div>
  );
}
