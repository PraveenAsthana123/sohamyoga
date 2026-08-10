'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Model = { name: string; enabled: boolean; isDefault: boolean; purpose: string };
type Snapshot = { dataSource: string; ollamaUp: boolean; installedCount: number; queueByStatus: Record<string, number>; failures: Array<{ reason: string }>; summary: { running: number; queued: number; loaded: number; modelInUse: string } };

const workflows = [
  ['Social portals', '/admin/social/setup', 'Connect and monitor YouTube, Facebook, Instagram, LinkedIn, TikTok, X, Pinterest and Reddit.'],
  ['Campaign composer', '/admin/marketing-command', 'Generate copy, static/dynamic banners and video scripts; approve, schedule and publish.'],
  ['Social publishing', '/admin/social/compose', 'Create one post and adapt it for connected destinations.'],
  ['Banner studio', '/admin/banners', 'Create and manage promotional banner assets.'],
  ['Video and YouTube', '/admin/videos', 'Manage video assets and YouTube publishing preparation.'],
  ['Blog', '/admin/blog', 'Create, review and publish long-form content.'],
  ['Contacts and CRM', '/admin/crm', 'Manage leads, contacts, pipeline and nurturing.'],
  ['Workflow operations', '/admin/workflows', 'Inspect approvals, scheduling and automation flows.'],
  ['System health', '/admin/health', 'Review database, API and runtime health.'],
  ['API tracking', '/admin/api-tracking', 'Inspect integration traffic, failures and latency.'],
  ['Database schema', '/admin/schema-catalog', 'Explore every live table, column, primary key, foreign key and view.'],
  ['Operations history', '/admin/operations-history', 'Trace every run, model call, integration error and circuit-breaker state.'],
  ['Module assurance', '/admin/module-assurance', 'Verify modules, features, UI, integrations, tests, models and database coverage.'],
  ['Architecture & processes', '/admin/architecture-center', 'C4, HLD/LLD context, onboarding, transaction and asynchronous process training.'],
] as const;

const process = ['Brief received', 'Ollama plan', 'Specialist jobs', 'Human approval', 'Schedule/publish', 'Analytics and retry'];

type Endpoints = { paperclip: string; openclaw: string; ollamaDirector: string };

export default function OperationsCenterPage() {
  const [tenantId, setTenantId] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [health, setHealth] = useState<Snapshot | null>(null);
  const [voice, setVoice] = useState('');
  const [message, setMessage] = useState('Ready');
  const [requestId, setRequestId] = useState<number | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);

  const refresh = useCallback(async () => {
    const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const [m, h] = await Promise.all([
      fetch(`/api/ai/models${suffix}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/ai/monitoring', { cache: 'no-store' }).then(r => r.json()),
    ]);
    setModels(m.models || []); setHealth(h);
  }, [tenantId]);

  useEffect(() => { void refresh(); fetch('/api/platform/endpoints', { cache: 'no-store' }).then(r => r.json()).then(setEndpoints).catch(() => undefined); }, [refresh]);

  const updateModel = async (model: Model, enabled: boolean) => {
    if (!tenantId) return setMessage('Enter a tenant UUID before changing model policy.');
    const res = await fetch('/api/ai/models', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, modelName: model.name, enabled, isDefault: enabled && model.isDefault, purpose: model.purpose }) });
    const data = await res.json();
    setMessage(res.ok ? `${model.name} ${enabled ? 'enabled' : 'disabled'}.` : data.error || 'Model update failed.');
    if (res.ok) await refresh();
  };

  const listen = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void } }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
    if (!SpeechRecognition) return setMessage('Speech recognition is not supported in this browser. Use Chrome or type the command.');
    const recognition = new SpeechRecognition(); recognition.lang = 'en-IN'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = e => { setVoice(e.results[0][0].transcript); setMessage('Voice converted to text. Review it before submitting.'); };
    recognition.onerror = () => setMessage('Voice recognition failed.'); recognition.start(); setMessage('Listening…');
  };

  const submitVoice = async () => {
    if (!voice.trim()) return;
    setMessage('Creating an Ollama plan…');
    const res = await fetch('/api/ai/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: voice.trim() }) });
    const data = await res.json();
    if (res.ok) { setRequestId(data.request_id); setMessage(`Request ${data.request_id} planned and queued.`); }
    else setMessage(data.error || 'Submission failed.');
  };

  return <div className="mx-auto max-w-7xl space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">AI, Social and Operations Centre</h1><p className="text-sm text-gray-500">One control surface for local models, content workflows, integrations, monitoring and voice commands.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
      ['Ollama', health?.ollamaUp ? 'Healthy' : 'Offline'], ['Models', String(health?.installedCount ?? 0)], ['Running', String(health?.summary?.running ?? 0)], ['Queued', String(health?.summary?.queued ?? 0)], ['Telemetry', health?.dataSource || 'loading'],
    ].map(([k,v]) => <div key={k} className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-gray-500">{k}</div><div className="mt-1 font-semibold">{v}</div></div>)}</section>

    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Voice command → Ollama director</h2><p className="text-xs text-gray-500">Voice is converted to text only. Review before submission; generated jobs do not receive permission to publish automatically.</p><div className="mt-3 flex flex-col gap-2 md:flex-row"><button onClick={listen} className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white">🎙 Start voice</button><input value={voice} onChange={e => setVoice(e.target.value)} placeholder="Speak or type a command" className="flex-1 rounded-lg border px-3 py-2 text-sm"/><button onClick={submitVoice} disabled={!voice.trim()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">Plan and run</button></div><p className="mt-2 text-xs text-gray-500">{message}{requestId && <> · <Link className="text-indigo-600" href={`/admin/api-tracking`}>Track request #{requestId}</Link></>}</p></section>

    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Unified module operations</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workflows.map(([title,href,desc]) => <Link key={href} href={href} className="rounded-lg border p-4 hover:border-indigo-400 hover:bg-indigo-50"><strong>{title}</strong><p className="mt-1 text-xs text-gray-500">{desc}</p></Link>)}</div></section>

    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Agent orchestration platforms</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[
      ['Paperclip', endpoints?.paperclip, 'Agent organization, goals, budgets, approvals and heartbeats.'],
      ['OpenClaw', endpoints?.openclaw, 'Local assistant configured to use ollama/qwen3:8b.'],
      ['Ollama Director', endpoints ? `${endpoints.ollamaDirector}/health` : undefined, 'Local planning, job routing, monitoring and terminal execution.'],
    ].map(([title,href,desc]) => <a key={title} href={href || '#'} target="_blank" rel="noreferrer" className="rounded-lg border p-4 hover:border-indigo-400 hover:bg-indigo-50"><strong>{title}</strong><p className="mt-1 text-xs text-gray-500">{desc}</p><p className="mt-2 truncate font-mono text-[10px] text-gray-400">{href || 'Loading user port…'}</p></a>)}<div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><strong>Harness AI</strong><p className="mt-1 text-xs text-gray-600">Account connection required. Add the Harness account URL, API key and enabled AI Agents/model connector before activation.</p></div></div></section>

    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">End-to-end process</h2><div className="mt-4 grid gap-2 md:grid-cols-6">{process.map((p,i) => <div key={p} className="rounded-lg bg-gray-50 p-3 text-xs"><span className="font-bold text-indigo-600">{i+1}</span><div className="mt-1 font-medium">{p}</div></div>)}</div></section>

    <section className="rounded-xl border bg-white p-5"><div className="flex flex-col justify-between gap-2 md:flex-row"><div><h2 className="font-semibold">Tenant model policy</h2><p className="text-xs text-gray-500">Enable or disable each installed model. Administrative authorization is required.</p></div><div className="flex gap-2"><input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant UUID" className="rounded border px-3 py-2 text-xs"/><button onClick={refresh} className="rounded bg-indigo-600 px-3 py-2 text-xs text-white">Load</button></div></div><div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-500"><th className="p-2">Model</th><th>Role</th><th>Enabled</th><th>Default</th></tr></thead><tbody>{models.map(m => <tr key={m.name} className="border-b"><td className="p-2 font-mono text-xs">{m.name}</td><td>{m.purpose}</td><td><input type="checkbox" checked={m.enabled} onChange={e => void updateModel(m,e.target.checked)}/></td><td>{m.isDefault ? '✓' : ''}</td></tr>)}</tbody></table></div></section>
  </div>;
}
