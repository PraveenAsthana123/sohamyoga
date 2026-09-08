'use client';
// /customer/settings — real per-customer feature opt-out. Toggling a
// feature off here actually hides it from the sidebar (customer/layout.tsx
// reads the same disabled_features array) — not a cosmetic switch.

import { useEffect, useState } from 'react';

interface Feature { key: string; label: string }

export default function SettingsPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/customer/settings', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setFeatures(d.availableFeatures ?? []);
      setDisabled(d.disabledFeatures ?? []);
    });
  }, []);

  async function toggle(key: string) {
    const next = disabled.includes(key) ? disabled.filter(k => k !== key) : [...disabled, key];
    setDisabled(next);
    setMessage('Saving…');
    const res = await fetch('/api/customer/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabledFeatures: next }),
    });
    const d = await res.json();
    setMessage(res.ok ? 'Saved — check the sidebar.' : d.error);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Turn off features you don't want to see. This actually hides them from your sidebar.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        {features.map(f => (
          <label key={f.key} className="flex items-center justify-between text-sm">
            <span>{f.label}</span>
            <input type="checkbox" checked={!disabled.includes(f.key)} onChange={() => toggle(f.key)} className="h-4 w-4" />
          </label>
        ))}
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>
    </div>
  );
}
