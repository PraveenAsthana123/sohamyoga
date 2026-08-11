'use client';
// /admin/social/scheduler — native campaign scheduling: create a draft,
// target platforms, request approval, then schedule/publish through
// Postiz's real Public API (/public/v1, verified directly against the
// running container's compiled source — see the docstring in
// src/app/api/mcp/social/route.ts for exactly what was wrong before and
// what "real" means here).
//
// Two real blockers, both outside what this code can resolve on its own,
// surfaced honestly rather than hidden:
// 1. Postiz account registration in this environment currently fails
//    ("Failed to signalWithStart Workflow") because no Temporal server is
//    deployed — a pre-existing, already-documented infra gap (see
//    integrations/postiz/docker-compose.yml), not something this page can
//    work around.
// 2. Even with a Postiz account + API key configured, publishing still
//    needs at least one social platform connected via Postiz's own OAuth
//    flow — the same real-account blocker already established elsewhere
//    this session.
// Everything on THIS side (draft creation, platform targeting, the
// approval workflow) is real and independently testable regardless of
// those two blockers.

import { useEffect, useState } from 'react';
import { PLATFORM_CONFIG, type SocialPlatform } from '@/domain/social/SocialAccount';

const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const WORKSPACE_ID = TENANT_ID; // no separate workspace table exists — single-tenant deployment

interface Draft {
  id: string; master_text: string; content_type: string; status: string;
  generated_with_ai: boolean; tags: string[]; created_at: string;
  variants: Array<{ platform: string; adapted_text: string; status: string; account_id: string | null }>;
}
interface Approval {
  id: string; tool_name: string; draft_id: string; status: string; expires_at: string;
  notes: string | null; created_at: string; master_text: string | null;
}

async function callMcp(tool: string, input: Record<string, unknown>) {
  const res = await fetch('/api/mcp/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `${tool} failed`);
  return data.result;
}

function NewDraftForm({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState('');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const submit = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const result = await callMcp('create_content_draft', {
        tenantId: TENANT_ID, workspaceId: WORKSPACE_ID, masterText: text,
        contentType: 'text', platforms, generatedWithAI: false, tags: [],
      }) as { draftId: string; unmatchedPlatforms: string[] };
      if (result.unmatchedPlatforms.length) {
        setNote(`Draft created, but no connected account yet for: ${result.unmatchedPlatforms.join(', ')} — those platforms won't be schedulable until an account is connected.`);
      }
      setText(''); setPlatforms([]);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create draft');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="font-semibold">New Draft</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {note && <div className="text-sm text-amber-700">{note}</div>}
      <textarea
        value={text} onChange={e => setText(e.target.value)} rows={3}
        placeholder="Post copy..." className="w-full rounded border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PLATFORM_CONFIG) as SocialPlatform[]).map(p => (
          <button
            key={p} type="button" onClick={() => togglePlatform(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${platforms.includes(p) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {PLATFORM_CONFIG[p].displayName}
          </button>
        ))}
      </div>
      <button
        onClick={submit} disabled={busy || !text || !platforms.length}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create Draft'}
      </button>
    </div>
  );
}

function DraftRow({ draft, onChanged }: { draft: Draft; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestApproval = async () => {
    setBusy(true); setError('');
    try {
      await callMcp('request_approval', { draftId: draft.id, note: 'Requested from scheduler UI' });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-gray-800">{draft.master_text}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {draft.variants.map(v => (
              <span key={v.platform} className={`rounded px-1.5 py-0.5 text-xs ${v.account_id ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {v.platform}{!v.account_id && ' (unconnected)'}
              </span>
            ))}
          </div>
          <div className="mt-1 text-xs text-gray-400">status: {draft.status} · {new Date(draft.created_at).toLocaleString()}</div>
        </div>
        {draft.status === 'draft' && (
          <button onClick={requestApproval} disabled={busy} className="shrink-0 rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-50">
            {busy ? '…' : 'Request Approval'}
          </button>
        )}
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

function ApprovalRow({ approval, onDecided }: { approval: Approval; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const decide = async (decision: 'approved' | 'rejected') => {
    setBusy(true); setResult('');
    try {
      const res = await fetch(`/api/admin/social/approvals/${approval.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDecided();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="text-gray-800">{approval.master_text ?? approval.draft_id}</p>
      <div className="mt-1 text-xs text-gray-400">{approval.tool_name} · requested {new Date(approval.created_at).toLocaleString()} · expires {new Date(approval.expires_at).toLocaleString()}</div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => decide('approved')} disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
        <button onClick={() => decide('rejected')} disabled={busy} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
      </div>
      {result && <div className="mt-1 text-xs text-red-600">{result}</div>}
    </div>
  );
}

export default function SocialSchedulerPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [accountsNote, setAccountsNote] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/admin/social/drafts', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setDrafts(d.drafts); })
      .catch(e => setError(e.message));
    fetch('/api/admin/social/approvals?status=pending', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setApprovals(d.approvals); })
      .catch(e => setError(e.message));
  };

  useEffect(() => {
    load();
    callMcp('list_social_accounts', { workspaceId: WORKSPACE_ID })
      .then((r) => setAccountsNote(JSON.stringify(r).slice(0, 200)))
      .catch(e => setAccountsError(e instanceof Error ? e.message : 'Failed to reach Postiz'));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Social Campaign Scheduler</h1>
        <p className="text-sm text-gray-500">Draft → approve → schedule/publish via Postiz's real Public API.</p>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-2">Connected Accounts (live from Postiz)</h2>
        {accountsError && <p className="text-sm text-amber-700">{accountsError}</p>}
        {accountsNote && !accountsError && <p className="text-xs text-gray-500 font-mono">{accountsNote}</p>}
      </section>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <NewDraftForm onCreated={load} />

      <section className="space-y-2">
        <h2 className="font-semibold">Pending Approvals ({approvals.length})</h2>
        {approvals.length === 0 && <p className="text-sm text-gray-400">Nothing pending.</p>}
        {approvals.map(a => <ApprovalRow key={a.id} approval={a} onDecided={load} />)}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Drafts ({drafts.length})</h2>
        {drafts.length === 0 && <p className="text-sm text-gray-400">No drafts yet — create one above.</p>}
        {drafts.map(d => <DraftRow key={d.id} draft={d} onChanged={load} />)}
      </section>
    </div>
  );
}
