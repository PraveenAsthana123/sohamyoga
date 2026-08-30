'use client';
// /admin/market-research/[frameworkSlug]/[topicId] — per-topic detail page
// with the 4-tab structure: Job Schedule, Input, Process, Output. Input /
// Process / Output render the real research_topic_tab content (unchanged
// from the original 3-tab page other than the tab_key relabel). Job
// Schedule is NOT a research_topic_tab row — it's computed server-side by
// the API route from research_topic.job_name + CRON_JOBS + operation_run,
// and rendered here from that payload. [topicId] is the topic's slug.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TopicTab {
  key: 'process' | 'input' | 'output';
  label: string;
  content: string;
  sortOrder: number;
}
interface JobSchedule {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  timeoutMs: number;
  lastRun: { status: string; startedAt: string | null; completedAt: string | null; durationMs: number | null } | null;
}
interface TopicDetail {
  framework: { slug: string; name: string };
  id: string;
  slug: string;
  name: string;
  layerNumber: number;
  summary: string;
  jobName: string | null;
  tabs: TopicTab[];
  jobSchedule: JobSchedule | null;
}

const CONTENT_TABS = ['job-schedule', 'input', 'process', 'output'] as const;
type UiTab = typeof CONTENT_TABS[number];
const TAB_LABELS: Record<UiTab, string> = { 'job-schedule': 'Job Schedule', input: 'Input', process: 'Process', output: 'Output' };

// Very small human-readable pass for the common cron shapes this repo uses
// (weekly-day, daily, every-N-minutes) — falls back to the raw cron string
// for anything else rather than guessing.
function describeCron(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [min, hour, dom, , dow] = parts;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (dom === '*' && dow !== '*' && /^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dow)) {
    return `Weekly, ${DAYS[Number(dow)]} ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }
  if (dom === '*' && dow === '*' && /^\d+$/.test(min) && /^\d+$/.test(hour)) {
    return `Daily, ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }
  if (min.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`;
  }
  return `${schedule} (UTC, cron)`;
}

function RunNowButton({ jobName, onRan }: { jobName: string; onRan: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle');
  const [detail, setDetail] = useState('');

  const run = async () => {
    setState('running');
    setDetail('');
    try {
      const res = await fetch('/api/admin/demo-hub/run-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: jobName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      setState('succeeded');
      setDetail(`${data.durationMs}ms`);
      onRan();
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
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {state === 'running' ? 'Running…' : 'Run Now'}
      </button>
      {state === 'succeeded' && <span className="text-sm text-emerald-700">✓ {detail}</span>}
      {state === 'failed' && <span className="max-w-sm truncate text-sm text-red-700" title={detail}>✗ {detail}</span>}
    </div>
  );
}

export default function MarketResearchTopicPage({ params }: { params: { frameworkSlug: string; topicId: string } }) {
  const { frameworkSlug, topicId } = params;
  const [activeTab, setActiveTab] = useState<UiTab>('job-schedule');
  const [data, setData] = useState<TopicDetail | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch(`/api/admin/market-research/${frameworkSlug}/${topicId}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  };

  useEffect(load, [frameworkSlug, topicId]);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const activeContent = data.tabs.find(t => t.key === activeTab)?.content ?? '';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-sm">
          <Link href="/admin/market-research" className="text-indigo-600 hover:underline">Market Research</Link>
          <span className="mx-1.5 text-gray-400">/</span>
          <Link href={`/admin/market-research/${frameworkSlug}`} className="text-indigo-600 hover:underline">{data.framework.name}</Link>
        </div>

        <header className="border-l-4 border-primary-600 pl-4">
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-gray-500">Layer {data.layerNumber} — {data.summary}</p>
        </header>

        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
          {CONTENT_TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {activeTab === 'job-schedule' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-4">Job Schedule</p>
            {data.jobSchedule ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-500">Job</div>
                    <div className="font-mono text-sm text-gray-900">{data.jobSchedule.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Schedule</div>
                    <div className="text-sm text-gray-900">{describeCron(data.jobSchedule.schedule)}</div>
                    <div className="font-mono text-xs text-gray-400">{data.jobSchedule.schedule}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Enabled</div>
                    <div className="text-sm text-gray-900">
                      {data.jobSchedule.enabled
                        ? <span className="text-emerald-700 font-semibold">Yes</span>
                        : <span className="text-gray-500 font-semibold">No</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Last run</div>
                    {data.jobSchedule.lastRun ? (
                      <div className="text-sm text-gray-900">
                        <span className={
                          data.jobSchedule.lastRun.status === 'succeeded' ? 'text-emerald-700 font-semibold'
                          : data.jobSchedule.lastRun.status === 'failed' ? 'text-red-700 font-semibold'
                          : 'text-amber-700 font-semibold'
                        }>{data.jobSchedule.lastRun.status}</span>
                        {data.jobSchedule.lastRun.startedAt && (
                          <span className="text-gray-500"> — {new Date(data.jobSchedule.lastRun.startedAt).toLocaleString()}</span>
                        )}
                        {data.jobSchedule.lastRun.durationMs !== null && (
                          <span className="text-gray-500"> ({data.jobSchedule.lastRun.durationMs}ms)</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">No runs recorded yet</div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">{data.jobSchedule.description}</p>
                <RunNowButton jobName={data.jobSchedule.name} onRan={load} />
              </div>
            ) : (
              <div className="text-sm text-gray-400">Not yet automated.</div>
            )}
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Input</p>
            <p className="text-gray-800 whitespace-pre-wrap">{activeContent}</p>
          </div>
        )}

        {activeTab === 'process' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Process</p>
            <p className="text-gray-800 whitespace-pre-wrap">{activeContent}</p>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Output</p>
            <p className="text-gray-800 whitespace-pre-wrap">{activeContent}</p>
          </div>
        )}
      </div>
    </div>
  );
}
