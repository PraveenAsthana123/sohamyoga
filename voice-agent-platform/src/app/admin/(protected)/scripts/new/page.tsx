'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CLINIC_SERVICE_TYPES } from '@/domain/script/CallScript';
import { ScriptTemplate } from '@/domain/script/templateRepository';

const SERVICE_TYPES: string[] = CLINIC_SERVICE_TYPES;

export default function NewScriptPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState('dental');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [scenarioKey, setScenarioKey] = useState('');
  const [category, setCategory] = useState('');
  const [opening, setOpening] = useState('');
  const [discoveryQuestions, setDiscoveryQuestions] = useState('');
  const [objectionHandling, setObjectionHandling] = useState('');
  const [closing, setClosing] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);

  useEffect(() => {
    fetch('/api/script-templates').then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
  }, []);

  function applyTemplate(t: ScriptTemplate) {
    setCategory(t.category);
    setDirection(t.direction);
    setOpening(t.opening);
    setDiscoveryQuestions(t.discoveryQuestions.join('\n'));
    setObjectionHandling(t.objectionHandling);
    setClosing(t.closing);
    if (!name) setName(t.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          serviceType,
          direction,
          scenarioKey: scenarioKey.trim() || undefined,
          category: category.trim() || undefined,
          sections: {
            opening,
            discoveryQuestions: discoveryQuestions.split('\n').map((q) => q.trim()).filter(Boolean),
            objectionHandling,
            closing,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not create script.');
        return;
      }
      router.push(`/admin/scripts/${body.script.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New call script</h1>
      {templates.length > 0 && (
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Start from a template (fills in the fields below -- still fully editable)</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="text-xs border border-black/20 dark:border-white/20 rounded-full px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug *</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent font-mono text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Service type *</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
              {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Direction *</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Scenario key</label>
            <input value={scenarioKey} onChange={(e) => setScenarioKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="e.g. appointment_reminder" className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Category (for grouping in the script library)</label>
          <input list="script-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. appointment_reminder" className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          <datalist id="script-categories">
            <option value="appointment_reminder" />
            <option value="lead_followup" />
            <option value="payment_reminder" />
          </datalist>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Opening *</label>
          <textarea required value={opening} onChange={(e) => setOpening(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Discovery questions (one per line)</label>
          <textarea value={discoveryQuestions} onChange={(e) => setDiscoveryQuestions(e.target.value)} rows={4} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Objection handling</label>
          <textarea value={objectionHandling} onChange={(e) => setObjectionHandling(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Closing *</label>
          <textarea required value={closing} onChange={(e) => setClosing(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" disabled={submitting} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : 'Create script (draft v1)'}
        </button>
      </form>
    </div>
  );
}
