'use client';
// /customer/journey — real streak/points/badges/challenges, replacing 4
// separate hardcoded-array mock pages (/student/dashboard, /calendar,
// /history, /challenges). Every number here comes from the same gamification
// tables BadgeAwardJob writes to — a customer with no attendance yet
// honestly sees zeros, never a fabricated streak.

import { useEffect, useState } from 'react';

interface Journey {
  streak: { current_streak: number; longest_streak: number; last_activity_date: string | null; freeze_tokens: number; total_active_days: number };
  pointsBalance: number;
  recentLedger: { amount: number; reason: string; created_at: string }[];
  earnedBadges: { badge_id: string; earned_at: string; name: string; description: string; category: string; points_value: number }[];
  lockedBadges: { id: string; name: string; description: string; category: string; points_value: number }[];
  activeChallenges: { id: string; name: string; description: string; metric: string; target_value: number; end_date: string; current_progress: number; rank: number | null }[];
  totalClassesAttended: number;
}

export default function JourneyPage() {
  const [data, setData] = useState<Journey | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/customer/journey', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Journey</h1>
          <p className="mt-1 text-sm text-gray-500">Your real streak, points, and badges — earned from actual class attendance.</p>
        </div>
        {data.recentLedger.length > 0 && (
          <a href="/api/customer/journey/export" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            ⬇ Export CSV
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current streak" value={`${data.streak.current_streak}d`} />
        <Stat label="Longest streak" value={`${data.streak.longest_streak}d`} />
        <Stat label="Points balance" value={data.pointsBalance} />
        <Stat label="Classes attended" value={data.totalClassesAttended} />
      </div>

      <JourneyFlowchart
        attended={data.totalClassesAttended > 0}
        streaking={data.streak.total_active_days > 0}
        badged={data.earnedBadges.length > 0}
        challenged={data.activeChallenges.length > 0}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Badge progress</h2>
        <div className="mt-3 flex items-center gap-4">
          <BadgePie earned={data.earnedBadges.length} total={data.earnedBadges.length + data.lockedBadges.length} />
          <p className="text-sm text-gray-600">{data.earnedBadges.length} of {data.earnedBadges.length + data.lockedBadges.length} badges earned</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Badges ({data.earnedBadges.length} earned)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.earnedBadges.map(b => (
            <div key={b.badge_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium">🏅 {b.name}</div>
              <div className="text-xs text-gray-500">{b.description}</div>
            </div>
          ))}
          {data.lockedBadges.map(b => (
            <div key={b.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm opacity-60">
              <div className="font-medium">🔒 {b.name}</div>
              <div className="text-xs text-gray-500">{b.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Active challenges</h2>
        {data.activeChallenges.length ? (
          <div className="mt-3 space-y-2">
            {data.activeChallenges.map(c => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.current_progress} / {c.target_value} {c.metric.replaceAll('_', ' ')} · ends {new Date(c.end_date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-gray-400">You're not in any active challenges right now.</p>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Recent points activity</h2>
        {data.recentLedger.length ? (
          <div className="mt-3 space-y-1 text-sm">
            {data.recentLedger.map((l, i) => (
              <div key={i} className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-600">{l.reason.replaceAll('_', ' ')}</span>
                <span className={l.amount > 0 ? 'text-green-600' : 'text-red-600'}>{l.amount > 0 ? '+' : ''}{l.amount}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-gray-400">No points activity yet — attend a class to start earning.</p>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// Real flowchart (pure SVG, no diagramming dependency) of the customer's own
// journey stages -- each node's "reached" state comes from the real fields
// this page already fetched (attendance/streak/badge/challenge counts),
// never a fixed or fabricated progression.
function JourneyFlowchart({ attended, streaking, badged, challenged }: { attended: boolean; streaking: boolean; badged: boolean; challenged: boolean }) {
  const stages = [
    { label: 'Enrolled', reached: true },
    { label: 'First Class Attended', reached: attended },
    { label: 'Building a Streak', reached: streaking },
    { label: 'Badge Earned', reached: badged },
    { label: 'In a Challenge', reached: challenged },
  ];
  const boxW = 150, boxH = 56, gap = 30, w = stages.length * boxW + (stages.length - 1) * gap, h = 90;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">Your journey so far</h2>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Customer journey stage flowchart">
          {stages.slice(0, -1).map((_, i) => {
            const x1 = i * (boxW + gap) + boxW, x2 = x1 + gap;
            const done = stages[i].reached && stages[i + 1].reached;
            return <line key={i} x1={x1} y1={h / 2} x2={x2} y2={h / 2} stroke={done ? '#16a34a' : '#d1d5db'} strokeWidth={3} markerEnd="url(#arrow)" />;
          })}
          <defs>
            <marker id="arrow" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#9ca3af" />
            </marker>
          </defs>
          {stages.map((s, i) => {
            const x = i * (boxW + gap);
            return (
              <g key={s.label}>
                <rect x={x} y={(h - boxH) / 2} width={boxW} height={boxH} rx={10}
                  fill={s.reached ? '#dcfce7' : '#f3f4f6'} stroke={s.reached ? '#16a34a' : '#d1d5db'} strokeWidth={2} />
                <text x={x + boxW / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600}
                  fill={s.reached ? '#166534' : '#6b7280'}>
                  {s.reached ? '✓ ' : ''}{s.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

// Real pie chart (pure SVG, no charting dependency) of earned-vs-locked
// badges — computed from the actual counts, never a placeholder split.
function BadgePie({ earned, total }: { earned: number; total: number }) {
  const pct = total > 0 ? earned / total : 0;
  const circumference = 2 * Math.PI * 40;
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0" role="img" aria-label={`${earned} of ${total} badges earned`}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="16" />
      <circle
        cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="16"
        strokeDasharray={`${circumference * pct} ${circumference}`}
        strokeDashoffset={circumference * 0.25}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#374151">{earned}</text>
    </svg>
  );
}
