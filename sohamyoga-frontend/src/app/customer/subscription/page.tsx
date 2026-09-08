'use client';
// /customer/subscription — real self-service, reusing the same Subscription
// state-machine class the admin route uses. Previously "subscription
// management" was missing entirely.

import { useEffect, useState } from 'react';

interface Sub {
  id: string; planId: string; planName: string; status: string; billingCycle: string; billingAmount: number; currency: string;
  expiresAt: string; renewsAt: string | null; autoRenew: boolean; cancelledAt: string | null; cancelReason: string | null;
  pendingDowngradePlanId: string | null;
}
interface Plan { id: string; name: string; slug: string; planType: string }

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700', trial: 'bg-blue-100 text-blue-700', paused: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500', expired: 'bg-red-100 text-red-700', grace_period: 'bg-amber-100 text-amber-700', frozen: 'bg-gray-100 text-gray-500',
};

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [downgradeTo, setDowngradeTo] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = () => fetch('/api/customer/subscription', { cache: 'no-store' }).then(r => r.json()).then(d => setSub(d.subscription));
  useEffect(() => { load(); fetch('/api/plans').then(r => r.json()).then(d => setPlans(d.plans ?? [])); }, []);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setMessage('Saving…');
    const res = await fetch('/api/customer/subscription', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    const d = await res.json();
    setMessage(res.ok ? 'Updated.' : d.error);
    if (res.ok) load();
  }

  if (sub === undefined) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your membership.</p>
      </div>

      {!sub ? (
        <p className="text-sm text-gray-400">No active subscription. <a href="/payments" className="text-blue-600 underline">Browse plans</a>.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">{sub.planName}</div>
              <div className="text-sm text-gray-500">${sub.billingAmount} {sub.currency} / {sub.billingCycle}</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs ${STATUS_COLOR[sub.status] ?? 'bg-gray-100'}`}>{sub.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {sub.status === 'cancelled' ? `Cancelled ${sub.cancelledAt ? new Date(sub.cancelledAt).toLocaleDateString() : ''}${sub.cancelReason ? ` — ${sub.cancelReason}` : ''}`
              : `${sub.autoRenew ? 'Renews' : 'Expires'} ${new Date(sub.renewsAt ?? sub.expiresAt).toLocaleDateString()}`}
          </p>

          {sub.pendingDowngradePlanId && (
            <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Scheduled to switch to <strong>{plans.find(p => p.id === sub.pendingDowngradePlanId)?.name ?? 'a different plan'}</strong> at your next billing cycle.
            </p>
          )}
          {['active', 'trial'].includes(sub.status) && (
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sub.autoRenew} onChange={e => act('setAutoRenew', { enabled: e.target.checked })} /> Auto-renew
              </label>
              <button onClick={() => act('pause', { reason: 'Customer requested pause' })} className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-700">Pause</button>
              {plans.length > 0 && (
                <div className="flex gap-2">
                  <select value={downgradeTo} onChange={e => setDowngradeTo(e.target.value)} className="flex-1 rounded border p-2 text-sm">
                    <option value="">Switch plan at next renewal…</option>
                    {plans.filter(p => p.id !== sub.planId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button disabled={!downgradeTo} onClick={() => act('scheduleDowngrade', { planId: downgradeTo })} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">Schedule</button>
                </div>
              )}
              <div className="flex gap-2">
                <input placeholder="Reason for cancelling" className="flex-1 rounded border p-2 text-sm" value={reason} onChange={e => setReason(e.target.value)} />
                <button disabled={!reason.trim()} onClick={() => act('cancel', { reason })} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">Cancel</button>
              </div>
            </div>
          )}
          {sub.status === 'paused' && (
            <button onClick={() => act('resume')} className="mt-4 rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Resume</button>
          )}
          {message && <p className="mt-2 text-sm text-gray-500">{message}</p>}
        </div>
      )}
    </div>
  );
}
