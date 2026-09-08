'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VapiConfig {
  modelProvider: string; model: string; voiceProvider: string; voiceId: string;
  transcriberProvider: string; transcriberModel: string; transcriberLanguage: string;
  endCallMessage: string; silenceTimeoutSeconds: number; maxDurationSeconds: number;
}

// Real, editable Vapi assistant config -- model/voice/transcriber/limits.
// Saving here only updates the local DB; press "Sync to Vapi" afterward to
// push it to the real assistant.
export default function VapiConfigEditor({ scriptId, versionId, config }: { scriptId: string; versionId: string; config: VapiConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VapiConfig>(key: K, value: VapiConfig[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions/${versionId}/vapi-config`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Could not save config.'); return; }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs opacity-60 underline">advanced Vapi config</button>;

  return (
    <div className="border border-black/10 dark:border-white/10 rounded p-3 space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="opacity-60">Model provider</span>
          <input value={form.modelProvider} onChange={e => set('modelProvider', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Model</span>
          <input value={form.model} onChange={e => set('model', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Voice provider</span>
          <input value={form.voiceProvider} onChange={e => set('voiceProvider', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Voice id</span>
          <input value={form.voiceId} onChange={e => set('voiceId', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Transcriber provider</span>
          <input value={form.transcriberProvider} onChange={e => set('transcriberProvider', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Transcriber model</span>
          <input value={form.transcriberModel} onChange={e => set('transcriberModel', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Transcriber language</span>
          <input value={form.transcriberLanguage} onChange={e => set('transcriberLanguage', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">End call message</span>
          <input value={form.endCallMessage} onChange={e => set('endCallMessage', e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Silence timeout (s)</span>
          <input type="number" value={form.silenceTimeoutSeconds} onChange={e => set('silenceTimeoutSeconds', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="space-y-1">
          <span className="opacity-60">Max duration (s)</span>
          <input type="number" value={form.maxDurationSeconds} onChange={e => set('maxDurationSeconds', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
        </label>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save config'}
        </button>
        <button onClick={() => setOpen(false)} className="opacity-60">close</button>
      </div>
    </div>
  );
}
