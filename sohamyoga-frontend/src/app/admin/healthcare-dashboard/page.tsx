'use client';
// Real health/safety aggregate dashboard -- emergency contact coverage,
// wellness score distribution, and low-mood flags. Every number is a live
// query; a low mood_after entry is surfaced as a signal to review, never
// as a diagnosis or fabricated risk score.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Data {
  emergencyContactCoverage: { totalActiveStudents: number; withEmergencyContact: number; withoutEmergencyContact: number; coveragePct: number };
  wellness: { avgCompositeScore30d: number | null; lowScoreCount30d: number; totalScoredStudents30d: number };
  lowMoodFlags: Array<{ student_id: string; student_name: string; entry_date: string; mood_after: number; notes: string | null }>;
  journalActivityTrend: Array<{ week: string; entries: string }>;
}

export default function HealthcareDashboardPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/admin/healthcare-dashboard', { cache: 'no-store' }).then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const { emergencyContactCoverage: ec, wellness, lowMoodFlags, journalActivityTrend } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Healthcare & Safety Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Real aggregates from emergency contacts, wellness scores, and practice journal entries — no fabricated risk index.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="app-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Emergency Contact Coverage</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{ec.coveragePct}%</p>
          <p className="text-xs text-gray-500">{ec.withEmergencyContact} of {ec.totalActiveStudents} active students</p>
          {ec.withoutEmergencyContact > 0 && (
            <p className="mt-1 text-xs font-medium text-red-600">{ec.withoutEmergencyContact} students have NO emergency contact on file</p>
          )}
        </div>
        <div className="app-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Avg. Wellness Score (30d)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{wellness.avgCompositeScore30d ?? '—'}</p>
          <p className="text-xs text-gray-500">Across {wellness.totalScoredStudents30d} scored students</p>
        </div>
        <div className="app-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Low Wellness Scores (&lt;40)</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{wellness.lowScoreCount30d}</p>
          <p className="text-xs text-gray-500">In the last 30 days</p>
        </div>
      </div>

      <section className="app-card">
        <h2 className="font-semibold text-gray-900">Practice journal activity (8 weeks)</h2>
        <JournalTrendChart data={journalActivityTrend} />
      </section>

      <section className="app-card">
        <h2 className="font-semibold text-gray-900">Low mood flags (last 30 days, mood ≤ 2/5)</h2>
        <p className="mt-1 text-xs text-gray-400">A signal to check in, not a diagnosis.</p>
        <div className="mt-3 space-y-2">
          {lowMoodFlags.map((f, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="flex justify-between">
                <Link href={`/admin/students/${f.student_id}`} className="font-medium text-amber-900 underline">{f.student_name}</Link>
                <span className="text-xs text-amber-700">{new Date(f.entry_date).toLocaleDateString()} · mood {f.mood_after}/5</span>
              </div>
              {f.notes && <p className="mt-1 text-xs text-amber-800">{f.notes}</p>}
            </div>
          ))}
          {!lowMoodFlags.length && <p className="text-sm text-gray-400">No low-mood entries in the last 30 days.</p>}
        </div>
      </section>
    </div>
  );
}

function JournalTrendChart({ data }: { data: Array<{ week: string; entries: string }> }) {
  if (!data.length) return <p className="mt-3 text-sm text-gray-400">No journal activity in the last 8 weeks.</p>;
  const values = data.map(d => Number(d.entries));
  const max = Math.max(...values, 1);
  const w = 500, h = 120, pad = 20;
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
  const points = values.map((v, i) => `${pad + i * step},${h - pad - (v / max) * (h - pad * 2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Practice journal weekly activity trend">
      <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth={2} />
      {values.map((v, i) => (
        <circle key={i} cx={pad + i * step} cy={h - pad - (v / max) * (h - pad * 2)} r={3} fill="#4f46e5" />
      ))}
    </svg>
  );
}
