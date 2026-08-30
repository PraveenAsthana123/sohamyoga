'use client';

import { useState } from 'react';

export default function RegisterForm({ eventId }: { eventId: string }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('busy'); setMessage(null);
    const res = await fetch(`/api/events/${eventId}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: phone || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setStatus('done'); setMessage(body.message ?? 'Registered.'); }
    else { setStatus('error'); setMessage(body.error ?? 'Registration failed.'); }
  }

  if (status === 'done') return <p className="text-green-700 font-medium">{message}</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full border rounded-lg px-3 py-2" />
      <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border rounded-lg px-3 py-2" />
      {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
      <button type="submit" disabled={status === 'busy'} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
        {status === 'busy' ? 'Registering…' : 'Register'}
      </button>
    </form>
  );
}
