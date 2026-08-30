'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES = ['draft', 'active', 'archived'];

export default function FormStatusControls({ formId, currentStatus }: { formId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    setStatus(next);
    setSaving(true);
    try {
      await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Status:</span>
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="border border-black/20 dark:border-white/20 rounded px-2 py-1 bg-transparent text-sm capitalize"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {status === 'active' && <span className="text-xs text-green-600">Accepting submissions</span>}
    </div>
  );
}
