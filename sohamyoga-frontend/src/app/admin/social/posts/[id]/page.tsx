'use client';
// Published Post Detail -- previously no page showed one post's own
// content + its own latest engagement snapshot + viral signal together;
// only cross-post tables existed. Real data only: social_post,
// social_content_draft, social_post_analytics, viral_signal.

import { useEffect, useState } from 'react';

interface PostDetail {
  id: string; platform: string; status: string; scheduledAt: string; publishedAt: string | null;
  externalPostUrl: string | null; failureReason: string | null; masterText: string | null;
  mediaUrls: string[]; contentType: string | null; generatedWithAi: boolean | null;
  analytics: { fetchedAt: string; impressions: number; reach: number; clicks: number; likes: number; comments: number; shares: number; saves: number; conversions: number } | null;
  viralSignal: { viralScore: number; isViral: boolean; aiNote: string | null; computedAt: string } | null;
  leadDetection: { correlatedLeadCount: number; windowHours: number; methodology: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  published: 'bg-green-100 text-green-700', queued: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<PostDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/social/posts/${id}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="mx-auto max-w-3xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const a = data.analytics;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <a href={`/admin/social/${data.platform}`} className="text-xs text-indigo-600 hover:underline">&larr; Back to {data.platform}</a>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-900 capitalize">{data.platform.replace(/_/g, ' ')} Post</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[data.status] ?? 'bg-gray-100 text-gray-500'}`}>{data.status}</span>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-2">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.masterText || '(no content text)'}</p>
        {data.mediaUrls.length > 0 && <p className="text-xs text-gray-400">{data.mediaUrls.length} media attachment(s)</p>}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-2 border-t">
          <span>Scheduled: {new Date(data.scheduledAt).toLocaleString()}</span>
          {data.publishedAt && <span>Published: {new Date(data.publishedAt).toLocaleString()}</span>}
          {data.generatedWithAi !== null && <span>{data.generatedWithAi ? 'AI-generated' : 'Manually written'}</span>}
          {data.externalPostUrl && <a href={data.externalPostUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">View on platform</a>}
        </div>
        {data.failureReason && <p className="text-xs text-red-600 bg-red-50 rounded p-2">Failed: {data.failureReason}</p>}
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Engagement</h2>
        {a ? (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {[['Impressions', a.impressions], ['Reach', a.reach], ['Clicks', a.clicks], ['Likes', a.likes], ['Comments', a.comments], ['Shares', a.shares], ['Saves', a.saves], ['Conversions', a.conversions]].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-semibold text-gray-800">{(val as number).toLocaleString()}</p>
              </div>
            ))}
            <p className="col-span-full text-xs text-gray-400 pt-1">as of {new Date(a.fetchedAt).toLocaleString()}</p>
          </div>
        ) : <p className="text-sm text-gray-400">No engagement snapshot recorded yet.</p>}
      </div>

      {data.leadDetection && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Lead Detection</h2>
          <p className="text-sm">
            <span className="font-semibold">{data.leadDetection.correlatedLeadCount}</span> correlated lead(s) within {data.leadDetection.windowHours}h of publish
          </p>
          <p className="text-xs text-gray-400 mt-1">{data.leadDetection.methodology}</p>
        </div>
      )}

      {data.viralSignal && (
        <div className={`border rounded-xl p-5 ${data.viralSignal.isViral ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
          <h2 className="font-semibold text-gray-900 mb-2">Viral Signal</h2>
          <p className="text-sm">Score: <span className="font-semibold">{data.viralSignal.viralScore}</span> {data.viralSignal.isViral && <span className="ml-2 text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">Viral</span>}</p>
          {data.viralSignal.aiNote && <p className="text-xs text-gray-600 mt-1">{data.viralSignal.aiNote}</p>}
        </div>
      )}
    </div>
  );
}
