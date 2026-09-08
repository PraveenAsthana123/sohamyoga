'use client';
// Per-platform provisioning page: 8 tabs (Dashboard / Report / Manual /
// Automatic / AI Exp / AI Governance / AI Risk / ResAI), per the mandatory
// Operational Portal Page & Tab Standard, plus a persistent left nav listing
// all registered platforms. Every tab is wired to this platform's REAL rows
// only -- Dashboard/Report/Risk/Governance content is derived directly from
// social_platform_requirement, account_provisioning_job, provisioning_human_task
// and social_provisioning_event. No AI model makes decisions anywhere in this
// flow (Skyvern is guarded browser navigation, not a decisioning agent), so
// the AI Exp tab says that plainly instead of inventing an experiment.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Requirement {
  platform: string; priority: string | null; business_use: string | null; content_strength: string | null;
  automation_level: string | null; manual_prerequisite: string | null; signup_url: string | null;
  developer_portal_url: string | null; oauth_supported: boolean; api_supported: boolean; publishing_supported: boolean;
  requires_business_page: boolean; requires_phone: boolean; requires_captcha: boolean; requires_otp: boolean;
  requires_2fa: boolean; requires_identity_verification: boolean; requires_business_verification: boolean;
  developer_creation_mode: string; automation_policy: string;
}
interface Job { id: string; account_name: string; state: string; current_step: string | null; created_at: string; updated_at: string; completed_at: string | null; error_message: string | null }
interface Task { id: string; task_type: string; instructions: string; status: string; created_at: string; completed_at: string | null }
interface Event { id: string; action: string; before_state: string | null; after_state: string | null; result: string; created_at: string }
interface BrowserRun { id: string; status: string; start_url: string; app_url: string | null; started_at: string; finished_at: string | null }
interface PlatformDetail { requirement: Requirement; jobs: Job[]; tasks: Task[]; events: Event[]; browserRuns: BrowserRun[] }

const TABS = ['Dashboard', 'Report', 'Manual Process', 'Automatic Process', 'AI Exp', 'AI Governance', 'AI Risk', 'ResAI'] as const;
type Tab = typeof TABS[number];

export default function PlatformProvisioningPage() {
  const params = useParams<{ platform: string }>();
  const platform = params.platform;
  const [allPlatforms, setAllPlatforms] = useState<{ platform: string; priority: string | null }[]>([]);
  const [detail, setDetail] = useState<PlatformDetail | null>(null);
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/social/provisioning', { cache: 'no-store' }).then(r => r.json()).then(d =>
      setAllPlatforms((d.requirements ?? []).map((r: Requirement) => ({ platform: r.platform, priority: r.priority }))));
    fetch(`/api/admin/social/provisioning/platform/${platform}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setDetail(d); })
      .catch(e => setError(e.message));
  }, [platform]);
  useEffect(() => { load() }, [load]);

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!detail) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const { requirement: r, jobs, tasks, events, browserRuns } = detail;
  const job = jobs[0];
  const openTasks = tasks.filter(t => t.status === 'open');
  const label = platform.replaceAll('_', ' ');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-3">
        <Link href="/admin/social/provisioning" className="mb-3 block text-xs text-indigo-700 hover:underline">← All platforms</Link>
        <div className="space-y-0.5">
          {allPlatforms.map(p => (
            <Link key={p.platform} href={`/admin/social/provisioning/${p.platform}`}
              className={`block rounded px-2 py-1 text-sm capitalize ${p.platform === platform ? 'bg-indigo-100 font-medium text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p.platform.replaceAll('_', ' ')}
            </Link>
          ))}
        </div>
      </aside>

      <div className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-xl font-bold capitalize text-gray-800">{label}</h1>
          <p className="text-sm text-gray-500">{r.business_use ?? 'No business-use note recorded.'}</p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-t px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-800' : 'text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Dashboard' && (
          <div className="space-y-3">
          {job?.current_step && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
              <span className="font-medium">Next step: </span>{job.current_step}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Job state" value={job?.state ?? 'not started'} />
            <Stat label="Open tasks" value={String(openTasks.length)} />
            <Stat label="Priority tier" value={r.priority ?? '—'} />
            <Stat label="Creation mode" value={r.developer_creation_mode} />
            <Stat label="OAuth supported" value={r.oauth_supported ? 'Yes' : 'No'} />
            <Stat label="Publishing supported" value={r.publishing_supported ? 'Yes' : 'No'} />
            <Stat label="Days since job created" value={job ? String(Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000)) : '—'} />
            <Stat label="Browser runs" value={String(browserRuns.length)} />
          </div>
          </div>
        )}

        {tab === 'Report' && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-600">Real event timeline ({events.length})</h2>
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded border border-gray-200 bg-white p-2 text-sm">
                <span>{e.action}{e.before_state ? ` · ${e.before_state} → ${e.after_state}` : ''}</span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
            {!events.length && <p className="text-sm text-gray-400">No events recorded yet.</p>}
          </div>
        )}

        {tab === 'Manual Process' && (
          <div className="space-y-4">
            <Field label="Goal / Objective" value={r.business_use} />
            <Field label="Input needed (manual prerequisite)" value={r.manual_prerequisite} />
            <Field label="Process (automation policy)" value={r.automation_policy} />
            <Field label="Signup URL" value={r.signup_url} link />
            <Field label="Developer portal URL" value={r.developer_portal_url} link />
            <div>
              <h3 className="text-sm font-semibold text-gray-600">Checklist (open human tasks)</h3>
              <div className="mt-2 space-y-2">
                {openTasks.map(t => (
                  <div key={t.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-sm">
                    <span className="font-medium">{t.task_type}</span> — {t.instructions}
                  </div>
                ))}
                {!openTasks.length && <p className="text-sm text-gray-400">No open tasks — either not started, or all complete.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'Automatic Process' && (
          <div className="space-y-3">
            <Field label="Creation mode" value={r.developer_creation_mode} />
            {r.developer_creation_mode === 'OFFICIAL_API' ? (
              <p className="text-sm text-gray-600">This platform exposes a first-class official API for account/bot setup (e.g. BotFather for Telegram, api.slack.com for Slack). A human still creates the bot/app and grants access — automation here means the resulting integration can operate unattended afterward, not that account creation itself is automated.</p>
            ) : r.developer_creation_mode === 'ASSISTED_BROWSER' ? (
              <p className="text-sm text-gray-600">Guided browser navigation is available via Skyvern for this platform, with a hard-coded stop at every CAPTCHA, OTP, 2FA, identity, and business-verification checkpoint.</p>
            ) : (
              <p className="text-sm text-gray-600">No automated path exists for this platform's account creation — it is honestly MANUAL. This is not a gap to hide; some platforms categorically require a human throughout.</p>
            )}
            {browserRuns.length > 0 ? (
              <div className="space-y-1">
                {browserRuns.map(b => (
                  <div key={b.id} className="rounded border border-gray-200 bg-white p-2 text-xs">{b.status} · started {new Date(b.started_at).toLocaleString()}</div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No Skyvern browser runs have been started for this platform.</p>}
          </div>
        )}

        {tab === 'AI Exp' && (
          <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <p>No AI model makes provisioning decisions anywhere in this flow. Skyvern (where used) performs guarded browser navigation only and is instructed to stop at every security/consent checkpoint — it does not decide, personalize, or interpret; it executes a fixed, human-approved script and yields control back at each real checkpoint. There is no experiment to report because nothing here is a model making judgment calls.</p>
          </div>
        )}

        {tab === 'AI Governance' && (
          <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p className="font-medium">Automation policy for {label}:</p>
            <p className="mt-1">{r.automation_policy}</p>
          </div>
        )}

        {tab === 'AI Risk' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <RiskFlag label="CAPTCHA required" active={r.requires_captcha} />
            <RiskFlag label="Email/phone OTP required" active={r.requires_otp || r.requires_phone} />
            <RiskFlag label="2FA required" active={r.requires_2fa} />
            <RiskFlag label="Identity verification required" active={r.requires_identity_verification} />
            <RiskFlag label="Business verification required" active={r.requires_business_verification} />
            <RiskFlag label="Requires a business page first" active={r.requires_business_page} />
          </div>
        )}

        {tab === 'ResAI' && (
          <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <p>Source research: <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">docs/chatgpt-extracts/social-account-provisioning-platform.md</code> (repo file, not web-served) — the ChatGPT-sourced conversation this platform's roadmap entry traces back to, cross-checked against this codebase before anything was built.</p>
            <p className="mt-2 font-medium">Responsible AI note:</p>
            <p className="mt-1">{r.automation_policy}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize text-gray-800">{value}</div>
    </div>
  );
}
function Field({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      {value
        ? link ? <a className="text-sm text-indigo-700 underline" href={value} target="_blank" rel="noreferrer">{value}</a> : <p className="text-sm text-gray-700">{value}</p>
        : <p className="text-sm text-gray-400">Not recorded.</p>}
    </div>
  );
}
function RiskFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded border p-2 text-sm ${active ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-400'}`}>
      {active ? '⚠ ' : '— '}{label}
    </div>
  );
}
