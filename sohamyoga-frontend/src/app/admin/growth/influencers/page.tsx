'use client';
// /admin/growth/influencers — Influencer Engine (Phase D of the
// growth-loop architecture). Cross-platform on purpose — an influencer's
// identity isn't tied to one social platform, unlike viral detection.
// Real value score computed weekly by InfluencerValueJob from actual
// referral attribution (migration-052 referral domain); an influencer with
// no referral code issued yet is honestly shown as insufficient_data
// rather than a fabricated score.

import { useEffect, useState } from 'react';

interface Influencer {
  id: string; handle: string; platform: string; followerCount: number; engagementRate: number | null;
  tier: string; status: string; hasReferralCode: boolean; referralCount: number; revenueAttributed: number;
  valueScore: number; valueStatus: string; aiNote: string | null;
}

const TIER_STYLE: Record<string, string> = {
  nano: 'bg-gray-100 text-gray-700', micro: 'bg-blue-100 text-blue-700', mid: 'bg-indigo-100 text-indigo-700',
  macro: 'bg-purple-100 text-purple-700', mega: 'bg-pink-100 text-pink-700',
};

export default function InfluencersPage() {
  const [data, setData] = useState<{ hasData: boolean; influencers: Influencer[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/growth/influencers', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Influencers</h1>
        <p className="text-sm text-gray-500">
          Real value score from referral attribution (migration-052 referral domain) — never a fabricated reach/engagement number.
        </p>
      </header>

      {!data.hasData ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          No influencer profiles yet. Add one to influencer_profile (handle, platform, referral_code_id once a code is issued), then run
          "influencer-value" from the Demo Hub's Use Case Catalog.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Handle', 'Platform', 'Tier', 'Followers', 'Referrals', 'Revenue', 'Value Score', 'Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.influencers.map(inf => (
                <tr key={inf.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">@{inf.handle}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{inf.platform.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[inf.tier] ?? ''}`}>{inf.tier}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inf.followerCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{inf.referralCount}</td>
                  <td className="px-4 py-3 text-gray-600">${inf.revenueAttributed.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {inf.valueStatus === 'insufficient_data'
                      ? <span className="text-xs font-normal text-gray-400">insufficient data{!inf.hasReferralCode ? ' — no code issued' : ''}</span>
                      : inf.valueScore}
                  </td>
                  <td className="px-4 py-3 max-w-xs text-xs text-gray-500">{inf.aiNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
