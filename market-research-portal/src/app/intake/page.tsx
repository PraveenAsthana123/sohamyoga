'use client';

// Public B2C/B2B intake form. Segment toggle changes which fields are
// required (company name only for B2B) rather than showing one form with
// irrelevant fields to both audiences. A B2C contact that later needs a B2B
// relationship isn't asked to fill this out twice — the admin side converts
// the same submission in place (see /api/intake PATCH convert_to_b2b).

import { useState } from 'react';

export default function IntakePage() {
  const [segment, setSegment] = useState<'b2c' | 'b2b'>('b2c');
  const [form, setForm] = useState({ contactName: '', email: '', phone: '', companyName: '', role: '', useCase: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus('');
    const r = await fetch('/api/intake', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment, ...form }),
    });
    const j = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (r.ok) {
      setStatus('Thanks — we received your submission and will be in touch.');
      setForm({ contactName: '', email: '', phone: '', companyName: '', role: '', useCase: '' });
    } else {
      setStatus(j.error || 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Get Started</h1>
        <p className="text-sm text-gray-500">Tell us a bit about yourself so we can route your request correctly.</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setSegment('b2c')} className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${segment === 'b2c' ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-500'}`}>
          Individual (B2C)
        </button>
        <button type="button" onClick={() => setSegment('b2b')} className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${segment === 'b2b' ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-500'}`}>
          Business (B2B)
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-5">
        <input required placeholder="Your name" className="w-full rounded border p-2 text-sm" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
        <input required type="email" placeholder="Email" className="w-full rounded border p-2 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Phone (optional)" className="w-full rounded border p-2 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        {segment === 'b2b' && (
          <>
            <input required placeholder="Company name" className="w-full rounded border p-2 text-sm" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
            <input placeholder="Your role (optional)" className="w-full rounded border p-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          </>
        )}
        <textarea placeholder="What are you looking for?" className="w-full rounded border p-2 text-sm" value={form.useCase} onChange={e => setForm({ ...form, useCase: e.target.value })} />
        <button disabled={submitting} type="submit" className="w-full rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        {status && <p className="text-sm text-gray-600">{status}</p>}
      </form>
    </div>
  );
}
