'use client';

// Voice AI module — implements the mandatory Operational Portal Page & Tab
// Standard (8 tabs, 13-field process sub-structure), the same way
// operations-alerts/page.tsx does for this portal's failure tracking.
// Module contract / demo use cases / schema reference for this module live
// in docs/modules/voice-ai/README.md (the "shared, plug-and-play module"
// doc requested alongside this page).

import { FormEvent, useCallback, useEffect, useState } from 'react';

type R = Record<string, any>;
const empty = {
  agents: [] as R[], scripts: [] as R[], calls: [] as R[], events: [] as R[], audio: [] as R[],
  trunks: [] as R[], endpoints: [] as R[], workflows: [] as R[], routes: [] as R[], profiles: [] as R[],
  connection: null as R | null, monitor: null as R | null, summary: {} as R, jobRuns: [] as R[], leads: [] as R[],
};

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process (Job)',
  'ai-exp': 'AI Exp', 'ai-governance': 'AI Governance', 'ai-risk': 'AI Risk', resai: 'ResAI',
};

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>}
      {children}
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-600', running: 'bg-amber-100 text-amber-700', succeeded: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700',
    scheduled: 'bg-blue-100 text-blue-700', blocked: 'bg-amber-100 text-amber-800', completed: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}
function fmt(ts: string | null | undefined): string { return ts ? new Date(ts).toLocaleString() : '—'; }

const DEMO_USE_CASES = [
  { name: 'Consented follow-up call', flow: 'Lead submits form → CRM captures lead → admin picks an approved script → Queue call → dispatch job enforces schedule/connection gating.' },
  { name: 'Qualification + appointment booking', flow: 'Approved "qualification" or "appointment" script type drives discovery questions and a booking CTA once a real telephony provider is connected.' },
  { name: 'Inbound routing (business-hours aware)', flow: 'voice_routing_rule maps an inbound DID + business_hours to an agent/script/workflow, with a human-handoff fallback extension. Requires a trunk + DID before it can be enabled.' },
  { name: 'Simulate inbound call (pre-PSTN verification)', flow: 'Admin clicks Simulate on a routing rule → real voice_call row created (direction=inbound, clearly marked disposition="simulated_test") → verifies agent/script/workflow matching before any real telephony provider exists.' },
  { name: 'Local voice preview for compliance review', flow: 'Admin drafts a disclosure/opening line → generates a real local espeak-ng WAV → reviews before approving the script.' },
  { name: 'Call transcript for QA', flow: 'A recorded call\'s audio is uploaded to /api/voice-ai/transcribe → real faster-whisper transcript stored on voice_call.transcript.' },
];

export default function VoiceAI() {
  const [d, setD] = useState(empty), [msg, setMsg] = useState(''), [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');
  const [agent, setAgent] = useState({ name: 'Marketing qualification assistant', purpose: 'Qualify consented leads and book appointments', language: 'English', voiceName: 'en', instructions: 'Be concise, disclose AI use, never make medical or pricing promises.', knowledgeScope: 'Approved studio services and booking availability only.' });
  const [script, setScript] = useState({ name: 'Consented lead follow-up', scriptType: 'follow_up', opening: 'Hello, this is the SohamYoga virtual assistant following up on your request. This call may be recorded and processed by AI. Is now a good time?', cta: 'Would you like me to help schedule an introductory session?', disclosures: 'Identify the business, AI assistant, purpose and recording before qualification.', forbiddenClaims: 'No medical outcomes, guaranteed results, invented prices or unavailable appointments.' });
  const [preview, setPreview] = useState('Hello, this is the SohamYoga virtual assistant. This is a local voice preview and no telephone call is being placed.');
  const [phone, setPhone] = useState('+14035550100');

  const load = useCallback(() => fetch('/api/voice-ai', { cache: 'no-store' }).then(r => r.json()).then(setD), []);
  useEffect(() => { void load() }, [load]);
  async function act(body: R) { const r = await fetch('/api/voice-ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), j = await r.json(); setMsg(r.ok ? 'Saved' : j.error); await load(); return j }
  async function createAgent(e: FormEvent) { e.preventDefault(); await act({ action: 'create_agent', ...agent }) }
  async function createScript(e: FormEvent) { e.preventDefault(); await act({ action: 'create_script', ...script, agentId: d.agents[0]?.id }) }
  async function voice(e: FormEvent) { e.preventDefault(); const r = await fetch('/api/voice-ai/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Voice AI compliance preview', text: preview, voiceName: 'en' }) }), j = await r.json(); setMsg(r.ok ? `Voice preview ready: ${j.asset.filePath}` : j.error); await load() }

  const approvedScripts = d.scripts.filter((s: R) => ['approved', 'active'].includes(s.status));
  const draftScripts = d.scripts.filter((s: R) => ['draft', 'review'].includes(s.status));
  const blockedCalls = d.calls.filter((c: R) => c.status === 'blocked');
  const scheduledCalls = d.calls.filter((c: R) => c.status === 'scheduled');
  const connected = d.connection?.status === 'connected';
  const lastJobRun = d.jobRuns[0] ?? null;
  const callableLeads = d.leads.filter((l: R) => /^\+[1-9][0-9]{7,14}$/.test(l.phone || ''));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Voice AI</h1>
        <p className="text-sm text-gray-500">Inbound and outbound calling module: agents, scripts, SIP, workflows, voice profiles, consent, calls, leads, transcripts and evidence. Module contract: docs/modules/voice-ai/README.md.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="rounded border bg-blue-50 p-2 text-sm">{msg}</p>}

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="PSTN"><span className={connected ? 'text-emerald-600' : 'text-amber-600'}>{d.connection?.status || 'missing'}</span></Card>
          <Card title="PBX"><span>{d.monitor?.healthy ? 'healthy' : 'not reported'}</span></Card>
          <Card title="Calls"><span className="text-2xl font-bold">{d.summary?.total || 0}</span></Card>
          <Card title="Completed"><span className="text-2xl font-bold text-emerald-600">{d.summary?.completed || 0}</span></Card>
          <Card title="Blocked (no telephony)"><span className="text-2xl font-bold text-amber-600">{d.summary?.blocked || 0}</span></Card>
          <Card title="Agents">{d.agents.length}</Card>
          <Card title="Scripts (approved/total)">{approvedScripts.length}/{d.scripts.length}</Card>
          <Card title="Callable leads">{callableLeads.length} of {d.leads.length}</Card>
          <Card title="Inbound routes (enabled/total)">{d.routes.filter((r: R) => r.enabled).length}/{d.routes.length}</Card>
          <Card title="Inbound calls (incl. simulated)">{d.calls.filter((c: R) => c.direction === 'inbound').length}</Card>
        </div>
      )}

      {tab === 'report' && (
        <Card title="Report — Voice AI Activity">
          <div className="space-y-2 text-sm text-gray-800">
            <p>As of {new Date().toLocaleString()}: {d.summary?.total || 0} total call record(s), {d.summary?.completed || 0} completed, {blockedCalls.length} blocked, {scheduledCalls.length} scheduled and awaiting the dispatch sweep.</p>
            <p>{approvedScripts.length} of {d.scripts.length} scripts are approved/active; {draftScripts.length} still need review before they can be used for a real call.</p>
            <p className={connected ? 'text-emerald-700' : 'font-medium text-amber-700'}>{connected ? `Telephony connected via ${d.connection?.provider}.` : 'No telephony provider connected — every queued outbound call is honestly recorded as blocked, never fabricated as placed.'}</p>
            <p>{callableLeads.length} lead(s) currently have a valid E.164 phone and could be called once telephony is connected.</p>
          </div>
        </Card>
      )}

      {(tab === 'manual' || tab === 'automatic') && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Goal">
              <p className="text-sm text-gray-800">{tab === 'manual'
                ? 'Every agent, script, SIP trunk and routing rule is authored, reviewed and approved by a human before it can touch a real call.'
                : 'Calls that were scheduled do not sit silently past their scheduled_at time — the platform actively enforces the schedule and telephony-connection boundary without a human watching.'}</p>
            </Card>
            <Card title="Objective">
              <p className="text-sm text-gray-800">{tab === 'manual' ? 'Zero calls placed on an unapproved script or without recorded consent + DNC confirmation.' : 'Zero stale "scheduled" calls — every due call is resolved (dispatched or honestly blocked) within one sweep cycle (5 minutes).'}</p>
            </Card>
          </div>

          <Card title="To-do list">
            <ul className="space-y-1.5 text-sm">
              {tab === 'manual' ? (
                draftScripts.length === 0
                  ? <li className="flex items-center gap-2"><input type="checkbox" checked disabled /> <span className="text-gray-400 line-through">Review all draft/review scripts</span></li>
                  : draftScripts.map((s: R) => <li key={s.id} className="flex items-center gap-2"><input type="checkbox" checked={false} disabled /> <span>Review script: {s.name} ({s.script_type})</span></li>)
              ) : (
                <>
                  <li className="flex items-center gap-2"><input type="checkbox" checked={d.jobRuns.length > 0} disabled /> <span className={d.jobRuns.length > 0 ? 'text-gray-400 line-through' : ''}>Register voice-call-dispatch in job_registry and run at least once</span></li>
                  <li className="flex items-center gap-2"><input type="checkbox" checked={lastJobRun?.status === 'succeeded'} disabled /> <span className={lastJobRun?.status === 'succeeded' ? 'text-gray-400 line-through' : ''}>Confirm the most recent scheduled run succeeded</span></li>
                </>
              )}
            </ul>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="Input">
              <p className="text-sm text-gray-800">{tab === 'manual' ? `${draftScripts.length} draft/review script(s), ${d.trunks.length} SIP trunk record(s), ${callableLeads.length} callable lead(s).` : `voice_call rows with status='scheduled' and scheduled_at <= now().`}</p>
            </Card>
            <Card title="Process">
              <p className="text-sm text-gray-800">{tab === 'manual' ? 'Admin authors an agent + versioned script, approves it, then queues a call for a lead or test number with a recorded consent basis and DNC confirmation.' : 'Every 5 minutes via cron ("voice-call-dispatch") and on-demand via /api/jobs/run: sweeps due-and-still-scheduled calls, checks marketing_channel_connection for the voice channel, and relabels each to "blocked" with the true reason — there is no PSTN dispatch client in this app, so a real call is never fabricated as placed.'}</p>
            </Card>
            <Card title="Output">
              <p className="text-sm text-gray-800">{tab === 'manual' ? `${approvedScripts.length} approved script(s) available to queue calls with.` : `${lastJobRun?.result_summary ? JSON.parse(lastJobRun.result_summary).relabeled : 0} call(s) relabeled on the last run.`}</p>
            </Card>
          </div>

          <Card title="Visualization">
            <pre className="overflow-x-auto text-xs text-gray-700">{JSON.stringify({ scripts: d.scripts.map((s: R) => ({ name: s.name, status: s.status })), calls_by_status: d.calls.reduce((m: R, c: R) => ({ ...m, [c.status]: (m[c.status] || 0) + 1 }), {}) }, null, 2)}</pre>
          </Card>

          <Card title="Transactional history (timestamped)">
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {d.events.map((e: R) => (
                <li key={e.id} className="border-b border-gray-50 pb-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs text-gray-400">{fmt(e.occurred_at)}</span>{' '}<span className="font-medium text-gray-700">{e.event_name}</span>
                  {e.payload?.reason && <span className="text-gray-600"> — {String(e.payload.reason).slice(0, 120)}</span>}
                </li>
              ))}
              {!d.events.length && <li className="text-sm text-gray-400">No call events recorded yet.</li>}
            </ul>
          </Card>

          <Card title="Checklist">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><input type="checkbox" checked={draftScripts.length === 0} disabled /> No script stuck in draft/review</li>
              <li className="flex items-center gap-2"><input type="checkbox" checked={scheduledCalls.length === 0} disabled /> No call stuck past its scheduled time</li>
              <li className="flex items-center gap-2"><input type="checkbox" checked={d.jobRuns.some((j: R) => j.status === 'succeeded')} disabled /> Dispatch sweep has at least one successful run</li>
            </ul>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary"><p className="text-sm text-gray-800">Covers: agent/script authoring and approval, lead-to-call queuing, SIP trunk/route/profile records, local TTS preview, local call transcription, and honest schedule/connection enforcement.</p></Card>
            <Card title="Exclusion boundary"><p className="text-sm text-gray-800">Does not cover: actually placing or receiving a PSTN call (no dispatch client exists), voice cloning (schema field exists, unused), or LLM-drafted scripts (script_generate job type exists in the schema, has zero implementation).</p></Card>
          </div>

          <Card title="Task list">
            <ul className="space-y-1.5 text-sm">
              {(tab === 'manual' ? draftScripts : blockedCalls).slice(0, 10).map((x: R) => (
                <li key={x.id} className="flex items-center justify-between"><span>{tab === 'manual' ? x.name : `${x.direction} call · ${x.phone_e164 || 'unknown'}`}</span><span className="text-xs text-gray-400">{x.status}</span></li>
              ))}
              {(tab === 'manual' ? draftScripts.length : blockedCalls.length) === 0 && <li className="text-gray-400">No open tasks.</li>}
            </ul>
          </Card>

          <Card title="Final outcome report">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{tab === 'automatic' && lastJobRun
              ? `Last scheduled run: ${lastJobRun.status}${lastJobRun.duration_ms !== null ? ` in ${lastJobRun.duration_ms}ms` : ''}. ${lastJobRun.result_summary ?? ''}`
              : draftScripts.length === 0 ? 'All scripts reviewed.' : `${draftScripts.length} script(s) awaiting review.`}</p>
          </Card>

          {tab === 'manual' && (
            <Card title="Status (Completed / Pending / Running)">
              <div className="mb-2"><StatusBadge status={draftScripts.length === 0 ? 'succeeded' : 'running'} /></div>
            </Card>
          )}
          {tab === 'automatic' && (
            <Card title="Status (Completed / Pending / Running) — job run history">
              <ul className="space-y-1">
                {d.jobRuns.map((j: R) => (
                  <li key={j.id} className="text-xs text-gray-600"><span className="font-mono">{fmt(j.started_at)}</span> — <StatusBadge status={j.status} /> {j.duration_ms !== null && `(${j.duration_ms}ms)`} {j.error_message && `— ${j.error_message}`}</li>
                ))}
                {!d.jobRuns.length && <li className="text-sm text-gray-400">No scheduled run yet — the cron runner (`npm run cron`) registers &quot;voice-call-dispatch&quot; every 5 minutes once running, or trigger it now via /api/jobs/run.</li>}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['explainability', 'experiment', 'experience'] as const).map(s => <button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>)}</div>
          {aiExpSub === 'explainability' && <Card title="Explainability"><p className="text-sm text-gray-800">Voice preview uses espeak-ng, a deterministic rule-based TTS engine — there is no model to explain. Call transcription uses faster-whisper (base.en), a real local ASR model; it returns text only, no per-word confidence is currently surfaced. Script content itself is entirely human-authored — no LLM drafts or edits it.</p></Card>}
          {aiExpSub === 'experiment' && <Card title="Experiment"><p className="text-sm text-gray-800">No model/prompt variants have been tried for this module — TTS and STT each use one fixed local engine, and script authoring has no AI in the loop yet. The schema's script_generate job type is reserved for a future Ollama-drafted script experiment, not implemented.</p></Card>}
          {aiExpSub === 'experience' && <Card title="Experience"><p className="text-sm text-gray-800">Plain-language: this module lets you draft a call script, hear it read aloud locally to check tone/compliance, and queue a real customer call once approved. If a real call happens and is recorded, its audio can be turned into text automatically. No AI decides who to call or what to say — a human writes and approves the script every time.</p></Card>}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> espeak-ng (deterministic, no training data/versioning to track) for TTS; faster-whisper base.en (fixed local model file) for transcription.</p>
            <p><strong>Approval status:</strong> every voice_script requires human approval (draft/review → approved/active) before it can be attached to a queued call — enforced server-side, not just in the UI.</p>
            <p><strong>Policy compliance:</strong> voice_agent carries a mandatory recording_disclosure and human_handoff_rule; voice_script carries required_disclosures and forbidden_claims fields that must be filled in at authoring time.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes:</strong> faster-whisper can mis-transcribe accented or noisy audio with no confidence signal surfaced to flag low-trust transcripts for human review — noted here, not yet mitigated.</p>
            <p><strong>Bias/hallucination risk:</strong> transcription can hallucinate words in silence/noise (a known faster-whisper behavior); script content has zero generative risk since it is entirely human-authored.</p>
            <p><strong>Mitigations:</strong> consent_basis and do_not_call_checked_at are required, non-bypassable fields on every queued call; forbidden_claims is a required script field reviewed at approval time.</p>
            <p><strong>Current risk level:</strong> {connected ? 'Elevated once telephony is connected — transcript confidence gap becomes real-world relevant.' : 'Low — no real call has ever been placed; this module can only reach a "blocked" outcome today.'}</p>
          </div>
        </Card>
      )}

      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['research-ai', 'responsible-ai'] as const).map(s => <button key={s} onClick={() => setResAiSub(s)} className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>{s === 'research-ai' ? 'Research AI' : 'Responsible AI'}</button>)}</div>
          {resAiSub === 'research-ai' && <Card title="Research AI"><p className="text-sm text-gray-800">No research agent runs for this module today. A natural extension: an Ollama-backed summarizer that reads a completed call's real transcript and drafts a plain-English disposition/intent hypothesis for the Report tab — not yet built, listed honestly rather than implied here.</p></Card>}
          {resAiSub === 'responsible-ai' && <Card title="Responsible AI"><div className="space-y-2 text-sm text-gray-800"><p><strong>Data provenance:</strong> transcripts come only from audio a human uploads for a specific call; no external data is used.</p><p><strong>Consent/privacy:</strong> voice_call.consent_basis and do_not_call_checked_at are required at queue time; a lead's phone number is never auto-called without an admin explicitly clicking Queue call.</p><p><strong>Bias checks:</strong> not applicable to TTS/STT engines used; script forbidden_claims review is the compliance control for generated speech content (which is human-written, not generated).</p></div></Card>}
        </div>
      )}

      {/* Working module UI below the mandatory tabs: agent/script authoring, SIP, workflows, previews, scheduling, monitoring — unchanged from the module's real functional surface. */}
      <div className="border-t pt-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Module workspace</h2>
        <div className="space-y-5">
          <Card title="Demo use cases">
            <ul className="space-y-2 text-sm">{DEMO_USE_CASES.map(u => <li key={u.name}><strong>{u.name}:</strong> <span className="text-gray-600">{u.flow}</span></li>)}</ul>
          </Card>
          <section className="rounded-xl border bg-white p-4"><div className="flex justify-between"><strong>PSTN readiness</strong><span className={connected ? 'text-green-700' : 'text-amber-700'}>{d.connection?.status || 'missing'}</span></div><p className="text-sm text-gray-500">{d.connection?.provider || 'No telephony provider'} — outbound jobs stay blocked until a trunk is registered and the provider is connected.</p></section>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">SIP / PJSIP control plane</h2><p className="my-2 text-sm text-gray-500">Secrets stay in environment or Vault; this UI stores references only. New routes are disabled by default.</p><button onClick={() => act({ action: 'create_trunk', name: `Local Asterisk ${d.trunks.length + 1}`, provider: 'Asterisk/PJSIP', host: '127.0.0.1', port: 15060, transport: 'udp', authUsername: '1001', secretRef: 'ASTERISK_SIP_SECRET' })} className="rounded bg-slate-800 px-3 py-2 text-white">Add local trunk record</button>{d.trunks.map((t: R) => <div key={t.id} className="mt-3 rounded border p-2 text-sm"><strong>{t.name}</strong> · {t.status}<div className="text-gray-500">{t.host}:{t.port}/{t.transport} · secret: {t.secret_ref || 'not assigned'}</div></div>)}</div>
            <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Workflows and inbound routing</h2><button onClick={() => act({ action: 'create_workflow', name: `Qualification workflow ${d.workflows.length + 1}`, direction: 'both', steps: [{ type: 'disclosure' }, { type: 'consent_check' }, { type: 'qualify' }, { type: 'appointment' }, { type: 'human_handoff' }] })} className="mt-2 rounded bg-indigo-700 px-3 py-2 text-white">Create safe workflow</button>{d.workflows.map((w: R) => <div key={w.id} className="mt-3 rounded border p-2 text-sm"><strong>{w.name}</strong> · {w.direction} · {w.status}<div>{Array.isArray(w.steps) ? w.steps.map((s: R) => s.type).join(' → ') : ''}</div>{!d.routes.some((r: R) => r.workflow_id === w.id) && <button onClick={() => act({ action: 'create_route', name: `Inbound route ${d.routes.length + 1}`, workflowId: w.id, agentId: d.agents[0]?.id, scriptId: d.scripts.find((s: R) => ['approved', 'active'].includes(s.status))?.id, fallbackExtension: '1001' })} className="mt-2 rounded border px-2 py-1">Add disabled inbound route</button>}</div>)}</div>
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Inbound Call Center</h2>
            <p className="my-2 text-sm text-gray-500">Every routing rule maps an inbound DID to an agent/script/workflow. A rule needs both a trunk and a DID assigned before it can be enabled — enabling it with no real telephony provider connected has no effect on real calls, but lets you verify the config and simulate the match now.</p>
            {d.routes.map((r: R) => (
              <div key={r.id} className="mt-3 rounded border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><strong>{r.name}</strong> · priority {r.priority} · DID: {r.inbound_did || 'unassigned'} · fallback: {r.fallback_extension || 'none'}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{r.enabled ? 'enabled' : 'disabled'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => act({ action: 'toggle_route', routeId: r.id })} className={`rounded px-3 py-1 text-xs font-medium text-white ${r.enabled ? 'bg-gray-600' : 'bg-emerald-700'}`}>{r.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => act({ action: 'simulate_inbound_call', routeId: r.id })} className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white">Simulate inbound test call</button>
                </div>
              </div>
            ))}
            {!d.routes.length && <p className="mt-2 text-sm text-gray-400">No routing rules yet — create a workflow below, then add a route from it.</p>}
          </section>
          <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Voice modulation profiles</h2><p className="text-sm text-gray-500">Rate, pitch and volume are bounded. Voice cloning requires a recorded consent reference.</p><button onClick={() => act({ action: 'create_profile', name: `Professional profile ${d.profiles.length + 1}`, voiceName: 'en', language: 'English', speakingRate: 1, pitch: 0, volume: 0, style: 'professional' })} className="mt-2 rounded bg-violet-700 px-3 py-2 text-white">Create profile</button><div className="mt-3 flex flex-wrap gap-2">{d.profiles.map((p: R) => <span key={p.id} className="rounded border px-3 py-2 text-sm">{p.name}: {p.speaking_rate}×, {p.pitch_semitones} st, {p.status}</span>)}</div></section>
          <section className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={createAgent} className="space-y-2 rounded-xl border bg-white p-5"><h2 className="font-semibold">Create Voice AI agent</h2>{Object.entries(agent).map(([k, v]) => <label key={k} className="block text-sm">{k}<input className="mt-1 w-full rounded border p-2" value={v} onChange={e => setAgent({ ...agent, [k]: e.target.value })} /></label>)}<button className="rounded bg-brand-600 px-4 py-2 text-white">Create draft agent</button></form>
            <form onSubmit={createScript} className="space-y-2 rounded-xl border bg-white p-5"><h2 className="font-semibold">Create versioned call script</h2>{Object.entries(script).map(([k, v]) => <label key={k} className="block text-sm">{k}<textarea className="mt-1 w-full rounded border p-2" value={v} onChange={e => setScript({ ...script, [k]: e.target.value })} /></label>)}<button className="rounded bg-gray-800 px-4 py-2 text-white">Create draft script</button></form>
          </section>
          <form onSubmit={voice} className="space-y-2 rounded-xl border bg-white p-5"><h2 className="font-semibold">Generate real local voice preview</h2><textarea className="h-24 w-full rounded border p-2" value={preview} onChange={e => setPreview(e.target.value)} /><button className="rounded bg-indigo-700 px-4 py-2 text-white">Generate WAV</button><div className="flex flex-wrap gap-3">{d.audio.map((a: R) => <audio key={a.id} controls src={a.file_path} />)}</div></form>
          <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Scripts and outbound scheduling</h2><label className="mt-3 block text-sm">Test E.164 phone<input className="ml-2 rounded border p-1" value={phone} onChange={e => setPhone(e.target.value)} /></label>{d.scripts.map((s: R) => <div key={s.id} className="mt-3 rounded border p-3 text-sm"><div className="flex justify-between"><strong>{s.name} v{s.version}</strong><span>{s.status}</span></div><p className="my-2 text-gray-600">{s.opening}</p><div className="flex gap-2">{['draft', 'review'].includes(s.status) && <button onClick={() => act({ action: 'approve_script', scriptId: s.id })} className="rounded bg-green-700 px-3 py-1 text-white">Approve</button>}{['approved', 'active'].includes(s.status) && <button onClick={() => act({ action: 'queue_call', scriptId: s.id, agentId: s.agent_id, phone, consentBasis: 'Explicit request for follow-up', dncChecked: true, scheduledAt: new Date(Date.now() + 3600000).toISOString() })} className="rounded bg-red-700 px-3 py-1 text-white">Schedule consented test +1h</button>}</div></div>)}</section>
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Outbound calls</h2>{d.calls.filter((c: R) => c.direction === 'outbound').map((c: R) => <div key={c.id} className="mt-2 rounded border p-2 text-xs"><strong>{c.status}</strong> · {c.phone_e164 || 'unknown'}{c.lead_name && <span> · lead: {c.lead_name}</span>}{c.blocker && <div className="text-amber-700">{c.blocker}</div>}</div>)}{!d.calls.filter((c: R) => c.direction === 'outbound').length && <p className="mt-2 text-sm text-gray-400">No outbound calls.</p>}</div>
            <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Inbound calls {d.calls.some((c: R) => c.direction === 'inbound' && c.disposition === 'simulated_test') && <span className="ml-1 text-xs font-normal text-gray-400">(simulated where marked)</span>}</h2>{d.calls.filter((c: R) => c.direction === 'inbound').map((c: R) => <div key={c.id} className="mt-2 rounded border p-2 text-xs"><strong>{c.status}</strong>{c.disposition === 'simulated_test' && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-700">simulated</span>} · {c.customer_ref || 'unknown caller'}</div>)}{!d.calls.filter((c: R) => c.direction === 'inbound').length && <p className="mt-2 text-sm text-gray-400">No inbound calls — none placed yet, none simulated yet.</p>}</div>
            <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Provider/event log</h2>{d.events.map((e: R) => <div key={e.id} className="mt-2 text-xs">{new Date(e.occurred_at).toLocaleString()} · {e.event_name}</div>)}{!d.events.length && <p className="mt-2 text-sm text-gray-400">No call events.</p>}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
