'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES = ['new', 'contacted', 'qualified', 'customer', 'do_not_call', 'archived'];

export default function ContactStatusForm({ contactId, currentStatus }: { contactId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    setStatus(next);
    setSaving(true);
    try {
      await fetch(`/api/contacts/${contactId}`, {
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
    <div className="space-y-1">
      <label className="text-sm font-medium">Status</label>
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}
