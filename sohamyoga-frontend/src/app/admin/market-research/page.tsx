"use client";
// Market Research — top level of the Framework -> Topic -> 4-tab
// hierarchy. Three real research frameworks: the 17-layer market research
// & forecasting framework (population -> forecasting), the New Entrant
// Market Entry Scorecard (20 components), and the Existing Centre Growth
// Research framework (52 components). Each card links into its own topic
// list at /admin/market-research/[frameworkSlug].

import { useEffect, useState } from "react";
import Link from "next/link";

interface Framework {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  topicCount: number;
}

export default function MarketResearchPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/market-research", { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setFrameworks(d.frameworks); })
      .catch(e => setError(e.message));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Research</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {frameworks.length > 0
              ? `${frameworks.length} research frameworks, ${frameworks.reduce((s, f) => s + f.topicCount, 0)} topics total`
              : "Real research frameworks used to size, enter, and grow the market"}
          </p>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {frameworks.map(f => (
          <Link key={f.id} href={`/admin/market-research/${f.slug}`}
            className="block bg-white border rounded-lg p-5 hover:border-indigo-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-gray-900">{f.name}</div>
              <div className="flex-shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                {f.topicCount} topics
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">{f.description}</p>
          </Link>
        ))}
        {frameworks.length === 0 && !error && (
          <div className="col-span-full text-center py-12 text-gray-400">Loading research frameworks…</div>
        )}
      </div>
    </div>
  );
}
