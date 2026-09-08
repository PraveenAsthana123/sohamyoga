'use client';
// Real Loyalty Admin Portal -- loyalty_transaction/loyalty_earn_rule had
// real write paths (booking check-in earn trigger) but no admin view
// existed anywhere: no way to see the ledger, no way to change the
// hardcoded 10-points-per-class rule. First real build.

import { useEffect, useState } from 'react';

interface EarnRule { id: string; eventType: string; pointsAwarded: number; isActive: boolean; updatedAt: string }
interface Transaction { id: string; customerEmail: string; amount: number; balanceAfter: number; reason: string; createdAt: string }
interface RewardItem { id: string; name: string; description: string | null; points_cost: number; is_active: boolean; stock: number | null }

export default function LoyaltyAdminPage() {
  const [rules, setRules] = useState<EarnRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [showNewReward, setShowNewReward] = useState(false);
  const [newReward, setNewReward] = useState({ name: '', description: '', pointsCost: '100', stock: '' });

  const load = () => {
    fetch('/api/admin/loyalty/rules', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRules(d?.rules ?? []));
    fetch('/api/admin/loyalty/transactions', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setTransactions(d?.transactions ?? []));
    fetch('/api/admin/loyalty/rewards', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRewards(d?.rewards ?? []));
  };
  useEffect(load, []);

  async function createReward(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/admin/loyalty/rewards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newReward.name, description: newReward.description || undefined,
        pointsCost: Number(newReward.pointsCost), stock: newReward.stock ? Number(newReward.stock) : null,
      }),
    });
    setShowNewReward(false);
    setNewReward({ name: '', description: '', pointsCost: '100', stock: '' });
    load();
  }

  async function saveRule(rule: EarnRule) {
    const points = Number(edits[rule.id] ?? rule.pointsAwarded);
    if (!points || points <= 0) return;
    await fetch('/api/admin/loyalty/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: rule.eventType, pointsAwarded: points, isActive: rule.isActive }),
    });
    load();
  }

  async function toggleActive(rule: EarnRule) {
    await fetch('/api/admin/loyalty/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: rule.eventType, pointsAwarded: rule.pointsAwarded, isActive: !rule.isActive }),
    });
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real earn rules and ledger — points are credited automatically on real class check-in.</p>
      </div>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Earn Rules</h2>
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <span className="w-40 font-medium text-gray-700">{r.eventType.replaceAll('_', ' ')}</span>
              <input
                value={edits[r.id] ?? r.pointsAwarded}
                onChange={e => setEdits(x => ({ ...x, [r.id]: e.target.value }))}
                type="number" min={1} className="w-20 border rounded px-2 py-1"
              />
              <span className="text-gray-400">pts</span>
              <button onClick={() => saveRule(r)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Save</button>
              <button onClick={() => toggleActive(r)} className={`text-xs px-2 py-1 rounded ${r.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {r.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
          {!rules.length && <p className="text-sm text-gray-400">No earn rules configured.</p>}
        </div>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-900">Reward Catalog</h2>
          <button onClick={() => setShowNewReward(o => !o)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">{showNewReward ? 'Cancel' : '+ Add Reward'}</button>
        </div>
        {showNewReward && (
          <form onSubmit={createReward} className="grid grid-cols-4 gap-2 mb-3 text-sm">
            <input required placeholder="Name" value={newReward.name} onChange={e => setNewReward(r => ({ ...r, name: e.target.value }))} className="border rounded px-2 py-1" />
            <input placeholder="Description" value={newReward.description} onChange={e => setNewReward(r => ({ ...r, description: e.target.value }))} className="border rounded px-2 py-1" />
            <input required type="number" min={1} placeholder="Points cost" value={newReward.pointsCost} onChange={e => setNewReward(r => ({ ...r, pointsCost: e.target.value }))} className="border rounded px-2 py-1" />
            <div className="flex gap-1">
              <input type="number" min={0} placeholder="Stock (optional)" value={newReward.stock} onChange={e => setNewReward(r => ({ ...r, stock: e.target.value }))} className="border rounded px-2 py-1 flex-1" />
              <button type="submit" className="text-xs bg-green-600 text-white px-2 py-1 rounded">Save</button>
            </div>
          </form>
        )}
        <div className="space-y-1.5">
          {rewards.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm border rounded p-2">
              <div>
                <span className="font-medium">{r.name}</span>
                {r.description && <span className="text-xs text-gray-400 ml-2">{r.description}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{r.points_cost} pts</span>
                <span>{r.stock !== null ? `${r.stock} left` : 'unlimited'}</span>
                <span className={r.is_active ? 'text-green-600' : 'text-gray-400'}>{r.is_active ? 'active' : 'inactive'}</span>
              </div>
            </div>
          ))}
          {!rewards.length && <p className="text-xs text-gray-400">No rewards in the catalog yet.</p>}
        </div>
      </section>

      <section className="bg-white border rounded-lg overflow-hidden">
        <h2 className="font-semibold text-gray-900 p-5 pb-0">Recent Ledger Activity</h2>
        <table className="w-full text-sm mt-3">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            {['Customer', 'Amount', 'Balance After', 'Reason', 'When'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(t => (
              <tr key={t.id}>
                <td className="px-4 py-2">{t.customerEmail}</td>
                <td className={`px-4 py-2 font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : ''}{t.amount}</td>
                <td className="px-4 py-2">{t.balanceAfter}</td>
                <td className="px-4 py-2 text-gray-500">{t.reason}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!transactions.length && <p className="text-sm text-gray-400 text-center py-8">No loyalty activity yet.</p>}
      </section>
    </div>
  );
}
