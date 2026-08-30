'use client';
// /admin/market-research/[frameworkSlug] — topic list for one research
// framework, ordered by layer_number. Each topic links into its own
// 4-tab detail page at /admin/market-research/[frameworkSlug]/[topicId].

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Topic {
  id: string;
  slug: string;
  name: string;
  layerNumber: number;
  summary: string;
  jobName: string | null;
}
interface FrameworkDetail {
  framework: { id: string; slug: string; name: string; description: string; sortOrder: number };
  topics: Topic[];
}

export default function MarketResearchFrameworkPage({ params }: { params: { frameworkSlug: string } }) {
  const { frameworkSlug } = params;
  const [data, setData] = useState<FrameworkDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/market-research/${frameworkSlug}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, [frameworkSlug]);

  if (error) return <div className="mx-auto max-w-6xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/market-research" className="text-sm text-indigo-600 hover:underline">&larr; All frameworks</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{data.framework.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data.topics.length} topics — {data.framework.description}</p>
      </div>

      <div className="space-y-3">
        {data.topics.map(t => (
          <Link key={t.id} href={`/admin/market-research/${frameworkSlug}/${t.slug}`}
            className="block bg-white border rounded-lg p-4 hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                {t.layerNumber}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{t.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{t.summary}</div>
              </div>
              {t.jobName ? (
                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 flex-shrink-0">Automated</div>
              ) : (
                <div className="text-xs text-gray-400 flex-shrink-0">#{t.layerNumber}</div>
              )}
            </div>
          </Link>
        ))}
        {data.topics.length === 0 && (
          <div className="text-center py-12 text-gray-400">No topics seeded for this framework yet.</div>
        )}
      </div>
    </div>
  );
}
