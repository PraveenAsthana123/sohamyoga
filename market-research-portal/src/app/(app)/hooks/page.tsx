'use client';

// Hook Management workspace. Consolidates the content_hook library (which
// previously had a real API but no admin UI at all) with the three items
// this session added: Topic Intelligence (real signals mined from
// competitor/lead/hook-performance data, never fabricated trends), Topic
// Flow Designer (hook -> context -> value -> CTA timing map), and Hook A/B
// testing (live two-proportion z-test, computed on read, never stored stale).

import { useEffect, useState, useCallback } from 'react';

interface Hook {
  id: string; text: string; category: string; topic: string | null; platform: string | null;
  status: string; attached_variants: string; total_views: string; completion_rate_pct: string | null;
}
interface Signal { id: string; topic: string; source: string; signal_strength: number; detail: string; captured_on: string }
interface FlowStage { id: string; stage_type: string; sequence_order: number; start_second: string; duration_seconds: string; script_text: string }
interface Flow { id: string; name: string; hook_id: string | null; stages: FlowStage[] }
interface Comparison { hasEnoughData: boolean; rateA: number | null; rateB: number | null; pValue: number | null; significant: boolean; winner: 'a' | 'b' | null }
interface Experiment {
  id: string; name: string; status: string; hook_a_text: string; hook_b_text: string;
  hookAStats: { views: number; completions: number }; hookBStats: { views: number; completions: number }; comparison: Comparison;
}

const CATEGORIES = ['question','shock','curiosity','problem','contrarian','statistic','mistake','promise','transformation','story','challenge','fomo','comparison','before_after'];
const STAGE_TYPES = ['hook', 'context', 'value', 'cta'];

export default function HooksPage() {
  const [tab, setTab] = useState<'library' | 'intelligence' | 'flows' | 'experiments'>('library');
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [msg, setMsg] = useState('');

  const [hookForm, setHookForm] = useState({ text: '', category: 'question', topic: '', platform: '' });
  const [flowForm, setFlowForm] = useState({ name: '', hookId: '' });
  const [expForm, setExpForm] = useState({ name: '', hookAId: '', hookBId: '' });

  const load = useCallback(() => {
    fetch('/api/hooks', { cache: 'no-store' }).then(r => r.json()).then(d => setHooks(d.hooks ?? []));
    fetch('/api/topic-signals', { cache: 'no-store' }).then(r => r.json()).then(d => setSignals(d.signals ?? []));
    fetch('/api/topic-flows', { cache: 'no-store' }).then(r => r.json()).then(d => setFlows(d.flows ?? []));
    fetch('/api/hook-experiments', { cache: 'no-store' }).then(r => r.json()).then(d => setExperiments(d.experiments ?? []));
  }, []);
  useEffect(() => { load() }, [load]);

  const approvedHooks = hooks.filter(h => h.status !== 'archived');

  async function createHook(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/hooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hookForm) });
    const j = await r.json();
    setMsg(r.ok ? 'Hook added.' : j.error);
    if (r.ok) setHookForm({ text: '', category: 'question', topic: '', platform: '' });
    load();
  }
  async function hookStatus(hookId: string, action: string) {
    await fetch('/api/hooks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hookId, action }) });
    load();
  }
  async function createFlow(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/topic-flows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: flowForm.name, hookId: flowForm.hookId || undefined,
        stages: STAGE_TYPES.map((t, i) => ({ stageType: t, startSecond: i * 5, durationSeconds: 5, scriptText: '' })),
      }),
    });
    const j = await r.json();
    setMsg(r.ok ? 'Flow created with 4 default stages (hook/context/value/cta).' : j.error);
    if (r.ok) setFlowForm({ name: '', hookId: '' });
    load();
  }
  async function createExperiment(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/hook-experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expForm) });
    const j = await r.json();
    setMsg(r.ok ? 'Experiment created.' : j.error);
    if (r.ok) setExpForm({ name: '', hookAId: '', hookBId: '' });
    load();
  }
  async function concludeExperiment(experimentId: string) {
    const r = await fetch('/api/hook-experiments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ experimentId, action: 'conclude' }) });
    const j = await r.json();
    setMsg(r.ok ? 'Experiment concluded.' : j.error);
    load();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Hook Management</h1>
        <p className="text-sm text-gray-500">Hook library, Topic Intelligence (real signals only), Topic Flow Designer, and Hook A/B testing.</p>
      </div>

      <div className="flex gap-2 border-b">
        {(['library', 'intelligence', 'flows', 'experiments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-brand-600 text-brand-800' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-gray-500">{msg}</p>}

      {tab === 'library' && (
        <div className="space-y-4">
          <form onSubmit={createHook} className="space-y-2 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Add a hook</h2>
            <textarea required placeholder="Hook text" className="w-full rounded border p-2 text-sm" value={hookForm.text} onChange={e => setHookForm({ ...hookForm, text: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select className="rounded border p-2 text-sm" value={hookForm.category} onChange={e => setHookForm({ ...hookForm, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Topic" className="rounded border p-2 text-sm" value={hookForm.topic} onChange={e => setHookForm({ ...hookForm, topic: e.target.value })} />
              <input placeholder="Platform (optional)" className="rounded border p-2 text-sm" value={hookForm.platform} onChange={e => setHookForm({ ...hookForm, platform: e.target.value })} />
            </div>
            <button className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">Add hook</button>
          </form>
          <div className="space-y-2">
            {hooks.map(h => (
              <div key={h.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{h.category}</span>
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{h.status}</span>
                    {h.topic && <span className="ml-2 text-xs text-gray-400">#{h.topic}</span>}
                    <p className="mt-1 text-sm">{h.text}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {h.attached_variants} attached variant(s) · {h.total_views} real views · {h.completion_rate_pct !== null ? `${h.completion_rate_pct}% completion` : 'no measured data yet'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {h.status !== 'approved' && <button onClick={() => hookStatus(h.id, 'approve')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Approve</button>}
                    {h.status !== 'archived' && <button onClick={() => hookStatus(h.id, 'archive')} className="rounded bg-gray-500 px-2 py-1 text-xs text-white">Archive</button>}
                  </div>
                </div>
              </div>
            ))}
            {!hooks.length && <p className="text-sm text-gray-400">No hooks yet — add one above.</p>}
          </div>
        </div>
      )}

      {tab === 'intelligence' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Real signals mined daily (06:00 UTC) from competitor entries, lead inquiry messages, and measured hook performance — never external trend data, since no social-listening API/credential exists here.</p>
          {signals.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm">
              <div>
                <span className="font-medium">{s.topic}</span>
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s.source.replace('_', ' ')}</span>
                <p className="text-xs text-gray-500">{s.detail}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <div>strength {s.signal_strength}</div>
                <div>{s.captured_on}</div>
              </div>
            </div>
          ))}
          {!signals.length && <p className="text-sm text-gray-400">No signals yet — run the topic-intelligence job, or check back after real leads/competitors/hook performance accumulate.</p>}
        </div>
      )}

      {tab === 'flows' && (
        <div className="space-y-4">
          <form onSubmit={createFlow} className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-5">
            <div>
              <label className="block text-xs text-gray-500">Flow name</label>
              <input required className="rounded border p-2 text-sm" value={flowForm.name} onChange={e => setFlowForm({ ...flowForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Attach hook (optional)</label>
              <select className="rounded border p-2 text-sm" value={flowForm.hookId} onChange={e => setFlowForm({ ...flowForm, hookId: e.target.value })}>
                <option value="">None</option>
                {approvedHooks.map(h => <option key={h.id} value={h.id}>{h.text.slice(0, 40)}</option>)}
              </select>
            </div>
            <button className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">Create flow (hook/context/value/cta)</button>
          </form>
          <div className="space-y-3">
            {flows.map(f => (
              <div key={f.id} className="rounded-lg border bg-white p-4">
                <h3 className="font-semibold">{f.name}</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {f.stages.map(s => (
                    <div key={s.id} className="rounded border border-dashed p-2 text-xs">
                      <div className="font-medium capitalize">{s.stage_type}</div>
                      <div className="text-gray-500">{s.start_second}s → {Number(s.start_second) + Number(s.duration_seconds)}s</div>
                      <div className="mt-1 text-gray-400">{s.script_text || 'no script yet'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!flows.length && <p className="text-sm text-gray-400">No flows yet — create one above.</p>}
          </div>
        </div>
      )}

      {tab === 'experiments' && (
        <div className="space-y-4">
          <form onSubmit={createExperiment} className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-5">
            <div>
              <label className="block text-xs text-gray-500">Experiment name</label>
              <input required className="rounded border p-2 text-sm" value={expForm.name} onChange={e => setExpForm({ ...expForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Hook A</label>
              <select required className="rounded border p-2 text-sm" value={expForm.hookAId} onChange={e => setExpForm({ ...expForm, hookAId: e.target.value })}>
                <option value="">Select…</option>
                {approvedHooks.map(h => <option key={h.id} value={h.id}>{h.text.slice(0, 40)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Hook B</label>
              <select required className="rounded border p-2 text-sm" value={expForm.hookBId} onChange={e => setExpForm({ ...expForm, hookBId: e.target.value })}>
                <option value="">Select…</option>
                {approvedHooks.map(h => <option key={h.id} value={h.id}>{h.text.slice(0, 40)}</option>)}
              </select>
            </div>
            <button className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">Create experiment</button>
          </form>
          <div className="space-y-3">
            {experiments.map(ex => (
              <div key={ex.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{ex.status}</span>
                    <h3 className="mt-1 font-semibold">{ex.name}</h3>
                  </div>
                  {ex.status === 'running' && <button onClick={() => concludeExperiment(ex.id)} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Conclude</button>}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className={`rounded border p-2 text-xs ${ex.comparison.winner === 'a' ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                    <div className="font-medium">A: {ex.hook_a_text.slice(0, 60)}</div>
                    <div className="text-gray-500">{ex.hookAStats.views} views · {ex.hookAStats.completions} completions{ex.comparison.rateA !== null ? ` (${(ex.comparison.rateA * 100).toFixed(1)}%)` : ''}</div>
                  </div>
                  <div className={`rounded border p-2 text-xs ${ex.comparison.winner === 'b' ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                    <div className="font-medium">B: {ex.hook_b_text.slice(0, 60)}</div>
                    <div className="text-gray-500">{ex.hookBStats.views} views · {ex.hookBStats.completions} completions{ex.comparison.rateB !== null ? ` (${(ex.comparison.rateB * 100).toFixed(1)}%)` : ''}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {!ex.comparison.hasEnoughData
                    ? 'Not enough real data yet — needs at least 30 measured views on each hook before a statistical comparison is possible.'
                    : ex.comparison.significant
                      ? `Statistically significant (p=${ex.comparison.pValue?.toFixed(3)}) — hook ${ex.comparison.winner?.toUpperCase()} wins.`
                      : `No significant difference yet (p=${ex.comparison.pValue?.toFixed(3)}).`}
                </p>
              </div>
            ))}
            {!experiments.length && <p className="text-sm text-gray-400">No experiments yet — create one above.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
