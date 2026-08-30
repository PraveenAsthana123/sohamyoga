'use client';
// Phase 2 — Auth/OAuth credentials admin page. Same 8-tab shell as Phase 1's
// source-registry page (Operational Portal Page & Tab Standard). The Manual
// Process tab is the credential-entry form: paste a connector's OAuth
// Client ID/Secret, then start the real Google consent flow.

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface Connector {
  id: string; connectorKey: string; sourceFamily: string; authType: string; status: string;
}

interface CredentialStatus {
  authStatus: string; requestedScopes: string[]; grantedScopes: string[];
  hasClientCredentials: boolean; tokenExpiresAt: string | null; lastRefreshedAt: string | null;
  lastFailureAt: string | null; lastFailureMessage: string | null;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', not_configured: 'bg-gray-100 text-gray-500',
    auth_requested: 'bg-amber-100 text-amber-700', refresh_failed: 'bg-red-100 text-red-700',
    auth_revoked: 'bg-red-100 text-red-700', token_expired: 'bg-amber-100 text-amber-700',
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

// Only connectors with a real OAuth exchange implemented so far. google_docs/
// google_sheets/google_chat are NOT independently connectable — Drive's OAuth
// grant already covers Docs+Sheets (see integration-spec.md); they're
// intentionally excluded here to avoid implying a separate connect action
// that doesn't exist. WhatsApp/Messenger/LinkedIn need real platform-app
// review processes beyond a simple OAuth app — deferred, see integration-spec.md.
const OAUTH_CANDIDATE_FAMILIES = new Set(['google_drive', 'slack']);

export default function IngestionAuthPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [statuses, setStatuses] = useState<Record<string, CredentialStatus>>({});
  const [loading, setLoading] = useState(true);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oauthSuccess = searchParams.get('oauthSuccess');
  const oauthError = searchParams.get('oauthError');

  const load = useCallback(async () => {
    setLoading(true);
    const c = await fetchJson<{ tenantId: string; connectors: Connector[] }>('/api/admin/ingestion/connectors');
    if (!c) { setLoading(false); return; }
    setTenantId(c.tenantId);
    const oauthConnectors = c.connectors.filter(x => OAUTH_CANDIDATE_FAMILIES.has(x.sourceFamily));
    setConnectors(oauthConnectors);
    if (!selectedConnectorId && oauthConnectors.length) setSelectedConnectorId(oauthConnectors[0].id);

    const entries = await Promise.all(oauthConnectors.map(async conn => {
      const s = await fetchJson<CredentialStatus>(`/api/admin/ingestion/connectors/${conn.id}/credentials?tenantId=${c.tenantId}`);
      return [conn.id, s] as const;
    }));
    setStatuses(Object.fromEntries(entries.filter(([, s]) => s) as [string, CredentialStatus][]));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!tenantId || !selectedConnectorId) return;
    setBusy(true);
    setSaveMsg(null);
    const connector = connectors.find(c => c.id === selectedConnectorId);
    const res = await fetch(`/api/admin/ingestion/connectors/${selectedConnectorId}/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, connectorKey: connector?.connectorKey, clientId, clientSecret }),
    });
    const body = await res.json().catch(() => ({}));
    setSaveMsg(res.ok ? 'Saved. You can now start the OAuth connection below.' : (body.error ?? 'Save failed.'));
    setBusy(false);
    if (res.ok) { setClientId(''); setClientSecret(''); load(); }
  }

  function handleConnect() {
    if (!tenantId || !selectedConnectorId) return;
    window.location.href = `/api/admin/ingestion/connectors/${selectedConnectorId}/oauth/start?tenantId=${tenantId}`;
  }

  const selectedStatus = statuses[selectedConnectorId];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Phase 2 — Authentication &amp; OAuth Credentials</h1>
        <p className="text-sm text-gray-500">Part of the AI Ingestion pipeline. See src/domain/ingestion/integration-spec.md for scope notes.</p>
      </div>

      {oauthSuccess && <Card><p className="text-sm text-emerald-700">Connected successfully.</p></Card>}
      {oauthError && <Card><p className="text-sm text-red-700">OAuth error: {oauthError}</p></Card>}

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
          <Card title="OAuth-capable connectors">{connectors.length}</Card>
          <Card title="Configured (credentials saved)">{Object.values(statuses).filter(s => s.hasClientCredentials).length}</Card>
          <Card title="Active connections">{Object.values(statuses).filter(s => s.authStatus === 'active').length}</Card>
          <Card title="Failed">{Object.values(statuses).filter(s => s.authStatus === 'refresh_failed' || s.authStatus === 'auth_revoked').length}</Card>
          <div className="sm:col-span-4">
            <Card title="Connector auth status">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400"><th className="pb-2">Connector</th><th>Status</th><th>Granted scopes</th></tr></thead>
                <tbody>
                  {connectors.map(c => (
                    <tr key={c.id} className="border-t border-gray-50">
                      <td className="py-1.5 font-mono text-xs">{c.sourceFamily}</td>
                      <td><StatusBadge status={statuses[c.id]?.authStatus ?? 'not_configured'} /></td>
                      <td className="text-xs text-gray-500">{statuses[c.id]?.grantedScopes.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <Card title="Report — Auth &amp; OAuth Credentials">
          <p className="text-sm text-gray-800">
            {Object.values(statuses).filter(s => s.hasClientCredentials).length} of {connectors.length} OAuth-capable connectors have credentials saved;
            {' '}{Object.values(statuses).filter(s => s.authStatus === 'active').length} are actively connected.
            No real Google OAuth app has been connected yet unless you've completed the flow below.
          </p>
        </Card>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <Card title="Goal / Objective">
            <p className="text-sm text-gray-800 mb-1"><strong>Goal:</strong> Let an admin connect a real Google OAuth app without ever exposing credentials to Claude or storing them raw.</p>
            <p className="text-sm text-gray-800"><strong>Objective:</strong> Save a Client ID/Secret (vault-referenced only), then complete the real Google consent flow.</p>
          </Card>

          <Card title="Input — Connect a connector">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Connector</label>
                <select value={selectedConnectorId} onChange={e => setSelectedConnectorId(e.target.value)}
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm">
                  {connectors.map(c => <option key={c.id} value={c.id}>{c.sourceFamily}</option>)}
                </select>
              </div>
              {selectedStatus?.hasClientCredentials ? (
                <p className="text-sm text-emerald-700">Client credentials configured ✓</p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Client ID</label>
                    <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
                      className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Client Secret</label>
                    <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                      className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
                  </div>
                  <button onClick={handleSave} disabled={busy || !clientId || !clientSecret}
                    className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                    Save credentials
                  </button>
                </>
              )}
              {saveMsg && <p className="text-xs text-gray-600">{saveMsg}</p>}
              <p className="text-xs text-gray-400">
                Redirect URI to register in your {connectors.find(c => c.id === selectedConnectorId)?.sourceFamily === 'slack' ? 'Slack app' : 'Google Cloud Console OAuth app'}:{' '}
                <code className="rounded bg-gray-100 px-1">
                  {typeof window !== 'undefined' ? window.location.origin : ''}
                  {connectors.find(c => c.id === selectedConnectorId)?.sourceFamily === 'slack' ? '/api/admin/ingestion/oauth/slack/callback' : '/api/admin/ingestion/oauth/google/callback'}
                </code>
              </p>
              {selectedStatus?.hasClientCredentials && (
                <button onClick={handleConnect}
                  className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                  Connect via {connectors.find(c => c.id === selectedConnectorId)?.sourceFamily === 'slack' ? 'Slack' : 'Google'}
                </button>
              )}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary"><p className="text-sm text-gray-800">Real Google OAuth2 authorization-code flow, credential vault storage, token refresh.</p></Card>
            <Card title="Exclusion boundary"><p className="text-sm text-gray-800">RBAC/ABAC, purpose-based access, break-glass, optimistic concurrency — deferred until a write-capable connector exists (see integration-spec.md).</p></Card>
          </div>

          <Card title="Status (Completed / Pending / Running) — timestamped history">
            <ul className="space-y-1">
              {connectors.map(c => (
                <li key={c.id} className="text-xs text-gray-500">
                  <span className="font-mono">{fmt(statuses[c.id]?.lastRefreshedAt)}</span> — {c.sourceFamily}: <StatusBadge status={statuses[c.id]?.authStatus ?? 'not_configured'} />
                  {statuses[c.id]?.lastFailureMessage && <span className="text-red-600"> — {statuses[c.id].lastFailureMessage}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'automatic' && (
        <Card title="Job Schedule">
          <p className="text-sm text-gray-800">Real automation: <span className="font-mono">connector-token-refresh</span> — every 30 minutes, refreshes any active connector credential whose token expires within 10 minutes.</p>
          <p className="mt-1 text-sm text-gray-400">Currently an honest no-op — no real Google OAuth app has been connected yet.</p>
        </Card>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['explainability', 'experiment', 'experience'] as const).map(s => (
              <button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
            ))}
          </div>
          {aiExpSub === 'explainability' && <Card title="Explainability"><p className="text-sm text-gray-800">No AI/LLM step exists in Phase 2 — this is a deterministic OAuth2 authorization-code flow using google-auth-library, no model in the loop.</p></Card>}
          {aiExpSub === 'experiment' && <Card title="Experiment"><p className="text-sm text-gray-800">N/A — nothing to experiment with in a standard OAuth flow.</p></Card>}
          {aiExpSub === 'experience' && <Card title="Experience"><p className="text-sm text-gray-800">You paste a Client ID/Secret, click Connect, approve on Google's real consent screen, and come back connected — no AI involved.</p></Card>}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> none — deterministic OAuth flow only.</p>
            <p><strong>Credential handling:</strong> Client ID/Secret and tokens are written to OpenBao (vault:// reference only); the database never stores raw secret values, and this page never re-displays a saved secret.</p>
            <p><strong>Policy compliance:</strong> Follows this workspace's Operational Portal Page &amp; Tab Standard.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes:</strong> an invalid/expired Client Secret will fail the token exchange with a clear error; a revoked Google grant will surface as refresh_failed on the next scheduled refresh.</p>
            <p><strong>Mitigations:</strong> every failure is recorded with a timestamp and message rather than failing silently; the connect button fails closed with a clear message if credentials aren't saved yet.</p>
            <p><strong>Current risk level:</strong> {Object.values(statuses).some(s => s.authStatus === 'refresh_failed') ? 'Elevated (at least one connector has a failed refresh)' : 'Low'}</p>
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
          {resAiSub === 'research-ai' && <Card title="Research AI"><p className="text-sm text-gray-800">Not yet automated — no AI agent involved in Phase 2's credential/auth flow.</p></Card>}
          {resAiSub === 'responsible-ai' && (
            <Card title="Responsible AI">
              <div className="space-y-2 text-sm text-gray-800">
                <p><strong>Data provenance:</strong> every credential is tied to the admin who saved it (connected_by_type/connected_by_id) with a timestamp.</p>
                <p><strong>Consent/privacy:</strong> the OAuth consent screen is Google's own, shown to the admin directly — this app never sees the admin's Google password.</p>
                <p><strong>Bias checks:</strong> N/A — no model output.</p>
              </div>
            </Card>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
