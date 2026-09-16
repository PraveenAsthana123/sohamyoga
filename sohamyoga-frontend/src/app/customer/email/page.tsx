'use client';

import { useCallback, useEffect, useState } from 'react';

interface Subscriber {
  id: string;
  email: string;
  status: string;
  tags: string[];
  joined_at: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export default function CustomerEmailPage() {
  const [email, setEmail] = useState('');
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const lookup = useCallback(async () => {
    if (!email.includes('@')) return;
    setLoading(true);
    const d = await fetchJson<{ subscribers: Subscriber[] }>(
      `/api/admin/email/subscribers?search=${encodeURIComponent(email)}&limit=1`,
    );
    const found = d?.subscribers?.[0] ?? null;
    setSubscriber(found);
    setLoading(false);
    if (!found) setMsg('No subscription found for that email address.');
    else setMsg('');
  }, [email]);

  const handleOptOut = async () => {
    if (!subscriber) return;
    const r = await fetch('/api/admin/email/subscribers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subscriber.id, status: 'unsubscribed', first_name: subscriber.email, tags: subscriber.tags }),
    });
    if (r.ok) {
      setSubscriber(prev => prev ? { ...prev, status: 'unsubscribed' } : null);
      setMsg('You have been unsubscribed from all marketing emails.');
    }
  };

  const statusColor = (s: string) => s === 'active' ? 'text-green-600' : s === 'unsubscribed' ? 'text-white/60' : 'text-red-500';

  return (
    <div className="min-h-screen bg-white/5 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6 text-white">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Preferences</h1>
          <p className="text-sm text-white/60 mt-1">Manage your email subscriptions and opt-out settings.</p>
        </div>

        <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl p-5 space-y-3 text-white">
          <label className="block text-sm font-medium text-white/80">Look up your subscription</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="your@email.com"
              className="flex-1 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={lookup}
              disabled={loading || !email.includes('@')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              {loading ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          {msg && <p className="text-sm text-white/60">{msg}</p>}
        </div>

        {subscriber && (
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl p-5 space-y-4 text-white">
            <h2 className="text-sm font-semibold text-white/80">Your Subscription</h2>
            <div className="space-y-2 text-sm text-white">
              <div className="flex justify-between">
                <span className="text-white/60">Email</span>
                <span className="font-medium">{subscriber.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Status</span>
                <span className={`font-medium capitalize ${statusColor(subscriber.status)}`}>{subscriber.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Subscribed</span>
                <span>{new Date(subscriber.joined_at).toLocaleDateString()}</span>
              </div>
              {subscriber.tags.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-white/60">Lists</span>
                  <span>{subscriber.tags.join(', ')}</span>
                </div>
              )}
            </div>

            {subscriber.status === 'active' && (
              <div className="border-t pt-4">
                <p className="text-sm text-white/70 mb-3">
                  Unsubscribing will remove you from all marketing and newsletter emails.
                  Transactional emails (receipts, booking confirmations) are unaffected.
                </p>
                <button
                  onClick={handleOptOut}
                  className="px-4 py-2 bg-red-50 hover:bg-red-500/20 text-red-300 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Unsubscribe from all marketing emails
                </button>
              </div>
            )}

            {subscriber.status === 'unsubscribed' && (
              <div className="border-t pt-4">
                <p className="text-sm text-white/60">
                  You are unsubscribed. You will not receive marketing or newsletter emails.
                  Contact support to re-subscribe.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl p-5">
          <h2 className="text-sm font-semibold text-white/80 mb-3">Email History</h2>
          <p className="text-sm text-white/50">
            Demo mode — configure SMTP to track real email delivery history.
            Once live, your received email log (opens, clicks, delivery status) will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
