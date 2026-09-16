'use client';

import { useEffect, useState, useCallback } from 'react';

interface Kpi {
  total_achievements: number;
  active_streaks: number;
  rewards_redeemed: number;
  top_score: number | null;
}

interface Achievement {
  id: string;
  badge_id: string;
  badge_name: string;
  badge_desc: string | null;
  icon_url: string | null;
  earned_at: string;
  source: string;
}

interface StreakRow {
  id: string;
  user_id: string;
  user_email: string | null;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_active_days: number;
}

interface LeaderboardRow {
  rank: number;
  display_name: string;
  score: number;
  board_type: string;
  board_period: string;
  delta_rank: number;
}

interface Reward30d { reward_type: string; cnt: number; claimed: number }

interface EarnRule { id: string; eventType: string; pointsAwarded: number; isActive: boolean; updatedAt: string }
interface Transaction { id: string; customerEmail: string; amount: number; balanceAfter: number; reason: string; createdAt: string }
interface RewardItem { id: string; name: string; description: string | null; points_cost: number; is_active: boolean; stock: number | null }

const TABS = ['Overview', 'Leaderboard', 'Achievements', 'Streaks', 'Rewards', 'Earn Rules'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function LoyaltyAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streaks, setStreaks] = useState<StreakRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [rewards30d, setRewards30d] = useState<Reward30d[]>([]);
  const [error, setError] = useState('');

  // Legacy sub-route state
  const [rules, setRules] = useState<EarnRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [showNewReward, setShowNewReward] = useState(false);
  const [newReward, setNewReward] = useState({ name: '', description: '', pointsCost: '100', stock: '' });

  const loadGamification = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/loyalty', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setKpi(d.kpi ?? null);
      setAchievements(d.achievements ?? []);
      setStreaks(d.streaks ?? []);
      setLeaderboard(d.leaderboard ?? []);
      setRewards30d(d.rewards30d ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loyalty data');
    }
  }, []);

  const loadLegacy = useCallback(() => {
    fetch('/api/admin/loyalty/rules', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRules(d?.rules ?? []));
    fetch('/api/admin/loyalty/transactions', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setTransactions(d?.transactions ?? []));
    fetch('/api/admin/loyalty/rewards', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRewardItems(d?.rewards ?? []));
  }, []);

  useEffect(() => {
    void loadGamification();
    loadLegacy();
  }, [loadGamification, loadLegacy]);

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
    loadLegacy();
  }

  async function saveRule(rule: EarnRule) {
    const points = Number(edits[rule.id] ?? rule.pointsAwarded);
    if (!points || points <= 0) return;
    await fetch('/api/admin/loyalty/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: rule.eventType, pointsAwarded: points, isActive: rule.isActive }),
    });
    loadLegacy();
  }

  async function toggleActive(rule: EarnRule) {
    await fetch('/api/admin/loyalty/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: rule.eventType, pointsAwarded: rule.pointsAwarded, isActive: !rule.isActive }),
    });
    loadLegacy();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyalty & Gamification</h1>
        <p className="text-gray-500 text-sm mt-1">achievement, streak, leaderboard_entry, reward_transaction — live data.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active Streaks" value={kpi.active_streaks} sub="current_streak > 0" />
          <KpiCard label="Achievements Unlocked" value={kpi.total_achievements} />
          <KpiCard label="Rewards Redeemed" value={kpi.rewards_redeemed} sub="claimed reward_transactions" />
          <KpiCard label="Top Score" value={kpi.top_score != null ? kpi.top_score.toLocaleString() : '—'} sub="leaderboard high" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Reward Activity — Last 30 Days</h3>
              {rewards30d.length > 0 ? (
                <div className="space-y-2">
                  {rewards30d.map(r => (
                    <div key={r.reward_type} className="flex items-center gap-3 text-sm">
                      <span className="w-40 text-gray-600">{r.reward_type}</span>
                      <span className="text-gray-800 font-medium">{r.cnt} issued</span>
                      <span className="text-green-600">{r.claimed} claimed</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No reward transactions in the last 30 days.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Ledger Activity (points)</h3>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Balance After</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">When</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {transactions.slice(0, 10).map(t => (
                        <tr key={t.id}>
                          <td className="px-3 py-2 text-gray-800">{t.customerEmail}</td>
                          <td className={`px-3 py-2 font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : ''}{t.amount}</td>
                          <td className="px-3 py-2 text-gray-600">{t.balanceAfter}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{t.reason}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No loyalty ledger activity yet.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'Leaderboard' && (
          <div className="overflow-x-auto">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No leaderboard entries yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Board</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(e => (
                    <tr key={`${e.board_type}-${e.board_period}-${e.rank}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${e.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {e.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{e.display_name}</td>
                      <td className="px-4 py-3 text-gray-800 font-semibold">{e.score.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.board_type}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.board_period}</td>
                      <td className="px-4 py-3">
                        {e.delta_rank !== 0 && (
                          <span className={`text-xs font-medium ${e.delta_rank < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {e.delta_rank < 0 ? '↑' : '↓'}{Math.abs(e.delta_rank)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Achievements' && (
          <div className="overflow-x-auto">
            {achievements.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No achievements earned yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Badge</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {a.icon_url && <img src={a.icon_url} alt="" className="w-6 h-6 rounded" />}
                          <span className="font-medium text-gray-900">{a.badge_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{a.badge_desc ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.source}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.earned_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Streaks' && (
          <div className="overflow-x-auto">
            {streaks.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No active streaks.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Current Streak</th>
                    <th className="px-4 py-3 font-medium">Longest</th>
                    <th className="px-4 py-3 font-medium">Total Active Days</th>
                    <th className="px-4 py-3 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {streaks.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.display_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{s.user_email ?? s.user_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-orange-600 font-bold">
                          {s.current_streak} days
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.longest_streak} days</td>
                      <td className="px-4 py-3 text-gray-600">{s.total_active_days}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {s.last_activity_date ? new Date(s.last_activity_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Rewards' && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Reward Catalog</h3>
              <button onClick={() => setShowNewReward(o => !o)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded">
                {showNewReward ? 'Cancel' : '+ Add Reward'}
              </button>
            </div>
            {showNewReward && (
              <form onSubmit={createReward} className="grid grid-cols-4 gap-2 text-sm">
                <input required placeholder="Name" value={newReward.name} onChange={e => setNewReward(r => ({ ...r, name: e.target.value }))} className="border rounded px-2 py-1" />
                <input placeholder="Description" value={newReward.description} onChange={e => setNewReward(r => ({ ...r, description: e.target.value }))} className="border rounded px-2 py-1" />
                <input required type="number" min={1} placeholder="Points cost" value={newReward.pointsCost} onChange={e => setNewReward(r => ({ ...r, pointsCost: e.target.value }))} className="border rounded px-2 py-1" />
                <div className="flex gap-1">
                  <input type="number" min={0} placeholder="Stock" value={newReward.stock} onChange={e => setNewReward(r => ({ ...r, stock: e.target.value }))} className="border rounded px-2 py-1 flex-1" />
                  <button type="submit" className="text-xs bg-green-600 text-white px-2 py-1 rounded">Save</button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {rewardItems.map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded-lg p-3 text-sm hover:bg-gray-50">
                  <div>
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.description && <span className="text-xs text-gray-400 ml-2">{r.description}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{r.points_cost} pts</span>
                    <span>{r.stock !== null ? `${r.stock} left` : 'unlimited'}</span>
                    <span className={r.is_active ? 'text-green-600 font-medium' : 'text-gray-400'}>{r.is_active ? 'active' : 'inactive'}</span>
                  </div>
                </div>
              ))}
              {!rewardItems.length && <p className="text-sm text-gray-400">No rewards in the catalog yet.</p>}
            </div>
          </div>
        )}

        {tab === 'Earn Rules' && (
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Points Earn Rules</h3>
            <p className="text-xs text-gray-400">Points are credited automatically on real class check-in. Edit rules here.</p>
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm border rounded-lg p-3">
                <span className="w-48 font-medium text-gray-700">{r.eventType.replaceAll('_', ' ')}</span>
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
            {!rules.length && <p className="text-sm text-gray-400">No earn rules configured yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
