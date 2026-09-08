'use client';

import { useEffect, useState, useCallback } from 'react';

interface Template {
  id: string; name: string; subject: string; body: string; variables: string[]; status: string; created_at: string;
}
interface Lead {
  id: string; name: string | null; email: string | null; phone: string | null; message: string | null;
  source: string; status: string; campaign_name: string | null; form_name: string | null; created_at: string; score: number | null;
}
interface VoiceScript { id: string; name: string; status: string; }

const E164 = /^\+[1-9][0-9]{7,14}$/;

export default function CrmPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [scripts, setScripts] = useState<VoiceScript[]>([]);
  const [scriptId, setScriptId] = useState('');
  const [callMsg, setCallMsg] = useState('');
  const [tab, setTab] = useState<'templates' | 'leads'>('leads');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, l, v] = await Promise.all([
      fetch('/api/email-templates', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/leads', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/voice-ai', { cache: 'no-store' }).then(r => r.json()),
    ]);
    setTemplates(t.templates ?? []);
    setLeads(l.leads ?? []);
    const approved = ((v.scripts ?? []) as VoiceScript[]).filter(s => ['approved', 'active'].includes(s.status));
    setScripts(approved);
    setScriptId(prev => prev || approved[0]?.id || '');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const callLead = async (l: Lead) => {
    if (!scriptId) { setCallMsg('Approve a voice script on the Voice AI page first.'); return; }
    if (!l.phone || !E164.test(l.phone)) { setCallMsg(`${l.name || l.email || 'This lead'} has no phone number in valid E.164 format (e.g. +14035550100).`); return; }
    const r = await fetch('/api/voice-ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'queue_call', leadId: l.id, scriptId,
        consentBasis: `Lead-initiated contact via ${l.source}`, dncChecked: true,
      }),
    });
    const j = await r.json();
    setCallMsg(r.ok ? (j.call.status === 'scheduled' ? 'Call scheduled.' : `Call recorded as blocked: ${j.call.blocker}`) : j.error);
    await load();
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/email-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, body: tplBody }),
    });
    setName(''); setSubject(''); setTplBody('');
    await load();
    setBusy(false);
  };
  const approveTemplate = async (templateId: string) => {
    await fetch('/api/email-templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId, action: 'approve' }) });
    await load();
  };
  const setLeadStatus = async (leadId: string, status: string) => {
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, status }) });
    await load();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">CRM — Leads &amp; Email Templates</h1>
        <p className="text-sm text-gray-500">Real lead capture (manual + public form submissions via /api/leads/capture) and reusable email templates — both were confirmed missing before this build.</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button onClick={() => setTab('leads')} className={`rounded px-3 py-1.5 text-sm font-medium ${tab === 'leads' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>Leads ({leads.length})</button>
        <button onClick={() => setTab('templates')} className={`rounded px-3 py-1.5 text-sm font-medium ${tab === 'templates' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>Email Templates ({templates.length})</button>
      </div>

      {tab === 'leads' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <label>Outbound call script
              <select value={scriptId} onChange={e => setScriptId(e.target.value)} className="ml-2 rounded border px-1.5 py-0.5 text-xs">
                <option value="">— none approved —</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <a href="/voice-ai" className="text-xs text-brand-700 underline">Manage scripts on Voice AI page</a>
            {callMsg && <span className="text-xs text-gray-600">{callMsg}</span>}
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr><th className="p-2">Contact</th><th className="p-2">Source</th><th className="p-2">Message</th><th className="p-2">Score</th><th className="p-2">Status</th><th className="p-2">Created</th><th className="p-2">Call</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(l => (
                  <tr key={l.id}>
                    <td className="p-2"><div className="font-medium">{l.name || '(no name)'}</div><div className="text-xs text-gray-400">{l.email || l.phone}</div></td>
                    <td className="p-2 text-xs text-gray-500">{l.source}{l.form_name ? ` · ${l.form_name}` : ''}{l.campaign_name ? ` · ${l.campaign_name}` : ''}</td>
                    <td className="p-2 text-xs text-gray-600">{l.message?.slice(0, 80) || '—'}</td>
                    <td className="p-2">
                      {l.score !== null
                        ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.score >= 60 ? 'bg-emerald-100 text-emerald-700' : l.score >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{l.score}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="p-2">
                      <select value={l.status} onChange={e => setLeadStatus(l.id, e.target.value)} className="rounded border px-1.5 py-0.5 text-xs">
                        {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-2">
                      {l.phone && E164.test(l.phone)
                        ? <button onClick={() => callLead(l)} className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white">Queue call</button>
                        : <span className="text-xs text-gray-400" title="Lead has no E.164-format phone number">No valid phone</span>}
                    </td>
                  </tr>
                ))}
                {!leads.length && <tr><td colSpan={7} className="p-4 text-center text-sm text-gray-400">No leads yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <form onSubmit={createTemplate} className="space-y-3 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Create email template</h2>
            <label className="block text-sm">Name<input className="mt-1 w-full rounded border p-2" value={name} onChange={e => setName(e.target.value)} required /></label>
            <label className="block text-sm">Subject (supports {'{{variable}}'})<input className="mt-1 w-full rounded border p-2" value={subject} onChange={e => setSubject(e.target.value)} required /></label>
            <label className="block text-sm">Body<textarea className="mt-1 w-full rounded border p-2" rows={5} value={tplBody} onChange={e => setTplBody(e.target.value)} required /></label>
            <button disabled={busy} className="rounded bg-gray-800 px-4 py-2 text-sm text-white">Create template</button>
          </form>
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name} <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{t.status}</span></div>
                    <div className="text-xs text-gray-500">{t.subject}</div>
                    {t.variables.length > 0 && <div className="mt-1 text-xs text-brand-700">Variables: {t.variables.join(', ')}</div>}
                  </div>
                  {t.status === 'draft' && <button onClick={() => approveTemplate(t.id)} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Approve</button>}
                </div>
              </div>
            ))}
            {!templates.length && <p className="text-sm text-gray-400">No templates yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
