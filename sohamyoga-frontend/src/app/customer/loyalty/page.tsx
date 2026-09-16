'use client';
// /customer/loyalty — real tier + loyalty_transaction ledger. Distinct from
// /customer/journey's gamification points (two genuinely different real
// systems: tenant loyalty tiers vs. attendance-based gamification).

import { useEffect, useState } from 'react';

interface Loyalty {
  tier: string; loyaltyPoints: number; lifetimeSpendCad: number;
  allTiers: { code: string; label: string; min_spend_cad: string; discount_pct: number; monthly_bonus_pts: number }[];
  history: { amount: number; balance_after: number; reason: string; created_at: string }[];
}

interface RewardItem { id: string; name: string; description: string | null; points_cost: number; stock: number | null }

export default function LoyaltyPage() {
  const [data, setData] = useState<Loyalty | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = () => {
    fetch('/api/customer/loyalty', { cache: 'no-store' }).then(r => r.json()).then(setData);
    fetch('/api/customer/loyalty/rewards', { cache: 'no-store' }).then(r => r.json()).then(d => setRewards(d.rewards ?? []));
  };
  useEffect(load, []);

  async function redeem(rewardId: string) {
    setRedeeming(rewardId);
    setMessage('');
    const res = await fetch('/api/customer/loyalty/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rewardId }),
    });
    const body = await res.json();
    setRedeeming(null);
    setMessage(res.ok ? `Redeemed! New balance: ${body.newBalance} pts.` : body.error);
    if (res.ok) load();
  }

  if (!data) return <p className="text-sm text-white/40">Loading…</p>;
  const currentTier = data.allTiers.find(t => t.code === data.tier);

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">Loyalty</h1>
        <p className="mt-1 text-sm text-white/60">Your tier and point balance.</p>
      </div>

      <div className="rounded-xl border border-white/20 backdrop-blur-md bg-white/10 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold capitalize text-white">{currentTier?.label ?? data.tier}</div>
            <div className="text-sm text-white/60">{currentTier ? `${currentTier.discount_pct}% discount · +${currentTier.monthly_bonus_pts} pts/month` : ''}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{data.loyaltyPoints}</div>
            <div className="text-xs text-white/60">points</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/40">Lifetime spend: ${data.lifetimeSpendCad.toFixed(2)} CAD</p>
      </div>

      <section className="rounded-xl border border-white/20 backdrop-blur-md bg-white/10 p-5">
        <h2 className="font-semibold text-white">Tiers</h2>
        <div className="mt-3 space-y-1 text-sm text-white">
          {data.allTiers.map(t => (
            <div key={t.code} className={`flex justify-between rounded px-2 py-1 ${t.code === data.tier ? 'bg-blue-50 font-medium' : ''}`}>
              <span className="capitalize">{t.label}</span>
              <span className="text-white/60">${t.min_spend_cad}+ · {t.discount_pct}% off</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/20 backdrop-blur-md bg-white/10 p-5">
        <h2 className="font-semibold text-white">Redeem Points</h2>
        {message && <p className="mt-2 text-xs text-white/70 bg-white/5 rounded p-2">{message}</p>}
        <div className="mt-3 space-y-2 text-white">
          {rewards.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded border border-gray-100 p-2 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                {r.description && <p className="text-xs text-white/40">{r.description}</p>}
              </div>
              <button
                onClick={() => redeem(r.id)}
                disabled={redeeming === r.id || data.loyaltyPoints < r.points_cost}
                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {redeeming === r.id ? 'Redeeming…' : `${r.points_cost} pts`}
              </button>
            </div>
          ))}
          {!rewards.length && <p className="text-sm text-white/40">No rewards available yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-white/20 backdrop-blur-md bg-white/10 p-5">
        <h2 className="font-semibold text-white">Recent activity</h2>
        {data.history.length ? (
          <div className="mt-3 space-y-1 text-sm text-white">
            {data.history.map((h, i) => (
              <div key={i} className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-white/70">{h.reason.replaceAll('_', ' ')}</span>
                <span className={h.amount > 0 ? 'text-green-600' : 'text-red-600'}>{h.amount > 0 ? '+' : ''}{h.amount}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-white/40">No loyalty activity yet.</p>}
      </section>
    </div>
  );
}
