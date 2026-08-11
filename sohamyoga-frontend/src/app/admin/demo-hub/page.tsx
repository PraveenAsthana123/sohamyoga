'use client';
// /admin/demo-hub — Single entry point for showcasing SohamYoga's real-time
// marketing automation end to end: fixed demo credentials, the full use-case
// catalog (26 real Ollama-driven cron jobs) with an on-demand "Run Now"
// trigger, and links out to the deeper existing operational tooling
// (module-assurance, quality-center, operations-history, schema-catalog,
// architecture-center) rather than duplicating what those already do.
//
// "Run Now" calls POST /api/admin/demo-hub/run-job, which executes the exact
// same job module the scheduled cron runner uses — not a simulation. Every
// run is recorded in operation_run and appears in /admin/operations-history.

import { useState } from 'react';
import Link from 'next/link';
import { CRON_JOBS, type CronJobDef } from '@/cron/CronRegistry';

const DEMO_CREDENTIALS = [
  { role: 'Admin (full platform control)', email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456', loginUrl: '/api/auth/login (POST) — see admin UI for the login form host' },
  { role: 'Customer (self-service portal)', email: 'customer_demo@sohamyoga.ca', password: 'CustomerDemo@123456', loginUrl: '/customer/login' },
];

const RELATED_TOOLS = [
  { title: 'Use Case & Test Matrix', href: '/admin/quality-center', description: 'Actor/route/objective user stories with live positive/negative Playwright status.' },
  { title: 'Module Assurance', href: '/admin/module-assurance', description: 'Feature, integration, model and test-failure matrix, grouped by sales/customer/admin stakeholder.' },
  { title: 'Operations History', href: '/admin/operations-history', description: 'Every scheduled and manual job run, error, circuit breaker and model call.' },
  { title: 'DB Schema Explorer', href: '/admin/schema-catalog', description: 'Live tables, columns, primary keys, foreign-key references and views.' },
  { title: 'Architecture & Process Centre', href: '/admin/architecture-center', description: 'C4 views, process-step training, and an honest platform gap assessment.' },
  { title: 'Operations Centre', href: '/admin/operations-center', description: 'Direct links into every marketing workflow surface (social, campaigns, banners, video, blog, CRM).' },
];

// A handful of the highest-value flows get an explicit sequence diagram —
// not all 26 jobs, to keep this readable; the rest are covered by the table
// below plus the linked Use Case & Test Matrix.
const FLOWS: Array<{ key: string; title: string; steps: Array<{ from: string; to: string; action: string }> }> = [
  {
    key: 'voice-of-customer',
    title: 'Voice of Customer (weekly digest)',
    steps: [
      { from: 'Cron scheduler', to: 'VoiceOfCustomerJob', action: 'fires Friday 10:00 UTC' },
      { from: 'VoiceOfCustomerJob', to: 'Postgres', action: 'reads campaign_lead.message + sentiment_log (last 7 days)' },
      { from: 'VoiceOfCustomerJob', to: 'Ollama (strong tier)', action: 'clusters real text into themes/complaints/requests' },
      { from: 'VoiceOfCustomerJob', to: 'Postgres', action: 'writes voice_of_customer_digest' },
      { from: 'Admin', to: '/admin/crm (Voice of Customer tab)', action: 'reviews the digest' },
    ],
  },
  {
    key: 'churn-prediction',
    title: 'Churn Prediction (weekly)',
    steps: [
      { from: 'Cron scheduler', to: 'ChurnPredictionJob', action: 'fires Monday 07:00 UTC' },
      { from: 'ChurnPredictionJob', to: 'Postgres', action: 'reads attendance_record + streak + active membership rows' },
      { from: 'ChurnPredictionJob', to: 'Ollama', action: 'scores churn risk with a real rationale' },
      { from: 'ChurnPredictionJob', to: 'notification_queue', action: 'queues a staff alert for flagged members' },
      { from: 'NotificationDispatchJob', to: 'Email/SMS/push', action: 'sends the queued alert within 5 minutes' },
    ],
  },
  {
    key: 'catalog-tracking',
    title: 'Customer click tracking → consent-gated analytics',
    steps: [
      { from: 'Customer', to: 'ConsentBanner', action: 'grants analytics consent (POST /api/analytics/consent)' },
      { from: 'Customer', to: 'TrackedLink / ViewTracker', action: 'clicks a CTA or views a service/industry page' },
      { from: 'AnalyticsProvider', to: '/api/analytics/events', action: 'sends the event with the current consent level' },
      { from: '/api/analytics/events', to: 'Postgres', action: 'writes tracking_event with consent_level + properties' },
      { from: 'Admin', to: '/admin/analytics', action: 'reviews real funnel/click data' },
    ],
  },
  {
    key: 'abandoned-cart',
    title: 'Abandoned Cart Recovery',
    steps: [
      { from: 'Cron scheduler', to: 'AbandonedCartRecoveryJob', action: 'fires every 30 minutes' },
      { from: 'AbandonedCartRecoveryJob', to: 'Postgres', action: 'finds carts stalled 2+ hours with real line items' },
      { from: 'AbandonedCartRecoveryJob', to: 'Ollama', action: 'drafts a recovery message grounded in the actual cart' },
      { from: 'AbandonedCartRecoveryJob', to: 'notification_queue (draft, unsent)', action: 'queues for staff review — never auto-sent' },
      { from: 'Staff', to: '/admin/notifications', action: 'reviews and sends manually' },
    ],
  },
];

function FlowDiagram({ steps }: { steps: Array<{ from: string; to: string; action: string }> }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{i + 1}</span>
          <span>
            <span className="font-semibold text-gray-900">{s.from}</span>
            <span className="mx-1.5 text-gray-400">→</span>
            <span className="font-semibold text-gray-900">{s.to}</span>
            <span className="ml-2 text-gray-600">{s.action}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function RunNowButton({ job }: { job: CronJobDef }) {
  const [state, setState] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle');
  const [detail, setDetail] = useState('');

  const run = async () => {
    setState('running');
    setDetail('');
    try {
      const res = await fetch('/api/admin/demo-hub/run-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: job.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      setState('succeeded');
      setDetail(`${data.durationMs}ms`);
    } catch (e) {
      setState('failed');
      setDetail(e instanceof Error ? e.message : 'Run failed');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === 'running'}
        className="rounded bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {state === 'running' ? 'Running…' : 'Run Now'}
      </button>
      {state === 'succeeded' && <span className="text-xs text-emerald-700">✓ {detail}</span>}
      {state === 'failed' && <span className="max-w-xs truncate text-xs text-red-700" title={detail}>✗ {detail}</span>}
    </div>
  );
}

export default function DemoHubPage() {
  const [tab, setTab] = useState<'catalog' | 'flows' | 'links'>('catalog');
  const ollamaJobs = CRON_JOBS.filter(j => j.description.toLowerCase().includes('ollama') || j.timeoutMs >= 60_000);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Demo Showcase Hub</h1>
        <p className="text-sm text-gray-500">
          End-to-end demo entry point: fixed credentials, the full use-case catalog, on-demand job execution and sequence
          flows for the marketing automation built into this platform.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {DEMO_CREDENTIALS.map(c => (
          <div key={c.email} className="rounded-xl border bg-white p-4">
            <div className="text-xs font-semibold uppercase text-gray-500">{c.role}</div>
            <div className="mt-2 space-y-1 font-mono text-sm">
              <div>Email: <span className="font-semibold">{c.email}</span></div>
              <div>Password: <span className="font-semibold">{c.password}</span></div>
            </div>
            <div className="mt-2 text-xs text-gray-400">{c.loginUrl}</div>
          </div>
        ))}
      </section>

      <nav className="flex gap-2 border-b">
        {(['catalog', 'flows', 'links'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}
          >
            {t === 'catalog' ? `Use Case Catalog (${CRON_JOBS.length})` : t === 'flows' ? 'Sequence Flows' : 'Related Tooling'}
          </button>
        ))}
      </nav>

      {tab === 'catalog' && (
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {['Use case', 'Schedule', 'Description', 'Ollama', 'Run Now'].map(h => (
                    <th key={h} className="p-2 text-left text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRON_JOBS.map(job => (
                  <tr key={job.name} className="border-t align-top">
                    <td className="p-2 font-mono text-xs font-semibold">{job.name}</td>
                    <td className="p-2 font-mono text-xs">{job.schedule}</td>
                    <td className="max-w-md p-2 text-xs text-gray-600">{job.description}</td>
                    <td className="p-2 text-xs">{ollamaJobs.includes(job) ? '✓' : ''}</td>
                    <td className="p-2"><RunNowButton job={job} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'flows' && (
        <section className="space-y-4">
          {FLOWS.map(flow => (
            <div key={flow.key} className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold">{flow.title}</h2>
              <FlowDiagram steps={flow.steps} />
            </div>
          ))}
        </section>
      )}

      {tab === 'links' && (
        <section className="grid gap-3 md:grid-cols-3">
          {RELATED_TOOLS.map(tool => (
            <Link key={tool.href} href={tool.href} className="rounded-xl border bg-white p-4 hover:border-primary-400">
              <div className="font-semibold">{tool.title}</div>
              <p className="mt-1 text-sm text-gray-600">{tool.description}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
