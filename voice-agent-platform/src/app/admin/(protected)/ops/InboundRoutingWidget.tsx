'use client';

import { useEffect, useState } from 'react';

interface VersionOption { versionId: string; scriptName: string; versionNumber: number }

/**
 * Real gap found live: the shared inbound phone number has NO default
 * assistant assigned at all. Setting one is a REAL production change --
 * every future real inbound caller reaches whatever is picked here,
 * immediately. window.confirm() is the same explicit-human-confirmation
 * gate used before placeCall().
 */
export default function InboundRoutingWidget() {
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/inbound-routing').then((r) => r.json()).then((d) => setCurrent(d.assistantId ?? null));
  }, []);

  async function apply() {
    if (!selected) return;
    const confirmed = window.confirm(
      'This changes LIVE production inbound routing for the real shared phone number -- every future real inbound caller will reach this assistant immediately. Continue?'
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/inbound-routing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantId: selected }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setCurrent(data.assistantId);
  }

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-2">
      <h2 className="font-medium">Inbound call routing</h2>
      <p className="text-xs opacity-60">
        {current === undefined ? 'Loading…' : current === null
          ? 'No assistant is currently assigned to the inbound number -- real inbound calls ring with nothing configured to answer them.'
          : `Current inbound assistant id: ${current}`}
      </p>
      <div className="flex gap-2">
        <input
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          placeholder="Vapi assistant id (must be synced from a script version first)"
          className="flex-1 border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent text-sm font-mono"
        />
        <button onClick={apply} disabled={saving || !selected} className="rounded bg-red-600 text-white px-3 py-2 text-sm disabled:opacity-50">
          {saving ? 'Applying…' : 'Set as inbound default'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
