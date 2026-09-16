'use client';
// Voice AI Admin Page — call logs, script management, LLM script generator,
// qualification scores, and pipeline job status.
// Voice AI provider integration is not wired (no Twilio/ElevenLabs credentials
// exist in this build) — all calls are admin-entered transcripts.

import { useEffect, useState } from 'react';

const TABS = ['Dashboard', 'Call Logs', 'Script Generator', 'Report', 'Pipeline'] as const;
type Tab = (typeof TABS)[number];

interface CallRow {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string | null;
  transcript: string;
  duration_seconds: number | null;
  qualification_score: number;
  qualification_tier: 'cold' | 'warm' | 'hot';
  created_at: string;
  created_by: string;
}

const TIER_COLORS: Record<string, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-amber-100 text-amber-700',
  cold: 'bg-blue-100 text-blue-700',
};

const DIRECTION_COLORS: Record<string, string> = {
  inbound: 'bg-green-100 text-green-700',
  outbound: 'bg-purple-100 text-purple-700',
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
];

const PURPOSES = [
  { value: 'inbound_booking', label: 'Inbound — Booking Enquiry' },
  { value: 'outbound_followup', label: 'Outbound — Follow-Up' },
  { value: 'support', label: 'Support / Issue Resolution' },
];

const TONES = [
  { value: 'warm', label: 'Warm & Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'empathetic', label: 'Empathetic' },
];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function VoiceAiPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Script generator state
  const [purpose, setPurpose] = useState('inbound_booking');
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState('warm');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptError, setScriptError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/voice-calls', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load calls');
        setCalls(d.calls ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const generateScript = async () => {
    setGeneratingScript(true);
    setScriptError('');
    setGeneratedScript('');
    const purposeLabel = PURPOSES.find(p => p.value === purpose)?.label ?? purpose;
    const toneLabel = TONES.find(t => t.value === tone)?.label ?? tone;
    const langLabel = LANGUAGES.find(l => l.code === language)?.label ?? language;
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Write a concise, ${toneLabel} phone call script for a yoga studio.
Purpose: ${purposeLabel}. Language: ${langLabel}.
Requirements:
- Under 200 words
- Start with a natural greeting
- Include key talking points for this call type
- End with a clear next step
- Do not use stage directions or labels like "[AGENT]"`,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { response?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setGeneratedScript(data.response ?? 'No script returned.');
    } catch (e) {
      setScriptError(e instanceof Error ? e.message : 'Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  };

  const total = calls.length;
  const hot = calls.filter(c => c.qualification_tier === 'hot').length;
  const warm = calls.filter(c => c.qualification_tier === 'warm').length;
  const avgScore = total ? Math.round(calls.reduce((s, c) => s + c.qualification_score, 0) / total) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Voice AI</h1>
        <p className="text-sm text-gray-500">Call logs, qualification scoring, and AI-generated call scripts</p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Dashboard */}
      {tab === 'Dashboard' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <KpiCard label="Total Calls" value={total} />
            <KpiCard label="Hot Leads" value={hot} sub={total ? `${Math.round((hot / total) * 100)}%` : undefined} />
            <KpiCard label="Warm Leads" value={warm} />
            <KpiCard label="Avg Score" value={`${avgScore}/100`} />
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Voice AI Provider: Not Configured</p>
            <p className="mt-1 text-xs text-amber-700">
              No Twilio/ElevenLabs/VAPI credentials are configured. All call entries are admin-entered transcripts.
              Real telephony integration requires TWILIO_AUTH_TOKEN + TWILIO_ACCOUNT_SID (or equivalent).
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Recent Calls</h2>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              calls.length === 0 ? <p className="text-sm text-gray-400">No call logs yet.</p> : (
                <div className="space-y-2">
                  {calls.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded border border-gray-100 p-2 text-sm">
                      <div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIRECTION_COLORS[c.direction]}`}>{c.direction}</span>
                        <span className="ml-2 text-xs text-gray-500">{c.phone_number ?? 'unknown'}</span>
                        <span className="ml-2 text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{c.qualification_score}/100</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[c.qualification_tier]}`}>{c.qualification_tier}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Call Logs */}
      {tab === 'Call Logs' && (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All Call Logs ({total})</h2>
            <button onClick={load} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            calls.length === 0 ? <p className="text-sm text-gray-400">No calls logged yet.</p> : (
              <div className="space-y-3">
                {calls.map(c => (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIRECTION_COLORS[c.direction]}`}>{c.direction}</span>
                        {c.phone_number && <span className="text-xs text-gray-500">{c.phone_number}</span>}
                        <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                        {c.duration_seconds && <span className="text-xs text-gray-400">{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">{c.qualification_score}/100</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[c.qualification_tier]}`}>{c.qualification_tier}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 line-clamp-3">{c.transcript}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Script Generator */}
      {tab === 'Script Generator' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">AI Script Generator (Ollama / llama3.2)</p>
            <p className="mt-1 text-xs text-blue-700">
              Uses local Ollama to draft call scripts. Requires llama3.2 model at OLLAMA_BASE_URL.
              Generated scripts are drafts — review and edit before using with customers.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Generate a Call Script</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Call Purpose</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                  {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={generateScript}
              disabled={generatingScript}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generatingScript ? 'Generating…' : 'Generate Script'}
            </button>
            {scriptError && <p className="text-sm text-red-600">{scriptError}</p>}
            {generatedScript && (
              <div className="space-y-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <textarea
                    value={generatedScript}
                    onChange={e => setGeneratedScript(e.target.value)}
                    className="w-full rounded border border-gray-200 p-3 text-sm text-gray-800 font-mono resize-y min-h-48 bg-white"
                  />
                </div>
                <p className="text-xs text-gray-400">This is a draft — edit as needed before use.</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Automated Script Refresh</h2>
            <p className="text-sm text-gray-600">
              <span className="font-mono text-xs">VoiceAiScriptRefreshJob</span> runs weekly (Sunday 4am) and
              uses Ollama to re-draft scripts for all three call purposes in English.
              Drafts are stored with <span className="font-mono text-xs">status=draft</span> pending admin review.
            </p>
          </div>
        </div>
      )}

      {/* Report */}
      {tab === 'Report' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Calls" value={total} />
            <KpiCard label="Hot Leads" value={hot} sub={total ? `${Math.round((hot / total) * 100)}%` : 'N/A'} />
            <KpiCard label="Warm Leads" value={warm} />
            <KpiCard label="Avg Qualification" value={`${avgScore}/100`} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Lead Tier Breakdown</h2>
            {(['hot', 'warm', 'cold'] as const).map(tier => {
              const count = calls.filter(c => c.qualification_tier === tier).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={tier} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{tier}</span>
                    <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-red-400" style={{ width: `${pct}%`, opacity: tier === 'hot' ? 1 : tier === 'warm' ? 0.6 : 0.3 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Inbound vs. Outbound</h2>
            {(['inbound', 'outbound'] as const).map(dir => {
              const count = calls.filter(c => c.direction === dir).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={dir} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{dir}</span>
                    <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-purple-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline */}
      {tab === 'Pipeline' && (
        <div className="space-y-4">
          {[
            { name: 'VoiceAiScriptRefreshJob', schedule: 'Weekly — Sunday 4am', description: 'Re-drafts call scripts using local Ollama (llama3.2) for all three call purposes. Skips if Ollama is not reachable.', status: 'active' },
          ].map(job => (
            <div key={job.name} className="rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-gray-800">{job.name}</p>
                  <p className="text-xs text-gray-500">{job.schedule}</p>
                  <p className="mt-1 text-sm text-gray-600">{job.description}</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{job.status}</span>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
            <p className="font-medium">Voice provider integration (planned)</p>
            <p className="mt-1">Inbound/outbound telephony via Twilio requires TWILIO_AUTH_TOKEN + TWILIO_ACCOUNT_SID.
            Once configured, real call recordings and auto-transcriptions can replace manual entries.</p>
          </div>
        </div>
      )}
    </div>
  );
}
