'use client';
// /admin/simulation — Guided Simulation: an interactive, step-by-step
// walkthrough that actually executes real flows and shows real data at
// each step, rather than a static diagram (that's what the Demo Hub's
// Sequence Flows tab already does — this page is the live-run complement
// to it). Each flow has three steps: inspect real source data, trigger the
// real job (the same code path a schedule would run — POST
// /api/admin/demo-hub/run-job), then inspect the real result it produced.

import { useState } from 'react';

interface FlowDef {
  key: string;
  title: string;
  description: string;
  sourceLabel: string;
  resultLabel: string;
  resultColumns: string[];
  sourceColumns: string[];
}

const FLOWS: FlowDef[] = [
  {
    key: 'voice-of-customer',
    title: 'Voice of Customer',
    description: 'Ollama clusters real inbound customer messages from the last 7 days into themes, complaints and requests.',
    sourceLabel: 'Real customer messages (campaign_lead, last 7 days)',
    sourceColumns: ['subject', 'message', 'created_at'],
    resultLabel: 'Digest produced',
    resultColumns: ['overall_summary', 'source_message_count', 'period_end'],
  },
  {
    key: 'churn-prediction',
    title: 'Churn Prediction',
    description: 'Ollama scores churn risk for actively-enrolled students based on real attendance history.',
    sourceLabel: 'Actively enrolled students (student + enrollment)',
    sourceColumns: ['display_name', 'enrollment_status', 'last_attended'],
    resultLabel: 'Risk predictions produced',
    resultColumns: ['display_name', 'risk_score', 'risk_level', 'top_reason'],
  },
  {
    key: 'campaign-health-audit',
    title: 'Campaign Health Audit',
    description: 'Deterministic SQL finds structural config problems in active ad campaigns; Ollama writes the human-readable summary.',
    sourceLabel: 'Active ad campaigns',
    sourceColumns: ['name', 'status', 'ad_group_count'],
    resultLabel: 'Findings produced',
    resultColumns: ['campaign_name', 'finding_key', 'severity', 'summary'],
  },
];

type StepState = 'idle' | 'loading' | 'done' | 'error';

function DataTable({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: string[] }) {
  if (!rows.length) return <p className="text-xs text-gray-400">No rows.</p>;
  return (
    <div className="overflow-auto rounded border">
      <table className="w-full text-xs">
        <thead className="bg-gray-50"><tr>{columns.map(c => <th key={c} className="p-1.5 text-left">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {columns.map(c => <td key={c} className="max-w-xs truncate p-1.5">{String(r[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowSimulation({ flow }: { flow: FlowDef }) {
  const [step, setStep] = useState(0);
  const [sourceRows, setSourceRows] = useState<Array<Record<string, unknown>> | null>(null);
  const [runResult, setRunResult] = useState<{ status: string; durationMs: number } | null>(null);
  const [resultRows, setResultRows] = useState<Array<Record<string, unknown>> | null>(null);
  const [state, setState] = useState<StepState>('idle');
  const [error, setError] = useState('');

  const inspectSource = async () => {
    setState('loading'); setError('');
    try {
      const res = await fetch(`/api/admin/demo-hub/simulation-step?flow=${flow.key}&step=source-data`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSourceRows(data.rows);
      setState('done');
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  };

  const runJob = async () => {
    setState('loading'); setError('');
    try {
      const res = await fetch('/api/admin/demo-hub/run-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: flow.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunResult({ status: data.status, durationMs: data.durationMs });
      setState('done');
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  };

  const inspectResult = async () => {
    setState('loading'); setError('');
    try {
      const res = await fetch(`/api/admin/demo-hub/simulation-step?flow=${flow.key}&step=result`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultRows(data.rows);
      setState('done');
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  };

  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{flow.title}</h2>
        <p className="text-sm text-gray-500">{flow.description}</p>
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${step >= 1 ? 'bg-emerald-600' : 'bg-gray-300'}`}>1</span>
          <button onClick={inspectSource} disabled={state === 'loading'} className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-50">
            Inspect: {flow.sourceLabel}
          </button>
        </div>
        {sourceRows && <div className="ml-9"><DataTable rows={sourceRows} columns={flow.sourceColumns} /></div>}

        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${step >= 2 ? 'bg-emerald-600' : 'bg-gray-300'}`}>2</span>
          <button onClick={runJob} disabled={step < 1 || state === 'loading'} className="rounded bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            Run real job: {flow.key}
          </button>
          {runResult && <span className="text-xs text-emerald-700">✓ {runResult.status} ({runResult.durationMs}ms)</span>}
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${step >= 3 ? 'bg-emerald-600' : 'bg-gray-300'}`}>3</span>
          <button onClick={inspectResult} disabled={step < 2 || state === 'loading'} className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-50">
            Inspect: {flow.resultLabel}
          </button>
        </div>
        {resultRows && <div className="ml-9"><DataTable rows={resultRows} columns={flow.resultColumns} /></div>}
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const [selected, setSelected] = useState(FLOWS[0].key);
  const flow = FLOWS.find(f => f.key === selected)!;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Guided Simulation</h1>
        <p className="text-sm text-gray-500">
          Step through a real flow live: inspect the real source data, trigger the actual job, then inspect the real
          result it produced. Every step hits the real database — nothing here is scripted or replayed.
        </p>
      </header>

      <nav className="flex gap-2">
        {FLOWS.map(f => (
          <button
            key={f.key}
            onClick={() => setSelected(f.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${selected === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {f.title}
          </button>
        ))}
      </nav>

      <FlowSimulation key={flow.key} flow={flow} />
    </div>
  );
}
