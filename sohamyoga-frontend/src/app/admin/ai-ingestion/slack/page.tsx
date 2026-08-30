'use client';
// Phase 6 — Slack, Google Chat, WhatsApp, Messenger, LinkedIn admin page.
// Only Slack has a real inbound-read connector built this pass — see
// integration-spec.md for why the other four are deferred.

import { useEffect, useState, useCallback } from 'react';

async function fetchJson<T>(url: string): Promise<T | null> {
  try { const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) return null; return res.json(); } catch { return null; }
}

interface SourceRow {
  id: string; name: string; externalId: string; sourceType: string; discoveryStatus: string;
  connectorKey: string; lastDiscoveredAt: string | null; versionCount: number;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', changed: 'bg-amber-100 text-amber-700' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">{title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>}{children}</div>;
}
function fmt(ts: string | null | undefined): string { return ts ? new Date(ts).toLocaleString() : '—'; }

export default function SlackPage() {
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await fetchJson<{ sources: SourceRow[] }>('/api/admin/ingestion/sources');
    setSources((s?.sources ?? []).filter(x => x.connectorKey === 'slack'));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleScan() {
    setBusy(true); setScanMsg(null);
    const res = await fetch('/api/admin/ingestion/slack/scan', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setScanMsg(res.ok ? `Scanned: ${body.channelsDiscovered} channel(s), ${body.channelsNew} new, ${body.channelsChanged} changed.` : (body.error ?? 'Scan failed.'));
    setBusy(false);
    if (res.ok) load();
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Phase 6 — Slack, Google Chat, WhatsApp, Messenger, LinkedIn</h1>
        <p className="text-sm text-gray-500">Only Slack is connected this pass. Requires connecting via <a href="/admin/ai-ingestion/auth" className="underline">Phase 2 Auth</a>.</p>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (<button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{TAB_LABELS[t]}</button>))}
      </div>
      {loading ? <Card><p className="text-sm text-gray-400">Loading…</p></Card> : <>
      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="Slack channels tracked">{sources.length}</Card>
          <Card title="Changed since last scan">{sources.filter(s => s.discoveryStatus === 'changed').length}</Card>
          <Card title="Google Chat">Not built</Card>
          <Card title="WhatsApp / Messenger / LinkedIn">Deferred — need platform app review</Card>
        </div>
      )}
      {tab === 'report' && <Card title="Report"><p className="text-sm text-gray-800">{sources.length} Slack channel(s) tracked, {sources.reduce((n, s) => n + s.versionCount, 0)} version(s) total. Google Chat/WhatsApp/Messenger/LinkedIn: 0 (not built).</p></Card>}
      {tab === 'manual' && (
        <div className="space-y-4">
          <Card title="Goal / Objective"><p className="text-sm text-gray-800"><strong>Goal:</strong> Read Slack channels the bot has been invited to, as sources. <strong>Objective:</strong> Discover member channels, read recent history, hash and version.</p></Card>
          <Card title="Process — Scan now">
            <button onClick={handleScan} disabled={busy} className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Scan now</button>
            {scanMsg && <p className="mt-2 text-xs text-gray-600">{scanMsg}</p>}
          </Card>
          <Card title="Transactional history">
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {sources.map(s => (<li key={s.id} className="border-b border-gray-50 pb-1.5 text-sm last:border-0"><span className="font-mono text-xs text-gray-400">{fmt(s.lastDiscoveredAt)}</span> <span className="font-medium text-gray-700">{s.name}</span> <StatusBadge status={s.discoveryStatus} /></li>))}
              {!sources.length && <li className="text-sm text-gray-400">No channels tracked yet — connect Slack first, invite the bot to a channel, then Scan now.</li>}
            </ul>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary"><p className="text-sm text-gray-800">Slack public/private channels the bot is a member of; recent (200 msg) flat history per channel.</p></Card>
            <Card title="Exclusion boundary"><p className="text-sm text-gray-800">Threads, reactions, edits/deletes, DMs, Google Chat, WhatsApp, Messenger, LinkedIn — deferred (see integration-spec.md).</p></Card>
          </div>
        </div>
      )}
      {tab === 'automatic' && <Card title="Job Schedule"><p className="text-sm text-gray-800">Real automation: <span className="font-mono">slack-scan</span> — every 30 minutes (:05/:35).</p><p className="mt-1 text-sm text-gray-400">Honest no-op until Slack is connected.</p></Card>}
      {tab === 'ai-exp' && <Card title="AI Exp"><p className="text-sm text-gray-800">No AI/LLM step — deterministic Slack Web API calls only.</p></Card>}
      {tab === 'ai-governance' && <Card title="AI Governance"><p className="text-sm text-gray-800">Bot token scoped to channels:read/history + groups:read/history only — no write/post scopes requested.</p></Card>}
      {tab === 'ai-risk' && <Card title="AI Risk"><p className="text-sm text-gray-800">Discovery only includes channels the bot is a member of — it cannot see private channels it hasn't been invited to, and this is not treated as a failure.</p></Card>}
      {tab === 'resai' && <Card title="ResAI"><p className="text-sm text-gray-800">Research AI: not yet automated. Responsible AI: read-only scopes; the bot must be explicitly invited per-channel by a human before any content from that channel is readable.</p></Card>}
      </>}
    </div>
  );
}
