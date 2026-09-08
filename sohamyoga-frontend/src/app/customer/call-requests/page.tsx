'use client';
// /customer/call-requests — self-service Call In (customer will call the
// studio) and Call Out (customer requests a callback). No telephony
// automation exists here, so this creates a real request for staff to act
// on manually — the honest scope for a studio this size.

import { useEffect, useState } from 'react';

interface CallRequest {
  id: string; direction: 'call_in' | 'call_out'; reason: string; phone: string;
  preferred_time: string | null; status: string; outcome_notes: string | null;
  completed_at: string | null; created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled',
};

export default function CustomerCallRequestsPage() {
  const [requests, setRequests] = useState<CallRequest[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ direction: 'call_out' as 'call_in' | 'call_out', phone: '', reason: '', preferredTime: '' });

  const load = () => {
    fetch('/api/customer/call-requests', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRequests(d.requests); })
      .catch(e => setError(e.message));
  };
  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/customer/call-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, preferredTime: form.preferredTime || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setForm({ direction: 'call_out', phone: '', reason: '', preferredTime: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(requestId: string) {
    await fetch('/api/customer/call-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'cancel' }),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Call In / Call Out</h1>
        <p className="text-sm text-gray-500">Let us know you'll be calling in, or ask us to call you back. Our team follows up personally — this isn't an automated dialer.</p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex gap-2">
          <button type="button" onClick={() => setForm({ ...form, direction: 'call_out' })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${form.direction === 'call_out' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500'}`}>
            Please call me
          </button>
          <button type="button" onClick={() => setForm({ ...form, direction: 'call_in' })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${form.direction === 'call_in' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500'}`}>
            I'll call in
          </button>
        </div>
        <input required placeholder="Phone number" className="w-full rounded border border-gray-300 p-2 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input type="datetime-local" className="w-full rounded border border-gray-300 p-2 text-sm text-gray-600" value={form.preferredTime} onChange={e => setForm({ ...form, preferredTime: e.target.value })} />
        <textarea placeholder="What's this about? (optional)" className="w-full rounded border border-gray-300 p-2 text-sm" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        <button disabled={submitting} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Submitting…' : form.direction === 'call_out' ? 'Request a callback' : 'Let us know you\'ll call'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-600">Your requests</h2>
        {requests.map(r => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.direction === 'call_in' ? 'I\'ll call in' : 'Please call me'}</span>
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{STATUS_LABEL[r.status]}</span>
              <p className="mt-1 text-sm text-gray-700">{r.phone}{r.preferred_time ? ` · ${new Date(r.preferred_time).toLocaleString()}` : ''}</p>
              {r.reason && <p className="text-xs text-gray-500">{r.reason}</p>}
              {r.outcome_notes && <p className="mt-1 text-xs text-gray-400">Staff note: {r.outcome_notes}</p>}
            </div>
            {(r.status === 'requested' || r.status === 'scheduled') && (
              <button onClick={() => cancel(r.id)} className="shrink-0 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
            )}
          </div>
        ))}
        {!requests.length && <p className="text-sm text-gray-400">No requests yet.</p>}
      </div>
    </div>
  );
}
