'use client';
// Experiments (A/B Testing) — the real replacement for the fake on/off
// `*.ab_testing` FeatureFlag entries (banner/coupon/pricing/ecommerce/
// referral/survey/carousel/analytics/ads), which had no variant assignment
// or lift measurement and only referenced GrowthBook as a hoped-for backend.
// Implements the mandatory Operational Portal Page & Tab Standard, same
// 8-tab shell as src/app/admin/ai-ingestion/local-folder/page.tsx.

import { FormEvent, useCallback, useEffect, useState } from 'react';

type R = Record<string, any>;

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard', report: 'Report', manual: 'Manual Process', automatic: 'Automatic Process',
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
  const colors: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', running: 'bg-emerald-100 text-emerald-700', completed: 'bg-blue-100 text-blue-700', stopped: 'bg-amber-100 text-amber-700' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

export default function ExperimentsPage() {
  const [data, setData] = useState<{ experiments: R[]; eventTypes: string[] }>({ experiments: [], eventTypes: [] });
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ key: '', name: '', hypothesis: '', targetEventType: 'booking_completed' });

  const load = useCallback(() => fetch('/api/experiments', { cache: 'no-store' }).then(r => r.ok ? r.json() : { experiments: [], eventTypes: [] }).then(setData), []);
  useEffect(() => { void load() }, [load]);

  async function act(body: R) {
    const r = await fetch('/api/experiments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    setMsg(r.ok ? 'Saved' : j.error);
    await load();
    return j;
  }
  async function createExperiment(e: FormEvent) {
    e.preventDefault();
    await act({ action: 'create_experiment', ...form });
    setForm({ key: '', name: '', hypothesis: '', targetEventType: 'booking_completed' });
  }
  async function addVariant(experimentId: string, isControl: boolean) {
    const key = prompt('Variant key (e.g. control, variant_a):');
    if (!key) return;
    const name = prompt('Variant display name:') || key;
    const pct = Number(prompt('Allocation percent (e.g. 50):') || '0');
    if (!pct) return;
    await act({ action: 'add_variant', experimentId, key, name, allocationPercent: pct, isControl });
  }

  const running = data.experiments.filter(e => e.status === 'running');
  const draft = data.experiments.filter(e => e.status === 'draft');
  const significant = data.experiments.flatMap(e => e.variants.filter((v: R) => v.vsControl?.significant));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Experiments (A/B Testing)</h1>
        <p className="text-sm text-gray-500">Real deterministic variant assignment, sticky per subject, with conversion rates and significance computed live from real tracking_event rows — never a fabricated lift number.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="rounded border bg-blue-50 p-2 text-sm">{msg}</p>}

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="Running experiments"><span className="text-2xl font-bold text-emerald-600">{running.length}</span></Card>
          <Card title="Draft experiments">{draft.length}</Card>
          <Card title="Total experiments">{data.experiments.length}</Card>
          <Card title="Statistically significant results">{significant.length}</Card>
        </div>
      )}

      {tab === 'report' && (
        <Card title="Report — Experiment Results">
          <div className="space-y-3 text-sm text-gray-800">
            {data.experiments.length === 0 && <p className="text-gray-400">No experiments created yet.</p>}
            {data.experiments.map(e => (
              <div key={e.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center gap-2 font-medium">{e.name} <StatusBadge status={e.status} /></div>
                {e.hypothesis && <p className="text-xs text-gray-500">Hypothesis: {e.hypothesis}</p>}
                <ul className="mt-1 list-disc pl-5">
                  {e.variants.map((v: R) => (
                    <li key={v.variantId}>
                      {v.name}{v.isControl && ' (control)'}: {v.sampleSize} assigned, {v.conversions} converted{v.conversionRate !== null && ` (${(v.conversionRate * 100).toFixed(1)}%)`}
                      {v.vsControl?.insufficientSample && <span className="text-gray-400"> — insufficient sample for significance (need 30+ per variant)</span>}
                      {v.vsControl?.pValue !== undefined && <span className={v.vsControl.significant ? 'font-semibold text-emerald-700' : 'text-gray-500'}> — {v.vsControl.significant ? 'significant' : 'not significant'} vs control (p={v.vsControl.pValue.toFixed(3)}{v.vsControl.liftPercent !== null && `, lift ${v.vsControl.liftPercent.toFixed(1)}%`})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Goal"><p className="text-sm text-gray-800">Every experiment is designed (hypothesis, target metric, variants) and started by a human before any real visitor is bucketed.</p></Card>
            <Card title="Objective"><p className="text-sm text-gray-800">Zero experiments started with variant allocations that don't sum to exactly 100%, and zero experiments without a marked control.</p></Card>
          </div>
          <Card title="To-do list">
            <ul className="space-y-1.5 text-sm">
              {draft.length === 0 ? <li className="flex items-center gap-2"><input type="checkbox" checked disabled /> <span className="text-gray-400 line-through">No draft experiments awaiting setup</span></li>
                : draft.map(e => <li key={e.id} className="flex items-center gap-2"><input type="checkbox" checked={false} disabled /> <span>Finish setup and start: {e.name} ({e.allocationTotal}% allocated)</span></li>)}
            </ul>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="Input"><p className="text-sm text-gray-800">A name, hypothesis, target conversion event (from the real tracking_event enum), and 2+ variants with allocation percentages.</p></Card>
            <Card title="Process"><p className="text-sm text-gray-800">Create (draft) → add variants until they sum to 100%, one marked control → Start (locks allocations, begins bucketing real visitors via /api/experiments/[key]/assign) → Stop when done.</p></Card>
            <Card title="Output"><p className="text-sm text-gray-800">{running.length} running, {data.experiments.filter(e => e.status === 'completed').length} completed.</p></Card>
          </div>
          <Card title="Visualization">
            <pre className="overflow-x-auto text-xs text-gray-700">{JSON.stringify(data.experiments.map(e => ({ name: e.name, status: e.status, variants: e.variants.map((v: R) => ({ key: v.key, sampleSize: v.sampleSize, conversionRate: v.conversionRate })) })), null, 2)}</pre>
          </Card>
          <Card title="Checklist">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><input type="checkbox" checked={data.experiments.every(e => e.allocationTotal === 100 || e.status === 'draft')} disabled /> No running experiment with misconfigured allocation</li>
              <li className="flex items-center gap-2"><input type="checkbox" checked={draft.length === 0} disabled /> No experiment stuck in draft</li>
            </ul>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Inclusion boundary"><p className="text-sm text-gray-800">Covers: experiment/variant CRUD, deterministic sticky bucketing, live conversion joins against real tracking_event rows, real two-proportion z-test significance.</p></Card>
            <Card title="Exclusion boundary"><p className="text-sm text-gray-800">Does not cover: multivariate (more than one factor) testing, sequential/Bayesian stopping rules, or automatic winner rollout — a human reads the Report tab and decides.</p></Card>
          </div>
          <Card title="Task list">
            <ul className="space-y-1.5 text-sm">{draft.map(e => <li key={e.id} className="flex items-center justify-between"><span>{e.name}</span><span className="text-xs text-gray-400">{e.allocationTotal}% allocated</span></li>)}{!draft.length && <li className="text-gray-400">No open tasks.</li>}</ul>
          </Card>
          <Card title="Final outcome report"><p className="text-sm text-gray-800">{significant.length > 0 ? `${significant.length} variant(s) show a statistically significant result — see Report tab.` : 'No statistically significant results yet (either no running experiments have enough sample, or no real difference detected).'}</p></Card>
          <Card title="Status (Completed / Pending / Running)"><div className="flex gap-2">{data.experiments.map(e => <StatusBadge key={e.id} status={e.status} />)}</div></Card>
        </div>
      )}

      {tab === 'automatic' && (
        <Card title="Automatic Process">
          <p className="text-sm text-gray-800">This module has no scheduled job, honestly — there is nothing for a cron tick to do. Variant assignment happens synchronously the first time a subject calls <code>/api/experiments/[key]/assign</code>, and conversion stats are computed live on every Dashboard/Report view by joining against real tracking_event rows. Nothing here runs on a timer or needs one.</p>
        </Card>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['explainability', 'experiment', 'experience'] as const).map(s => <button key={s} onClick={() => setAiExpSub(s)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>{s}</button>)}</div>
          {aiExpSub === 'explainability' && <Card title="Explainability"><p className="text-sm text-gray-800">No ML model is involved. Variant assignment is a SHA-256 hash of (experiment key, subject id) mod 100 mapped into cumulative allocation ranges — fully deterministic and auditable by re-running the same hash. Significance is a standard two-proportion z-test, a well-known closed-form statistic, not a model prediction.</p></Card>}
          {aiExpSub === 'experiment' && <Card title="Experiment"><p className="text-sm text-gray-800">This module itself is the replacement for the previously fake `*.ab_testing` feature flags — no model/prompt versions to track, since none are used.</p></Card>}
          {aiExpSub === 'experience' && <Card title="Experience"><p className="text-sm text-gray-800">Plain-language: create an experiment, define what "success" means (a real event like a completed booking), split traffic between two or more versions, and this page tells you honestly whether one version is really doing better — including saying "not enough data yet" instead of guessing.</p></Card>}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> none — deterministic hashing and closed-form statistics only.</p>
            <p><strong>Approval status:</strong> not applicable — a human explicitly clicks Start, and allocations are locked (immutable once running) to prevent silent mid-experiment changes.</p>
            <p><strong>Policy compliance:</strong> replaces flags that referenced GrowthBook/PostHog as an undelivered promise; this module has zero external dependency.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes:</strong> the significance test assumes independent observations and a binary conversion outcome — it will mislead if reused for a non-binary metric (e.g. revenue) without modification, which is out of scope today.</p>
            <p><strong>Bias/hallucination risk:</strong> none — no generative model in the loop.</p>
            <p><strong>Mitigations:</strong> the API refuses to report a p-value below 30 samples per variant (returns "insufficient sample" instead), and refuses to start an experiment whose allocations don't sum to exactly 100%.</p>
            <p><strong>Current risk level:</strong> {data.experiments.length === 0 ? 'None — no experiments exist yet.' : 'Low — all guardrails are server-enforced, not just UI-enforced.'}</p>
          </div>
        </Card>
      )}

      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">{(['research-ai', 'responsible-ai'] as const).map(s => <button key={s} onClick={() => setResAiSub(s)} className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>{s === 'research-ai' ? 'Research AI' : 'Responsible AI'}</button>)}</div>
          {resAiSub === 'research-ai' && <Card title="Research AI"><p className="text-sm text-gray-800">No research agent runs for this module. A natural extension: an Ollama-backed summarizer that reads a completed experiment's results and drafts a plain-English recommendation — not yet built, listed honestly rather than implied here.</p></Card>}
          {resAiSub === 'responsible-ai' && <Card title="Responsible AI"><div className="space-y-2 text-sm text-gray-800"><p><strong>Data provenance:</strong> conversion counts come only from this app's own real tracking_event table — no external data.</p><p><strong>Consent/privacy:</strong> subject_id is the same anonymous_id/user_id tracking_event already uses under its existing consent_level handling; no new PII is collected by this module.</p><p><strong>Bias checks:</strong> deterministic hash bucketing has no demographic input, so it cannot systematically favor any group by construction.</p></div></Card>}
        </div>
      )}

      <div className="border-t pt-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Module workspace</h2>
        <form onSubmit={createExperiment} className="space-y-2 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Create experiment</h2>
          <label className="block text-sm">Key (URL-safe, used by /api/experiments/[key]/assign)<input required className="mt-1 w-full rounded border p-2" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} /></label>
          <label className="block text-sm">Name<input required className="mt-1 w-full rounded border p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm">Hypothesis<textarea className="mt-1 w-full rounded border p-2" value={form.hypothesis} onChange={e => setForm({ ...form, hypothesis: e.target.value })} /></label>
          <label className="block text-sm">Target conversion event
            <select className="mt-1 w-full rounded border p-2" value={form.targetEventType} onChange={e => setForm({ ...form, targetEventType: e.target.value })}>
              {data.eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button className="rounded bg-indigo-600 px-4 py-2 text-white">Create draft experiment</button>
        </form>

        <div className="mt-5 space-y-3">
          {data.experiments.map(e => (
            <div key={e.id} className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div><strong>{e.name}</strong> <span className="ml-2 text-xs text-gray-400">key: {e.key} · target: {e.targetEventType}</span></div>
                <StatusBadge status={e.status} />
              </div>
              {e.hypothesis && <p className="mt-1 text-sm text-gray-600">{e.hypothesis}</p>}
              <div className="mt-3 space-y-1">
                {e.variants.map((v: R) => (
                  <div key={v.variantId} className="flex items-center justify-between rounded border p-2 text-sm">
                    <span>{v.name}{v.isControl && <span className="ml-1 text-xs text-gray-400">(control)</span>} — {v.allocationPercent}%</span>
                    <span className="text-xs text-gray-500">{v.sampleSize} assigned · {v.conversions} converted{v.conversionRate !== null && ` (${(v.conversionRate * 100).toFixed(1)}%)`}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.status === 'draft' && <>
                  <button onClick={() => addVariant(e.id, e.variants.length === 0)} className="rounded bg-gray-800 px-3 py-1 text-xs text-white">Add variant ({e.allocationTotal}%/100%)</button>
                  <button onClick={() => act({ action: 'start_experiment', experimentId: e.id })} className="rounded bg-emerald-700 px-3 py-1 text-xs text-white">Start</button>
                </>}
                {e.status === 'running' && <button onClick={() => act({ action: 'stop_experiment', experimentId: e.id })} className="rounded bg-amber-700 px-3 py-1 text-xs text-white">Stop</button>}
              </div>
            </div>
          ))}
          {!data.experiments.length && <p className="text-sm text-gray-400">No experiments yet.</p>}
        </div>
      </div>
    </div>
  );
}
