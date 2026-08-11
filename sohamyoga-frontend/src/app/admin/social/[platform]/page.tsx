'use client';
// /admin/social/[platform] — per-platform admin page with feature tabs, per
// the user's explicit requirement: "each social media should have separate
// page with list of tabs and each tab should have separate feature."
// Facebook is the only platform ViralDetectionJob currently scores (Phase
// C); Phase E extends the job to loop over every connected platform, at
// which point this same page shell shows real data for that platform too
// with zero new code here.

import { useEffect, useState } from 'react';

interface Signal {
  postId: string; excerpt: string | null; url: string | null;
  shareVelocity: number; likeVelocity: number; commentVelocity: number;
  zScore: number | null; viralScore: number; isViral: boolean; aiNote: string | null; computedAt: string;
}
interface ViralData { platform: string; connectedAccounts: number; publishedPosts: number; signals: Signal[] }

const TABS = ['overview', 'viral-signals', 'influencers'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', 'viral-signals': 'Viral Signals', influencers: 'Influencer Campaigns' };

export default function PlatformSocialPage({ params }: { params: { platform: string } }) {
  const { platform } = params;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<ViralData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/social/${platform}/viral-signals`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, [platform]);

  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, ' ');

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-l-4 border-primary-600 pl-4">
          <h1 className="text-2xl font-bold">{platformLabel}</h1>
          <p className="text-sm text-gray-500">Real viral-detection signals from social_post_analytics — {data.connectedAccounts} connected account(s), {data.publishedPosts} published post(s).</p>
        </header>

        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Connected Accounts</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{data.connectedAccounts}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Published Posts</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">{data.publishedPosts}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Viral Posts (this run)</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{data.signals.filter(s => s.isViral).length}</p>
            </div>
            {data.connectedAccounts === 0 && (
              <div className="col-span-full rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                No {platformLabel} account is connected via Postiz OAuth yet — viral detection needs real posts and analytics before it can report anything. Connect an account, then post and let ViralDetectionJob run (daily 07:00 UTC).
              </div>
            )}
          </div>
        )}

        {activeTab === 'viral-signals' && (
          <section className="overflow-x-auto rounded-xl border bg-white">
            {data.signals.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No posts with at least 2 analytics snapshots yet — ViralDetectionJob needs real, repeated engagement data before it can compute a velocity.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Post', 'Share Velocity/hr', 'Like Velocity/hr', 'Z-Score', 'Viral Score', 'Status', 'Note'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.signals.map(s => (
                    <tr key={s.postId} className={s.isViral ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-700">{s.excerpt ?? s.postId.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-600">{s.shareVelocity.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{s.likeVelocity.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{s.zScore !== null ? s.zScore.toFixed(1) : 'baseline pending'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{s.viralScore}</td>
                      <td className="px-4 py-3">
                        {s.isViral
                          ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Viral</span>
                          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Normal</span>}
                      </td>
                      <td className="px-4 py-3 max-w-xs text-xs text-gray-500">{s.aiNote ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'influencers' && (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
            Influencer campaign tracking for {platformLabel} lands in Phase D — see the cross-platform{' '}
            <a href="/admin/growth/influencers" className="text-blue-600 hover:underline">Influencers</a> page.
          </div>
        )}
      </div>
    </div>
  );
}
