'use client';
// /admin/growth/advocacy — Advocacy Scoring. Third stage of the growth-loop
// architecture (Funnel → Advocacy/Referral → Viral → Influencer). Real
// composite eligibility score per active student, computed weekly by
// AdvocacyScoreJob from NPS, attendance, retention, real referral history,
// and churn risk (a recent problem overrides an old positive score).

import { useEffect, useState } from 'react';

interface Score {
  studentId: string; name: string; npsScore: number | null; attendanceCount: number;
  retentionDays: number; referralCount: number; hasRecentProblem: boolean;
  compositeScore: number; eligibility: string; aiNote: string | null; computedAt: string;
}

const ELIGIBILITY_STYLE: Record<string, string> = {
  strong_candidate: 'bg-green-100 text-green-700 border-green-300',
  nurture: 'bg-blue-100 text-blue-700 border-blue-300',
  wait: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  ineligible: 'bg-gray-100 text-gray-600 border-gray-300',
};

export default function AdvocacyPage() {
  const [data, setData] = useState<{ hasData: boolean; scores: Score[]; eligibleForAskCount?: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/growth/advocacy', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Advocacy Scores</h1>
        <p className="text-sm text-gray-500">
          Real composite eligibility per active student — NPS, attendance, retention, referral history, churn override.
          {data.hasData && ` ${data.eligibleForAskCount} student(s) are strong candidates for a referral ask.`}
        </p>
      </header>

      {!data.hasData ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          No advocacy scores yet — run "advocacy-score" from the Demo Hub's Use Case Catalog.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Student', 'NPS', 'Attendance', 'Retention', 'Referrals', 'Score', 'Eligibility', 'Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.scores.map(s => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.npsScore ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.attendanceCount}</td>
                  <td className="px-4 py-3 text-gray-600">{s.retentionDays}d</td>
                  <td className="px-4 py-3 text-gray-600">{s.referralCount}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {s.compositeScore}
                    {s.hasRecentProblem && <span className="ml-1 text-xs text-red-600">(recent issue)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ELIGIBILITY_STYLE[s.eligibility] ?? ''}`}>
                      {s.eligibility.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs text-xs text-gray-500">{s.aiNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
