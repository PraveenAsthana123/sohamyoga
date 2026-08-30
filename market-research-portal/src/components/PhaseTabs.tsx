'use client';
// The shared 8-tab phase component — implements the Operational Portal
// Page & Tab Standard ONCE, data-driven from a phase_run (study mode) or
// the static phase row (reference mode). No per-phase bespoke tabs.

import { useState } from 'react';

export interface ChecklistTemplateItem { text: string }
export interface ChecklistTemplates { b2b: ChecklistTemplateItem[]; b2c: ChecklistTemplateItem[] }

export interface PhaseData {
  id: string;
  slug: string;
  name: string;
  layerNumber: number;
  processReference: string;
  inputReference: string;
  outputReference: string;
}

export interface PhaseRunData {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  statusHistory: Array<{ status: string; at: string }>;
  goal: string;
  objective: string;
  todoList: Array<{ text: string; done: boolean }>;
  inputContent: string;
  processContent: string;
  outputContent: string;
  visualizationData: Record<string, unknown>;
  checklist: Array<{ text: string; done: boolean }>;
  inclusionBoundary: string;
  exclusionBoundary: string;
  taskList: Array<{ text: string; assignee: string; status: string }>;
  finalOutcomeReport: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionEntry {
  id: number | string;
  event_type: string;
  description: string;
  occurred_at: string;
}

export interface AiLogEntry {
  id: number | string;
  purpose: string;
  model_name: string;
  prompt_chars: number;
  output_chars: number;
  status: string;
  fact_check_passed: boolean | null;
  created_at: string;
}

export interface JobRunSummary {
  id: string;
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  result_summary: string | null;
}

const TOP_TABS = ['dashboard', 'report', 'manual', 'automatic', 'ai-exp', 'ai-governance', 'ai-risk', 'resai'] as const;
type TopTab = typeof TOP_TABS[number];
const TAB_LABELS: Record<TopTab, string> = {
  dashboard: 'Dashboard',
  report: 'Report',
  manual: 'Manual Process',
  automatic: 'Automatic Process',
  'ai-exp': 'AI Exp',
  'ai-governance': 'AI Governance',
  'ai-risk': 'AI Risk',
  resai: 'ResAI',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    running: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    succeeded: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    fact_check_rejected: 'bg-orange-100 text-orange-700',
    queued: 'bg-gray-100 text-gray-600',
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

/** Reference-mode card: shows both the B2B and B2C real checklist templates for a phase, side by side, before any study exists. */
function ChecklistTemplateCard({ templates }: { templates: ChecklistTemplates }) {
  return (
    <Card title="Checklist template (B2C vs B2B) — applied automatically when a study picks a business model">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">B2C</p>
          <ul className="space-y-1.5">
            {templates.b2c.map((item, i) => (
              <li key={i} className="text-sm text-gray-800">• {item.text}</li>
            ))}
            {!templates.b2c.length && <li className="text-sm text-gray-400">No B2C template items yet.</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">B2B</p>
          <ul className="space-y-1.5">
            {templates.b2b.map((item, i) => (
              <li key={i} className="text-sm text-gray-800">• {item.text}</li>
            ))}
            {!templates.b2b.length && <li className="text-sm text-gray-400">No B2B template items yet.</li>}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-400">These items are added to every phase run's checklist alongside the 4 generic workflow-gate items (Reference content loaded / Research-AI draft generated / Fact-check passed / Human reviewed).</p>
    </Card>
  );
}

/** The mandatory 13-field process sub-structure — used identically by Manual Process and Automatic Process tabs (policy §3). */
function ProcessSubStructure({
  phase, phaseRun, transactions, editable, onToggle, onAddChecklistItem,
}: {
  phase: PhaseData;
  phaseRun: PhaseRunData;
  transactions: TransactionEntry[];
  editable: boolean;
  onToggle?: (field: 'checklist' | 'todoList', index: number, done: boolean) => void;
  onAddChecklistItem?: (text: string) => void;
}) {
  const [newItemText, setNewItemText] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Goal"><p className="text-sm text-gray-800">{phaseRun.goal || '—'}</p></Card>
        <Card title="Objective"><p className="text-sm text-gray-800">{phaseRun.objective || '—'}</p></Card>
      </div>

      <Card title="To-do list">
        <ul className="space-y-1.5">
          {phaseRun.todoList.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!editable}
                onChange={e => onToggle?.('todoList', i, e.target.checked)}
              />
              <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.text}</span>
            </li>
          ))}
          {!phaseRun.todoList.length && <li className="text-sm text-gray-400">No to-do items.</li>}
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Input"><p className="whitespace-pre-wrap text-sm text-gray-800">{phaseRun.inputContent || phase.inputReference}</p></Card>
        <Card title="Process"><p className="whitespace-pre-wrap text-sm text-gray-800">{phaseRun.processContent || phase.processReference}</p></Card>
        <Card title="Output"><p className="whitespace-pre-wrap text-sm text-gray-800">{phaseRun.outputContent || '(no output yet)'}</p></Card>
      </div>

      <Card title="Visualization">
        {Object.keys(phaseRun.visualizationData || {}).length ? (
          <pre className="overflow-x-auto text-xs text-gray-700">{JSON.stringify(phaseRun.visualizationData, null, 2)}</pre>
        ) : (
          <p className="text-sm text-gray-400">No structured visualization data yet for this phase run.</p>
        )}
      </Card>

      <Card title="Transactional history (timestamped)">
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {transactions.map(t => (
            <li key={t.id} className="border-b border-gray-50 pb-1.5 text-sm last:border-0">
              <span className="font-mono text-xs text-gray-400">{fmt(t.occurred_at)}</span>{' '}
              <span className="font-medium text-gray-700">{t.event_type}</span>
              <span className="text-gray-600"> — {t.description}</span>
            </li>
          ))}
          {!transactions.length && <li className="text-sm text-gray-400">No transactions recorded yet.</li>}
        </ul>
      </Card>

      <Card title="Checklist">
        <ul className="space-y-1.5">
          {phaseRun.checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!editable}
                onChange={e => onToggle?.('checklist', i, e.target.checked)}
              />
              <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.text}</span>
            </li>
          ))}
          {!phaseRun.checklist.length && <li className="text-sm text-gray-400">No checklist items.</li>}
        </ul>
        {editable && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              const text = newItemText.trim();
              if (!text) return;
              onAddChecklistItem?.(text);
              setNewItemText('');
            }}
          >
            <input
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              placeholder="Add a custom checklist item…"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              + Add item
            </button>
          </form>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Inclusion boundary"><p className="text-sm text-gray-800">{phaseRun.inclusionBoundary || '—'}</p></Card>
        <Card title="Exclusion boundary"><p className="text-sm text-gray-800">{phaseRun.exclusionBoundary || '—'}</p></Card>
      </div>

      <Card title="Task list">
        <ul className="space-y-1.5">
          {phaseRun.taskList.map((t, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-800">{t.text}</span>
              <span className="text-xs text-gray-400">{t.assignee} · {t.status}</span>
            </li>
          ))}
          {!phaseRun.taskList.length && <li className="text-sm text-gray-400">No tasks.</li>}
        </ul>
      </Card>

      <Card title="Final outcome report">
        <p className="whitespace-pre-wrap text-sm text-gray-800">{phaseRun.finalOutcomeReport || 'Not yet finalized.'}</p>
      </Card>

      <Card title="Status (Completed / Pending / Running) — timestamped history">
        <div className="mb-2"><StatusBadge status={phaseRun.status} /></div>
        <ul className="space-y-1">
          {phaseRun.statusHistory.map((s, i) => (
            <li key={i} className="text-xs text-gray-500">
              <span className="font-mono">{fmt(s.at)}</span> — {s.status}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function PhaseTabs({
  mode, phase, phaseRun, transactions = [], aiLogs = [], jobRuns, studyId, onRunResearchAi, onToggleField, onAddChecklistItem, checklistTemplates,
}: {
  mode: 'study' | 'reference';
  phase: PhaseData;
  phaseRun?: PhaseRunData;
  transactions?: TransactionEntry[];
  aiLogs?: AiLogEntry[];
  jobRuns?: { researchAiJobRun: JobRunSummary | null; pricingJobRun: JobRunSummary | null; reviewsJobRun: JobRunSummary | null };
  studyId?: string;
  onRunResearchAi?: () => void;
  onToggleField?: (field: 'checklist' | 'todoList', index: number, done: boolean) => void;
  onAddChecklistItem?: (text: string) => void;
  /** Reference mode only — real B2B/B2C checklist templates for this phase, shown before any study exists. */
  checklistTemplates?: ChecklistTemplates | null;
}) {
  const [tab, setTab] = useState<TopTab>('dashboard');
  const [aiExpSub, setAiExpSub] = useState<'explainability' | 'experiment' | 'experience'>('explainability');
  const [resAiSub, setResAiSub] = useState<'research-ai' | 'responsible-ai'>('research-ai');

  const hasStudyData = mode === 'study' && phaseRun;
  const researchAiLogs = aiLogs.filter(l => l.purpose === 'research_ai');
  const latestAiLog = researchAiLogs[0] ?? null;

  const isPricingOrReviews = phase.slug === 'pricing' || phase.slug === 'reviews';
  const crossPortalJobRun = phase.slug === 'pricing' ? jobRuns?.pricingJobRun : phase.slug === 'reviews' ? jobRuns?.reviewsJobRun : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {TOP_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card title="Status">{hasStudyData ? <StatusBadge status={phaseRun!.status} /> : <span className="text-sm text-gray-400">Reference mode</span>}</Card>
          <Card title="Layer"># {phase.layerNumber}</Card>
          <Card title="Research-AI runs">{researchAiLogs.length}</Card>
          <Card title="Transactions">{transactions.length}</Card>
          <div className="sm:col-span-4">
            <Card title="Phase reference">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div><span className="text-xs text-gray-400">What to investigate</span><p className="text-gray-800">{phase.processReference}</p></div>
                <div><span className="text-xs text-gray-400">Data/KPI</span><p className="text-gray-800">{phase.inputReference}</p></div>
                <div><span className="text-xs text-gray-400">Forecast/decision</span><p className="text-gray-800">{phase.outputReference}</p></div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <Card title={`Report — ${phase.name}`}>
          {hasStudyData ? (
            <p className="whitespace-pre-wrap text-sm text-gray-800">{phaseRun!.outputContent || 'No report generated yet — run Research-AI draft from the Automatic Process tab.'}</p>
          ) : (
            <p className="text-sm text-gray-400">Select or start a study to see a generated report for this phase.</p>
          )}
        </Card>
      )}

      {tab === 'manual' && (
        hasStudyData
          ? <ProcessSubStructure phase={phase} phaseRun={phaseRun!} transactions={transactions} editable onToggle={onToggleField} onAddChecklistItem={onAddChecklistItem} />
          : (
            <div className="space-y-4">
              <Card><p className="text-sm text-gray-400">Select or start a study to run this phase's Manual Process.</p></Card>
              {mode === 'reference' && checklistTemplates && <ChecklistTemplateCard templates={checklistTemplates} />}
            </div>
          )
      )}

      {tab === 'automatic' && (
        <div className="space-y-4">
          <Card title="Job Schedule">
            {phase.slug === 'pricing' && (
              <p className="text-sm text-gray-800">Real automation: <span className="font-mono">pricing-cross-portal</span> — weekly Monday 08:00 UTC, cross-DB read of sohamyoga's live pricing_plan_master/pricing_plan_price.</p>
            )}
            {phase.slug === 'reviews' && (
              <p className="text-sm text-gray-800">Real automation attempt: <span className="font-mono">reviews-cross-portal</span> — weekly Monday 09:00 UTC, cross-DB check of sohamyoga's review/sentiment tables. Falls back to an honest &quot;Not yet automated&quot; when those tables have no real rows.</p>
            )}
            {!isPricingOrReviews && (
              <p className="text-sm text-gray-400">Not yet automated — this layer has no dedicated external data source wired up in this pass. Research-AI draft (below) still runs for this phase.</p>
            )}
            {hasStudyData && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={onRunResearchAi}
                  className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Run Research-AI Draft Now
                </button>
                {jobRuns?.researchAiJobRun && (
                  <span className="text-xs text-gray-500">
                    Last run: <StatusBadge status={jobRuns.researchAiJobRun.status} /> {fmt(jobRuns.researchAiJobRun.started_at)}
                    {jobRuns.researchAiJobRun.duration_ms !== null && ` (${jobRuns.researchAiJobRun.duration_ms}ms)`}
                  </span>
                )}
              </div>
            )}
            {crossPortalJobRun && (
              <p className="mt-2 text-xs text-gray-500">
                Cross-portal job last run: <StatusBadge status={crossPortalJobRun.status} /> {fmt(crossPortalJobRun.started_at)}
                {crossPortalJobRun.result_summary && ` — ${crossPortalJobRun.result_summary}`}
              </p>
            )}
          </Card>
          {hasStudyData
            ? <ProcessSubStructure phase={phase} phaseRun={phaseRun!} transactions={transactions} editable={false} />
            : <Card><p className="text-sm text-gray-400">Select or start a study to run this phase's Automatic Process.</p></Card>}
        </div>
      )}

      {tab === 'ai-exp' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['explainability', 'experiment', 'experience'] as const).map(s => (
              <button
                key={s}
                onClick={() => setAiExpSub(s)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${aiExpSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}
              >
                {s}
              </button>
            ))}
          </div>
          {aiExpSub === 'explainability' && (
            <Card title="Explainability — why the AI produced this output">
              {latestAiLog ? (
                <div className="space-y-1 text-sm text-gray-800">
                  <p>Model: <span className="font-mono">{latestAiLog.model_name}</span></p>
                  <p>Prompt grounding: the phase's real reference text (What to investigate / Data-KPI / Forecast-decision) plus the study's topic — no external context.</p>
                  <p>Prompt length: {latestAiLog.prompt_chars} chars · Output length: {latestAiLog.output_chars} chars</p>
                  <p>Fact-check: {latestAiLog.fact_check_passed === null ? 'not applicable' : latestAiLog.fact_check_passed ? 'passed — every $/% figure traced to reference text or marked an estimate' : 'rejected — draft contained an untraceable figure, fell back to reference-only text'}</p>
                </div>
              ) : <p className="text-sm text-gray-400">No Research-AI run yet for this phase.</p>}
            </Card>
          )}
          {aiExpSub === 'experiment' && (
            <Card title="Experiment — models/prompts tried">
              <ul className="space-y-1.5">
                {researchAiLogs.map(l => (
                  <li key={l.id} className="text-sm text-gray-700">
                    <span className="font-mono text-xs text-gray-400">{fmt(l.created_at)}</span> — {l.model_name} — <StatusBadge status={l.status} />
                  </li>
                ))}
                {!researchAiLogs.length && <li className="text-sm text-gray-400">No experiment runs recorded yet.</li>}
              </ul>
            </Card>
          )}
          {aiExpSub === 'experience' && (
            <Card title="Experience — plain-language summary">
              <p className="text-sm text-gray-800">
                {latestAiLog
                  ? `The AI read this phase's real research definition and the study topic, then wrote a short draft. ${latestAiLog.fact_check_passed ? 'Its numeric claims all checked out against the real reference data.' : 'A numeric claim it made could not be verified, so a safe fallback was shown instead.'}`
                  : 'The AI has not run for this phase yet.'}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === 'ai-governance' && (
        <Card title="AI Governance">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Model/data lineage:</strong> local Ollama instance (self-hosted, same instance sohamyoga-frontend uses) — no data leaves this machine.</p>
            <p><strong>Approval status:</strong> Advisory only — every AI draft is written to the phase's Report/Output for human review; nothing auto-publishes or auto-sends.</p>
            <p><strong>Policy compliance:</strong> Follows the Action/Test/Advise pattern (deterministic action → deterministic fact-check → advisory output) mandated for this codebase's Ollama jobs.</p>
            <p><strong>Real run count backing this tab:</strong> {researchAiLogs.length} logged Research-AI invocation(s) for this phase run.</p>
          </div>
        </Card>
      )}

      {tab === 'ai-risk' && (
        <Card title="AI Risk">
          <div className="space-y-2 text-sm text-gray-800">
            <p><strong>Known failure modes:</strong> the model may state a plausible-sounding but unverified number; the deterministic fact-check exists specifically to catch this.</p>
            <p><strong>Bias/hallucination risk:</strong> Medium for narrative framing, Low for numeric claims (protected by fact-check). Grounded strictly in this phase's documented reference text, not open web data.</p>
            <p><strong>Mitigations:</strong> passesFactCheck() rejects any $/% figure not traceable to the reference text or marked an estimate; rejected drafts fall back to reference-only text rather than publishing an unverified claim.</p>
            <p><strong>Current risk level:</strong> {latestAiLog ? (latestAiLog.fact_check_passed ? 'Low (last run passed fact-check)' : 'Elevated (last run was rejected by fact-check and fell back)') : 'Unrated (no run yet)'}</p>
          </div>
        </Card>
      )}

      {tab === 'resai' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['research-ai', 'responsible-ai'] as const).map(s => (
              <button
                key={s}
                onClick={() => setResAiSub(s)}
                className={`rounded px-3 py-1 text-xs font-medium ${resAiSub === s ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}
              >
                {s === 'research-ai' ? 'Research AI' : 'Responsible AI'}
              </button>
            ))}
          </div>
          {resAiSub === 'research-ai' && (
            <Card title="Research AI — the agent that runs research for this phase">
              <p className="mb-2 text-sm text-gray-800">ResearchAiDraftJob searches this phase's own documented reference definition, summarizes it against the study topic, and drafts a grounded finding.</p>
              {hasStudyData && (
                <button onClick={onRunResearchAi} className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Run Research AI Now
                </button>
              )}
            </Card>
          )}
          {resAiSub === 'responsible-ai' && (
            <Card title="Responsible AI — compliance documentation">
              <div className="space-y-2 text-sm text-gray-800">
                <p><strong>Data provenance:</strong> phase reference text ported verbatim from docs/market-research-growth-framework.md §2; study topic is free-text the admin entered.</p>
                <p><strong>Consent/privacy:</strong> no personal data is processed by this job — inputs are business/market reference text only.</p>
                <p><strong>Bias checks:</strong> deterministic fact-check on every run (see AI Risk tab); local model only, no third-party data sharing.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
