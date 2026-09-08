'use client';
// Real Admin Portal -- Budget Guardrail Management. marketing_budget_guardrail
// had a real per-channel schema but no admin UI anywhere. First real build --
// config layer only (no live ad-spend ingestion exists yet to enforce against).

import { useEffect, useState } from 'react';

interface Guardrail {
  id: string; channel: string; daily_limit: string | null; monthly_limit: string | null;
  target_cac: string | null; minimum_roas: string | null; auto_pause_enabled: boolean;
  approval_threshold: string | null; currency: string; active: boolean; updated_at: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', instagram: 'Instagram', facebook: 'Facebook',
  tiktok: 'TikTok', linkedin: 'LinkedIn', email: 'Email', sms: 'SMS',
};

export default function BudgetGuardrailsPage() {
  const [channels, setChannels] = useState<string[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Guardrail>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    fetch('/api/admin/marketing/budget-guardrails', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setChannels(d?.channels ?? []); setGuardrails(d?.guardrails ?? []); });
  };
  useEffect(load, []);

  const byChannel = (ch: string) => guardrails.find(g => g.channel === ch);
  const editFor = (ch: string) => edits[ch] ?? {};

  async function save(ch: string) {
    const existing = byChannel(ch);
    const e = editFor(ch);
    setSaving(ch);
    await fetch('/api/admin/marketing/budget-guardrails', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: ch,
        dailyLimit: e.daily_limit ?? existing?.daily_limit ?? null,
        monthlyLimit: e.monthly_limit ?? existing?.monthly_limit ?? null,
        targetCac: e.target_cac ?? existing?.target_cac ?? null,
        minimumRoas: e.minimum_roas ?? existing?.minimum_roas ?? null,
        autoPauseEnabled: e.auto_pause_enabled ?? existing?.auto_pause_enabled ?? false,
        approvalThreshold: e.approval_threshold ?? existing?.approval_threshold ?? null,
        active: e.active ?? existing?.active ?? true,
      }),
    });
    setSaving(null);
    setEdits(x => ({ ...x, [ch]: {} }));
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget Guardrails</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Per-channel spend limits and performance thresholds. Configuration only —
          this app has no live ad-spend feed yet, so auto-pause enforcement will
          activate once real spend ingestion is wired in.
        </p>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            {['Channel', 'Daily Limit', 'Monthly Limit', 'Target CAC', 'Min ROAS', 'Auto-Pause', 'Status', ''].map(h =>
              <th key={h} className="px-3 py-2 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {channels.map(ch => {
              const g = byChannel(ch);
              const e = editFor(ch);
              return (
                <tr key={ch}>
                  <td className="px-3 py-2 font-medium text-gray-700">{CHANNEL_LABELS[ch] ?? ch}</td>
                  {(['daily_limit', 'monthly_limit', 'target_cac', 'minimum_roas'] as const).map(field => (
                    <td key={field} className="px-3 py-2">
                      <input
                        type="number" min={0} step="0.01" placeholder="—"
                        defaultValue={g?.[field] ?? ''}
                        onChange={ev => setEdits(x => ({ ...x, [ch]: { ...x[ch], [field]: ev.target.value ? Number(ev.target.value) : null } }))}
                        className="w-24 border rounded px-2 py-1 text-xs"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox" defaultChecked={g?.auto_pause_enabled ?? false}
                      onChange={ev => setEdits(x => ({ ...x, [ch]: { ...x[ch], auto_pause_enabled: ev.target.checked } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${g?.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g?.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => save(ch)} disabled={saving === ch} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded disabled:opacity-50">
                      {saving === ch ? 'Saving…' : g ? 'Update' : 'Create'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
