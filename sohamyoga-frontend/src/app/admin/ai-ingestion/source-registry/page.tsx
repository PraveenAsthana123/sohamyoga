'use client';
// Phase 1 — Source Registry & Discovery admin page. Implements the mandatory
// Operational Portal Page & Tab Standard's 8-tab shell (see
// market-research-portal/src/components/PhaseTabs.tsx for the reference
// implementation this was adapted from) for the one real ingestion phase
// built so far. See src/domain/ingestion/integration-spec.md for scope notes.

import { useEffect, useState, useCallback } from 'react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface Connector {
  id: string; connectorKey: string; sourceFamily: string; authType: string; status: string;
  capabilities: { discover: boolean; read: boolean; write: boolean; webhook: boolean; incrementalSync: boolean };
  lastSuccessfulDiscoveryAt: string | null; sourceCount: number;
}

interface SourceRow {
  id: string; name: string; externalId: string; sourceType: string; discoveryStatus: string;
  connectorKey: string; createdAt: string; lastDiscoveredAt: string | null; lastVerifiedAt: string | null;
  versionCount: number; latestVersionLabel: string | null;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', changed: 'bg-amber-100 text-amber-700',
    unavailable: 'bg-red-100 text-red-700', registered: 'bg-gray-100 text-gray-600',
    discovered: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-400',
    healthy: 'bg-emerald-100 text-emerald-700', not_configured: 'bg-gray-100 text-gray-500',
    succeeded: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700',
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

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function SourceRegistryPage() {
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchJson<{ connectors: Connector[] }>('/api/admin/ingestion/connectors'),
      fetchJson<{ sources: SourceRow[] }>('/api/admin/ingestion/sources'),
    ]).then(([c, s]) => {
      setConnectors(c?.connectors ?? []);
      setSources(s?.sources ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRegister() {
    setBusy(true);
    setRegisterMsg(null);
    const res = await fetch('/api/admin/ingestion/sources/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareUrl }),
    });
    const body = await res.json().catch(() => ({}));
    setRegisterMsg(res.ok ? `Registered — ${body.messageCount} messages discovered.` : (body.error ?? 'Registration failed.'));
    setBusy(false);
    if (res.ok) { setShareUrl(''); load(); }
  }

  async function handleRefresh(sourceId: string) {
    setBusy(true);
    await fetch(`/api/admin/ingestion/sources/${sourceId}/refresh`, { method: 'POST' });
    setBusy(false);
    load();
  }

  const realConnector = connectors.find(c => c.connectorKey === 'chatgpt_shared_snapshot');
  const stubConnectors = connectors.filter(c => c.connectorKey !== 'chatgpt_shared_snapshot');
  const statusCounts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.discoveryStatus] = (acc[s.discoveryStatus] ?? 0) + 1;
    return acc;
  }, {});

  const goal = 'Know what sources exist, where they live, and whether anything discoverable has silently changed — without deep AI content analysis (that is a later phase).';
  const objective = 'Register real sources, run discovery, and detect content changes over time, without fabricating activity for source families that have no working connector yet.';
  const todoList = [
    { text: 'Registry schema (connector, source, source_version, discovery_run) live', done: true },
    { text: 'One real connector wired (chatgpt_shared_snapshot)', done: true },
    { text: 'Manual registration flow', done: true },
    { text: 'Scheduled re-check job', done: true },
    { text: 'Second real connector (Google Drive/Docs/Sheets, needs Phase 2 OAuth)', done: false },
    { text: 'Reconciliation / quarantine / expected-source inventory (needs real multi-connector volume)', done: false },
  ];
  const inclusion = 'Registering and re-checking ChatGPT shared-conversation links: fetch, decode, detect content changes, version history.';
  const exclusion = 'Deep content parsing/summarization (later phase), any source family without a working connector (shown as not_configured, not simulated), reconciliation/quarantine/alerting (deferred — see integration-spec.md).';

  function ProcessSubStructure({ editable }: { editable: boolean }) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Goal"><p className="text-sm text-gray-800">{goal}</p></Card>
          <Card title="Objective"><p className="text-sm text-gray-800">{objective}</p></Card>
        </div>
        <Card title="To-do list">
          <ul className="space-y-1.5">
            {todoList.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.done} disabled readOnly />
                <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.text}</span>
              </li>
            ))}
          </ul>
        </Card>
        {editable && (
          <Card title="Input — register a ChatGPT share link">
            <div className="flex gap-2">
              <input
                type="text" value={shareUrl} onChange={e => setShareUrl(e.target.value)}
                placeholder="https://chatgpt.com/share/..."
                className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleRegister} disabled={busy || !shareUrl}
                className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Register
              </button>
            </div>
            {registerMsg && <p className="mt-2 text-xs text-gray-600">{registerMsg}</p>}
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Process">
            <p className="text-sm text-gray-800">{editable ? 'Fetch share page → decode turbo-stream → extract messages → hash → insert source + version.' : 'Every 6h: re-fetch each registered source, compare content hash, append a new version on change.'}</p>
          </Card>
          <Card title="Output">
            <p className="text-sm text-gray-800">{sources.length} source(s) registered, {sources.reduce((n, s) => n + s.versionCount, 0)} version(s) recorded.</p>
          </Card>
          <Card title="Visualization">
            <pre className="overflow-x-auto text-xs text-gray-700">{JSON.stringify(realConnector?.capabilities ?? {}, null, 2)}</pre>
          </Card>
        </div>
        <Card title="Transactional history (timestamped)">
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {sources.map(s => (
              <li key={s.id} className="flex items-center justify-between border-b border-gray-50 pb-1.5 text-sm last:border-0">
                <span>
                  <span className="font-mono text-xs text-gray-400">{fmt(s.lastDiscoveredAt)}</span>{' '}
                  <span className="font-medium text-gray-700">{s.name}</span>{' '}
                  <StatusBadge status={s.discoveryStatus} /> <span className="text-xs text-gray-400">{s.latestVersionLabel}</span>
                </span>
                {!editable && (
                  <button onClick={() => handleRefresh(s.id)} disabled={busy} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
                    Re-check now
                  </button>
                )}
              </li>
            ))}
            {!sources.length && <li className="text-sm text-gray-400">No sources registered yet.</li>}
          </ul>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Inclusion boundary"><p className="text-sm text-gray-800">{inclusion}</p></Card>
          <Card title="Exclusion boundary"><p className="text-sm text-gray-800">{exclusion}</p></Card>
        </div>
        <Card title="Task list">
          <ul className="space-y-1.5">
            {todoList.filter(t => !t.done).map((t, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{t.text}</span>
                <span className="text-xs text-gray-400">unassigned · pending</span>
              </li>
            ))}
            {todoList.every(t => t.done) && <li className="text-sm text-gray-400">No open tasks.</li>}
          </ul>
        </Card>
        <Card title="Final outcome report">
          <p className="text-sm text-gray-800">
            {sources.length
              ? `Registry holds ${sources.length} real source(s) across ${connectors.filter(c => c.capabilities.discover).length} configured connector(s) and ${stubConnectors.length} not-yet-configured connector(s).`
              : 'No sources registered yet — use the Manual Process tab to register a ChatGPT share link.'}
          </p>
        </Card>
        <Card title="Status (Completed / Pending / Running) — timestamped history">
          <div className="mb-2"><StatusBadge status={sources.length ? 'active' : 'registered'} /></div>
          <ul className="space-y-1">
            {sources.slice(0, 5).map(s => (
              <li key={s.id} className="text-xs text-gray-500">
                <span className="font-mono">{fmt(s.lastVerifiedAt)}</span> — {s.name}: {s.discoveryStatus}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Phase 1 — Source Registry &amp; Discovery</h1>
        <p className="text-sm text-gray-500">Part of the AI Ingestion pipeline. See integration-spec.md for scope notes.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? <Card><p className="text-sm text-gray-400">Loading…</p></Card> : <>

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="Connectors configured">{connectors.filter(c => c.capabilities.discover).length} / {connectors.length}</Card>
          <Card title="Sources registered">{sources.length}</Card>
          <Card title="Changed since last check">{statusCounts.changed ?? 0}</Card>
          <Card title="Unavailable">{statusCounts.unavailable ?? 0}</Card>
          <div className="sm:col-span-4">
            <Card title="Connector catalog">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400"><th className="pb-2">Source family</th><th>Status</th><th>Capabilities</th><th>Sources</th></tr></thead>
                <tbody>
                  {connectors.map(c => (
                    <tr key={c.id} className="border-t border-gray-50">
                      <td className="py-1.5 font-mono text-xs">{c.sourceFamily}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="text-xs text-gray-500">{Object.entries(c.capabilities).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}</td>
                      <td>{c.sourceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <Card title="Report — Source Registry">
          <p className="text-sm text-gray-800">
            {connectors.filter(c => c.capabilities.discover).length} of {connectors.length} known source families have a working connector.
            {' '}{sources.length} source(s) tracked, {sources.reduce((n, s) => n + s.versionCount, 0)} version(s) recorded across all sources.
          </p>
        </Card>
      )}

      {tab === 'manual' && <ProcessSubStructure editable />}
      {tab === 'automatic' && (
        <div className="space-y-4">
          <Card title="Job Schedule">
            <p className="text-sm text-gray-800">Real automation: <span className="font-mono">ingestion-source-refresh</span> — every 6 hours, re-checks every registered chatgpt_shared_snapshot source for content changes.</p>
            <p className="mt-1 text-sm text-gray-400">Every other source family: not yet automated — no working connector (needs Phase 2 auth or a file-watcher, neither built yet).</p>
          </Card>
          <ProcessSubStructure editable={false} />
        </div>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['explainability', 'experiment', 'experience'] as const).map(s => (
              <button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
            ))}
          </div>
          {aiExpSub === 'explainability' && <Card title="Explainability"><p className="text-sm text-gray-800">No AI/LLM step exists in Phase 1 by design — the spec explicitly excludes deep AI content analysis here. Discovery is deterministic: fetch, decode, hash, compare.</p></Card>}
          {aiExpSub === 'experiment' && <Card title="Experiment"><p className="text-sm text-gray-800">No models/prompts tried — nothing to experiment with in a deterministic discovery pipeline.</p></Card>}
          {aiExpSub === 'experience' && <Card title="Experience"><p className="text-sm text-gray-800">The registry fetched your pasted link, decoded it, and now watches it every 6 hours for changes — no AI involved.</p></Card>}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> none — deterministic discovery only, no model in the loop this phase.</p>
            <p><strong>Approval status:</strong> N/A.</p>
            <p><strong>Policy compliance:</strong> Follows this workspace's Operational Portal Page &amp; Tab Standard and the Global ChatGPT Shared-Link Extraction Policy.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes:</strong> ChatGPT could change their share-page serialization format and break the decoder (see the global extraction policy for the exact failure signature to watch for).</p>
            <p><strong>Other risks:</strong> a share link can go unavailable or be revoked; no cross-source deduplication exists yet if the same conversation is registered twice under different URLs.</p>
            <p><strong>Mitigations:</strong> failed refreshes mark the source `unavailable` and record the error rather than silently dropping it; registration rejects a URL already registered as a source.</p>
            <p><strong>Current risk level:</strong> {statusCounts.unavailable ? `Elevated (${statusCounts.unavailable} source(s) unavailable)` : 'Low'}</p>
          </div>
        </Card>
      )}

      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['research-ai', 'responsible-ai'] as const).map(s => (
              <button key={s} onClick={() => setResAiSub(s)} className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s === 'research-ai' ? 'Research AI' : 'Responsible AI'}</button>
            ))}
          </div>
          {resAiSub === 'research-ai' && <Card title="Research AI"><p className="text-sm text-gray-800">Not yet automated — no AI agent actively researches sources in Phase 1; this is deterministic discovery only.</p></Card>}
          {resAiSub === 'responsible-ai' && (
            <Card title="Responsible AI">
              <div className="space-y-2 text-sm text-gray-800">
                <p><strong>Data provenance:</strong> every source traces to a specific chatgpt.com/share/ URL the admin pasted; nothing is scraped automatically.</p>
                <p><strong>Consent/privacy:</strong> share links are public-by-definition (the publisher explicitly made them shareable) — no additional consent step needed.</p>
                <p><strong>Bias checks:</strong> N/A — no model output produced by this phase.</p>
              </div>
            </Card>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
