'use client';
// /admin/growth/github-scout — a reading list of open-source repos
// relevant to the growth-loop build, not an auto-adopt action. Seeded with
// the user's own two researched shortlists (source=user_provided);
// GitHubRepoScoutJob adds genuinely new candidates monthly via the real
// GitHub API (source=ollama_search). Nothing here is ever cloned,
// installed, or run automatically — review and clone manually.

import { useEffect, useState } from 'react';

interface Candidate {
  fullName: string; url: string; stars: number | null; description: string | null;
  lastPushedAt: string | null; matchedQuery: string | null; source: string; relevanceNote: string | null;
}

export default function GitHubScoutPage() {
  const [data, setData] = useState<{ candidates: Candidate[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/growth/github-scout', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const userProvided = data.candidates.filter(c => c.source === 'user_provided');
  const discovered = data.candidates.filter(c => c.source === 'ollama_search');

  const table = (rows: Candidate[]) => (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Repo', 'Stars', 'Description', 'Note'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(c => (
            <tr key={c.fullName} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <a href={c.url} target="_blank" rel="noreferrer" className="font-mono text-blue-700 hover:underline">{c.fullName}</a>
                {c.matchedQuery && <p className="text-xs text-gray-400 mt-0.5">matched: "{c.matchedQuery}"</p>}
              </td>
              <td className="px-4 py-3 text-gray-600">{c.stars ?? 'not yet enriched'}</td>
              <td className="px-4 py-3 max-w-sm text-gray-600">{c.description ?? '—'}</td>
              <td className="px-4 py-3 max-w-sm text-xs text-gray-500">{c.relevanceNote ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">GitHub Repo Scout</h1>
        <p className="text-sm text-gray-500">
          A reading list, not an auto-adopt action — nothing here is cloned, installed, or run automatically. Review and clone manually.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">Your shortlist ({userProvided.length})</h2>
        {table(userProvided)}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-800">Discovered by GitHubRepoScoutJob ({discovered.length})</h2>
        {discovered.length === 0
          ? <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">No new candidates discovered yet — run "github-repo-scout" from the Demo Hub's Use Case Catalog.</div>
          : table(discovered)}
      </section>
    </div>
  );
}
