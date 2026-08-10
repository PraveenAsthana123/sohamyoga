'use client';
import { useState } from 'react';

type Tab = 'overview' | 'journeys' | 'goals' | 'habits' | 'milestones' | 'analytics' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview'    },
  { id: 'journeys',     label: 'Journeys'    },
  { id: 'goals',        label: 'Goals'       },
  { id: 'habits',       label: 'Habits'      },
  { id: 'milestones',   label: 'Milestones'  },
  { id: 'analytics',    label: 'Analytics'   },
  { id: 'integrations', label: 'Integrations'},
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const KPI = [
  { label: 'Total Journeys',       value: '1,847',  sub: '342 started this month',   color: 'text-amber-600'  },
  { label: 'Active Streaks',       value: '892',    sub: 'avg streak 12 days',       color: 'text-green-600'  },
  { label: 'Longest Streak',       value: '184 days',sub: 'Priya S. — still going', color: 'text-blue-600'   },
  { label: 'Goals Achieved',       value: '3,421',  sub: '68% completion rate',      color: 'text-purple-600' },
  { label: 'Milestones Earned',    value: '12,840', sub: '74% claimed',              color: 'text-teal-600'   },
  { label: 'Avg Weekly Minutes',   value: '138 min',sub: 'target: 120 min',         color: 'text-rose-600'   },
  { label: 'Ambassadors',          value: '47',     sub: '2.5% of all members',      color: 'text-indigo-600' },
];

const JOURNEYS = [
  { id: 'J-1001', customer: 'Anjali Mehta',   phase: 'intermediate', status: 'in_progress', streak: 21, sessions: 64, goals: 3, milestones: 8 },
  { id: 'J-1002', customer: 'Raj Patel',       phase: 'beginner',     status: 'in_progress', streak: 7,  sessions: 12, goals: 2, milestones: 2 },
  { id: 'J-1003', customer: 'Emma Wilson',     phase: 'advanced',     status: 'in_progress', streak: 45, sessions: 180, goals: 5, milestones: 14 },
  { id: 'J-1004', customer: 'Fatima Al-Sayed', phase: 'ambassador',   status: 'in_progress', streak: 184, sessions: 520, goals: 7, milestones: 22 },
  { id: 'J-1005', customer: 'Carlos Rivera',   phase: 'onboarding',   status: 'new',         streak: 0,  sessions: 0,  goals: 1, milestones: 0 },
  { id: 'J-1006', customer: 'Min-Ji Park',     phase: 'beginner',     status: 'paused',      streak: 0,  sessions: 8,  goals: 2, milestones: 1 },
];

const GOALS = [
  { id: 'G-1', customer: 'Anjali Mehta',   type: 'flexibility',     progress: 80, status: 'active',    targetDate: '2026-11-30' },
  { id: 'G-2', customer: 'Emma Wilson',    type: 'stress_relief',   progress: 100, status: 'achieved',  targetDate: '2026-07-31' },
  { id: 'G-3', customer: 'Raj Patel',      type: 'general_fitness', progress: 35, status: 'active',    targetDate: '2026-12-31' },
  { id: 'G-4', customer: 'Fatima Al-Sayed',type: 'strength',        progress: 90, status: 'active',    targetDate: '2026-09-30' },
  { id: 'G-5', customer: 'Carlos Rivera',  type: 'mindfulness',     progress: 0,  status: 'active',    targetDate: '2026-10-31' },
];

const HABITS = [
  { type: 'morning_yoga',    completionPct: 84, avgStreak: 12, topStreak: 45, activeUsers: 634 },
  { type: 'meditation',      completionPct: 71, avgStreak: 9,  topStreak: 60, activeUsers: 520 },
  { type: 'breathwork',      completionPct: 62, avgStreak: 7,  topStreak: 30, activeUsers: 380 },
  { type: 'water_intake',    completionPct: 78, avgStreak: 11, topStreak: 90, activeUsers: 290 },
  { type: 'journaling',      completionPct: 54, avgStreak: 6,  topStreak: 21, activeUsers: 210 },
  { type: 'sleep_target',    completionPct: 68, avgStreak: 8,  topStreak: 30, activeUsers: 180 },
];

const MILESTONES = [
  { type: 'first_class',    earned: 847, claimed: 847, reward: 'badge',      claimRate: 100 },
  { type: 'streak_7',       earned: 634, claimed: 580, reward: 'badge',      claimRate: 91  },
  { type: 'classes_10',     earned: 521, claimed: 490, reward: 'badge',      claimRate: 94  },
  { type: 'streak_30',      earned: 312, claimed: 295, reward: 'coupon',     claimRate: 95  },
  { type: 'classes_50',     earned: 198, claimed: 180, reward: 'free_class', claimRate: 91  },
  { type: 'year_anniversary',earned: 89,  claimed: 82,  reward: 'certificate',claimRate: 92  },
  { type: 'streak_90',      earned: 67,  claimed: 61,  reward: 'gift',       claimRate: 91  },
  { type: 'streak_365',     earned: 12,  claimed: 12,  reward: 'certificate',claimRate: 100 },
];

const PHASE_COLOR: Record<string, string> = {
  onboarding:   'bg-gray-100 text-gray-600',
  beginner:     'bg-blue-100 text-blue-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced:     'bg-purple-100 text-purple-700',
  ambassador:   'bg-green-100 text-green-700',
};

const STATUS_BADGE: Record<string, string> = {
  new:         'bg-gray-100 text-gray-500',
  in_progress: 'bg-green-100 text-green-700',
  paused:      'bg-amber-100 text-amber-700',
  completed:   'bg-blue-100 text-blue-700',
  active:      'bg-green-100 text-green-700',
  achieved:    'bg-blue-100 text-blue-700',
  abandoned:   'bg-red-100 text-red-600',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function JourneyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Journey Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Wave 16 · Phases · Goals · Habits · Milestones · Streaks · Rewards
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
              Bulk Award Milestone
            </button>
            <button className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
              Export Journey Data
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {KPI.map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Phase funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Journey Phase Funnel</h3>
              <div className="space-y-2">
                {[
                  { phase: 'Onboarding',   count: 1847, pct: 100 },
                  { phase: 'Beginner',     count: 1240, pct: 67  },
                  { phase: 'Intermediate', count: 620,  pct: 34  },
                  { phase: 'Advanced',     count: 210,  pct: 11  },
                  { phase: 'Ambassador',   count: 47,   pct: 2.5 },
                ].map(p => (
                  <div key={p.phase} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-28 flex-shrink-0">{p.phase}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-amber-400 h-3 rounded-full" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-16 text-right">{p.count.toLocaleString()}</span>
                    <span className="text-gray-400 w-10 text-right text-xs">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Onboarding wizard steps */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Welcome Wizard — Completion by Step</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { step: 1, label: 'Profile Setup',        pct: 98 },
                  { step: 2, label: 'Health Questionnaire', pct: 87 },
                  { step: 3, label: 'Yoga Goal Selection',  pct: 82 },
                  { step: 4, label: 'Style Preferences',    pct: 79 },
                  { step: 5, label: 'First Class Booked',   pct: 64 },
                ].map(s => (
                  <div key={s.step} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Step {s.step}</p>
                    <p className="text-xs font-medium text-gray-700 mb-2">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.pct > 80 ? 'text-green-600' : s.pct > 70 ? 'text-amber-600' : 'text-red-600'}`}>{s.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Journeys ── */}
        {activeTab === 'journeys' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['ID','Customer','Phase','Status','Streak','Sessions','Goals','Milestones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {JOURNEYS.map(j => (
                  <tr key={j.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{j.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{j.customer}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_COLOR[j.phase]}`}>{j.phase}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[j.status]}`}>{j.status}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-600">{j.streak > 0 ? `🔥 ${j.streak}d` : '—'}</td>
                    <td className="px-4 py-3">{j.sessions}</td>
                    <td className="px-4 py-3">{j.goals}</td>
                    <td className="px-4 py-3">{j.milestones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Goals ── */}
        {activeTab === 'goals' && (
          <div className="space-y-3">
            {GOALS.map(g => (
              <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{g.customer}</p>
                    <p className="text-xs text-amber-600 font-medium capitalize mt-0.5">{g.type.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Target: {g.targetDate}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status]}`}>{g.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${g.progress === 100 ? 'bg-blue-400' : g.progress > 60 ? 'bg-green-400' : g.progress > 30 ? 'bg-amber-400' : 'bg-gray-300'}`}
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-10 text-right">{g.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Habits ── */}
        {activeTab === 'habits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HABITS.map(h => (
              <div key={h.type} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="font-semibold text-gray-900 capitalize mb-4">{h.type.replace(/_/g, ' ')}</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Completion Rate</span>
                    <span className={`font-bold ${h.completionPct > 75 ? 'text-green-600' : 'text-amber-600'}`}>{h.completionPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${h.completionPct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Avg Streak</p>
                      <p className="font-semibold">{h.avgStreak}d</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Top Streak</p>
                      <p className="font-semibold text-amber-600">{h.topStreak}d</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Users</p>
                      <p className="font-semibold">{h.activeUsers}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Milestones ── */}
        {activeTab === 'milestones' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Milestone','Reward Type','Earned','Claimed','Claim Rate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {MILESTONES.map(m => (
                  <tr key={m.type} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 capitalize">{m.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{m.reward}</span>
                    </td>
                    <td className="px-4 py-3">{m.earned}</td>
                    <td className="px-4 py-3">{m.claimed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-24">
                          <div className={`h-2 rounded-full ${m.claimRate > 90 ? 'bg-green-400' : 'bg-amber-400'}`} style={{ width: `${m.claimRate}%` }} />
                        </div>
                        <span className="font-semibold text-gray-700">{m.claimRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Goal Completion Rate', value: '68%',    color: 'text-green-600' },
                { label: 'Avg Journey Duration', value: '8.4 mo', color: 'text-blue-600'  },
                { label: 'Phase Advance Rate',   value: '34%',    color: 'text-purple-600'},
                { label: 'Reward Claim Rate',    value: '74%',    color: 'text-amber-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Goal type distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Goal Type Distribution</h3>
              <div className="space-y-2">
                {[
                  { type: 'Stress Relief',    pct: 38 },
                  { type: 'Flexibility',      pct: 29 },
                  { type: 'General Fitness',  pct: 18 },
                  { type: 'Mindfulness',      pct: 15 },
                  { type: 'Strength',         pct: 12 },
                  { type: 'Sleep',            pct: 10 },
                  { type: 'Injury Recovery',  pct: 6  },
                  { type: 'Spiritual',        pct: 4  },
                  { type: 'Weight Loss',      pct: 3  },
                ].map(g => (
                  <div key={g.type} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-36 flex-shrink-0">{g.type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${g.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-8 text-right">{g.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            {/* MCP Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">MCP Tool Registry — 13 Tools</h3>
              <div className="space-y-2">
                {[
                  { name: 'get_journey_summary',   tier: 'auto',              desc: 'Phase distribution, avg streak, completion rate' },
                  { name: 'get_milestone_stats',   tier: 'auto',              desc: 'Aggregate milestone counts and reward types' },
                  { name: 'get_customer_journey',  tier: 'staff',             desc: 'Full journey detail: phase, goals, streak, milestones' },
                  { name: 'advance_journey_phase', tier: 'staff',             desc: 'Manually advance customer to next phase' },
                  { name: 'award_milestone',       tier: 'staff',             desc: 'Award milestone reward for manual achievements' },
                  { name: 'update_weekly_target',  tier: 'staff',             desc: 'Update weekly practice target in minutes' },
                  { name: 'get_habit_report',      tier: 'staff',             desc: '30-day habit completion report for a customer' },
                  { name: 'reset_journey',         tier: 'customer_confirm',  desc: 'Reset to onboarding — loses streak [RESET_JOURNEY]' },
                  { name: 'get_health_profile',    tier: 'staff_approval',    desc: 'Health conditions, injuries, medications — PII' },
                  { name: 'export_journey_data',   tier: 'staff_approval',    desc: 'Full journey export for data portability requests' },
                  { name: 'bulk_award_milestones', tier: 'admin',             desc: 'Bulk-award milestones to qualifying customers' },
                  { name: 'get_journey_analytics', tier: 'admin',             desc: 'Retention, phase funnel, goal completion rates' },
                  { name: 'delete_journey_data',   tier: 'admin_destructive', desc: 'Permanent GDPR erasure [DELETE_JOURNEY]' },
                ].map(t => {
                  const tierColor: Record<string, string> = {
                    auto:              'bg-gray-100 text-gray-600',
                    staff:             'bg-blue-100 text-blue-700',
                    customer_confirm:  'bg-yellow-100 text-yellow-700',
                    staff_approval:    'bg-orange-100 text-orange-700',
                    admin:             'bg-purple-100 text-purple-700',
                    admin_destructive: 'bg-red-100 text-red-700',
                  };
                  return (
                    <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <code className="text-xs font-mono text-gray-800 w-48 flex-shrink-0">{t.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tierColor[t.tier]}`}>{t.tier}</span>
                      <span className="text-xs text-gray-500">{t.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DB Tables + Coming up */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">DB Tables</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['customer_journey','wellness_goal','habit_entry','milestone_reward','journey_audit'].map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">DB Views</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['v_journey_summary','v_habit_streaks','v_milestone_funnel'].map(v => (
                    <span key={v} className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Upcoming Waves</h3>
                <div className="space-y-1.5 text-sm">
                  {[
                    { wave: 'Wave 17', name: 'Health & Wellness',    desc: 'Medical history, wearables, BMI, sleep, mood' },
                    { wave: 'Wave 18', name: 'Advanced AI Coach',    desc: 'Pose correction, breathing coach, injury risk' },
                    { wave: 'Wave 19', name: 'Yoga-Specific Library',desc: 'Asana, mudra, pranayama, sequence builder' },
                    { wave: 'Wave 20', name: 'Enterprise Features',  desc: 'Multi-tenancy, franchise, corporate wellness' },
                  ].map(w => (
                    <div key={w.wave} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex-shrink-0">{w.wave}</span>
                      <div>
                        <p className="font-medium text-gray-800 text-xs">{w.name}</p>
                        <p className="text-xs text-gray-500">{w.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
