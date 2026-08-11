'use client';
// /admin/ai-governance — eleven AI governance audit dimensions (Responsible,
// Explainable, Accountable, Fairness, Ethical, Risk, Governance,
// Interpretable, Decision, Performance, Outlier), each grounded in either a
// live query over real tables or a source-cited transcription of a real
// guardrail already implemented in src/cron/jobs/*.ts. See the docstring in
// src/app/api/admin/ai-governance/route.ts for exactly what backs each
// section and its known real limitations — nothing here is decorative.

import { useEffect, useState } from 'react';

interface Governance {
  governance: { models: Array<{ provider: string; model_name: string; capability_codes: string[]; enabled: boolean; local_model: boolean }>; totalModels: number; totalEnabled: number };
  accountable: { tracedRuns: Array<{ operation_name: string; status: string; actor_type: string; actor_id: string; duration_ms: number | null; created_at: string }>; totalTraced: number; note: string };
  explainable: { churnSamples: Array<{ student_id: string; risk_score: number; risk_level: string; top_reason: string; suggested_action: string }>; voiceOfCustomerSample: { overall_summary: string; source_message_count: number } | null; note: string };
  interpretable: { modelTierByJob: Record<string, string>; note: string };
  decision: Array<{ job: string; autonomy: string; evidence: string; file: string }>;
  performance: { totalTraced: number; avgDurationMs: number | null };
  risk: { totalTraced: number; failed: number; failureRatePct: number };
  outlier: { highRiskChurn: Array<{ student_id: string; risk_score: number; top_reason: string }>; criticalCampaignFindings: Array<{ campaign_name: string; finding_key: string; summary: string }> };
  fairness: Array<{ job: string; inputFields: string[]; usesProtectedAttributes: boolean; note: string }>;
  ethical: Array<{ job: string; guardrail: string; file: string }>;
  responsible: { totalJobs: number; ollamaJobs: number; draftGatedJobs: number; advisoryJobs: number; modelsRegistered: number; modelsEnabled: number };
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const NAV = [
  ['responsible', 'Responsible AI'], ['explainable', 'Explainable AI'], ['accountable', 'Accountable AI'],
  ['fairness', 'Fairness AI'], ['ethical', 'Ethical AI'], ['risk', 'Risk AI'], ['governance', 'Governance AI'],
  ['interpretable', 'Interpretable AI'], ['decision', 'Decision AI'], ['performance', 'Performance AI'], ['outlier', 'Outlier AI'],
] as const;

export default function AiGovernancePage() {
  const [data, setData] = useState<Governance | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/ai-governance', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="m-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">AI Governance</h1>
        <p className="text-sm text-gray-500">
          Eleven audit dimensions over this platform's real Ollama-driven jobs — every panel below is either a live query
          or a cited quote from the actual job source. Nothing here is a mock-up.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-primary-100 hover:text-primary-700">
            {label}
          </a>
        ))}
      </nav>

      <Section id="responsible" title="Responsible AI" subtitle="Composite overview: how much of this platform's AI output requires human review before it reaches anyone.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total jobs" value={data.responsible.totalJobs} />
          <Stat label="Ollama-driven" value={data.responsible.ollamaJobs} />
          <Stat label="Draft-gated" value={data.responsible.draftGatedJobs} />
          <Stat label="Advisory-only" value={data.responsible.advisoryJobs} />
          <Stat label="Models registered" value={data.responsible.modelsRegistered} />
          <Stat label="Models enabled" value={data.responsible.modelsEnabled} />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {data.responsible.draftGatedJobs} of {data.responsible.ollamaJobs} Ollama jobs write draft-only output requiring
          explicit staff approval before anything reaches a customer; the remaining {data.responsible.advisoryJobs} are
          informational/advisory and never take an autonomous action.
        </p>
      </Section>

      <Section id="explainable" title="Explainable AI" subtitle="Every prediction ships with its own model-generated rationale — not just a bare score.">
        <p className="text-xs text-gray-500">{data.explainable.note}</p>
        {data.explainable.voiceOfCustomerSample && (
          <div className="mt-3 rounded border p-3 text-sm">
            <b>Voice of Customer</b> ({data.explainable.voiceOfCustomerSample.source_message_count} real messages): {data.explainable.voiceOfCustomerSample.overall_summary}
          </div>
        )}
        {data.explainable.churnSamples.map(c => (
          <div key={c.student_id} className="mt-2 rounded border p-3 text-sm">
            <b>Churn ({c.risk_level}, score {c.risk_score})</b>: {c.top_reason} → <i>{c.suggested_action}</i>
          </div>
        ))}
        {data.explainable.churnSamples.length === 0 && !data.explainable.voiceOfCustomerSample && (
          <p className="text-xs text-gray-500">No predictions yet — run "churn-prediction" or "voice-of-customer" from the Use Case Catalog.</p>
        )}
      </Section>

      <Section id="accountable" title="Accountable AI" subtitle="Every traced AI execution is attributed to a specific actor, timestamp and outcome — not an anonymous black box.">
        <p className="text-xs text-gray-500">{data.accountable.note}</p>
        {data.accountable.tracedRuns.length > 0 && (
          <table className="mt-3 w-full text-xs">
            <thead><tr className="bg-gray-50 text-left"><th className="p-1.5">Job</th><th>Status</th><th>Actor</th><th>Duration</th><th>When</th></tr></thead>
            <tbody>
              {data.accountable.tracedRuns.map((r, i) => (
                <tr key={i} className="border-t"><td className="p-1.5 font-mono">{r.operation_name}</td><td>{r.status}</td><td>{r.actor_id}</td><td>{r.duration_ms ?? '—'}ms</td><td>{new Date(r.created_at).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="fairness" title="Fairness AI" subtitle="Input-field audit: does any predictive job read a protected/demographic attribute?">
        <div className="grid gap-3 md:grid-cols-2">
          {data.fairness.map(f => (
            <div key={f.job} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <b className="font-mono text-xs">{f.job}</b>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${f.usesProtectedAttributes ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {f.usesProtectedAttributes ? 'Uses protected attribute' : 'No protected attribute'}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Inputs: {f.inputFields.join(', ')}</p>
              <p className="mt-1 text-xs text-gray-600">{f.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="ethical" title="Ethical AI" subtitle="Guardrails actually implemented in code, quoted from source.">
        <div className="space-y-2">
          {data.ethical.map(e => (
            <div key={e.job} className="rounded border p-3 text-sm">
              <b className="font-mono text-xs">{e.job}</b> — {e.guardrail}
              <div className="mt-1 text-xs text-gray-400">{e.file}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="risk" title="Risk AI" subtitle="Failure rate of traced AI executions — how often the pipeline fails, and how (advisory failure = missed insight, never a wrong action).">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Traced runs" value={data.risk.totalTraced} />
          <Stat label="Failed" value={data.risk.failed} />
          <Stat label="Failure rate" value={`${data.risk.failureRatePct}%`} />
        </div>
      </Section>

      <Section id="governance" title="Governance AI" subtitle="The real model registry — which models are approved for use, and which are actually enabled.">
        <div className="grid gap-3 sm:grid-cols-3 mb-3">
          <Stat label="Models registered" value={data.governance.totalModels} />
          <Stat label="Enabled" value={data.governance.totalEnabled} />
          <Stat label="Local (Ollama)" value={data.governance.models.filter(m => m.local_model).length} />
        </div>
        <div className="max-h-64 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50"><tr><th className="p-1.5 text-left">Model</th><th className="text-left">Provider</th><th className="text-left">Capabilities</th><th>Enabled</th></tr></thead>
            <tbody>
              {data.governance.models.map(m => (
                <tr key={`${m.provider}.${m.model_name}`} className="border-t">
                  <td className="p-1.5 font-mono">{m.model_name}</td><td>{m.provider}</td>
                  <td>{m.capability_codes.join(', ')}</td><td className="text-center">{m.enabled ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="interpretable" title="Interpretable AI" subtitle="Every decision is traceable to a specific, named model tier — never an opaque, dynamically-chosen model.">
        <p className="text-xs text-gray-500">{data.interpretable.note}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {Object.entries(data.interpretable.modelTierByJob).map(([job, tier]) => (
            <div key={job} className="rounded border p-2 text-xs"><span className="font-mono">{job}</span> → <b>{tier}</b></div>
          ))}
        </div>
      </Section>

      <Section id="decision" title="Decision AI" subtitle="Every AI-driven job classified by decision autonomy, cited to its own source comment.">
        <div className="space-y-2">
          {data.decision.map(d => (
            <div key={d.job} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <b className="font-mono text-xs">{d.job}</b>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  d.autonomy === 'deterministic-auto-apply' ? 'bg-blue-100 text-blue-800'
                  : d.autonomy === 'draft-requires-approval' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                }`}>{d.autonomy}</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{d.evidence}</p>
              <div className="mt-1 text-xs text-gray-400">{d.file}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="performance" title="Performance AI" subtitle="Duration of traced AI executions.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Traced runs" value={data.performance.totalTraced} />
          <Stat label="Avg duration" value={data.performance.avgDurationMs ? `${data.performance.avgDurationMs}ms` : '—'} />
        </div>
      </Section>

      <Section id="outlier" title="Outlier AI" subtitle="Statistical outliers the system itself flags for a human double-check.">
        <h3 className="text-sm font-semibold">High-risk churn predictions (score ≥ 80)</h3>
        {data.outlier.highRiskChurn.map(c => (
          <div key={c.student_id} className="mt-1 rounded border p-2 text-xs">Score {c.risk_score}: {c.top_reason}</div>
        ))}
        {data.outlier.highRiskChurn.length === 0 && <p className="text-xs text-gray-500">None currently.</p>}
        <h3 className="mt-3 text-sm font-semibold">Critical campaign health findings</h3>
        {data.outlier.criticalCampaignFindings.map((f, i) => (
          <div key={i} className="mt-1 rounded border p-2 text-xs"><b>{f.campaign_name}</b> ({f.finding_key}): {f.summary}</div>
        ))}
        {data.outlier.criticalCampaignFindings.length === 0 && <p className="text-xs text-gray-500">None currently.</p>}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
