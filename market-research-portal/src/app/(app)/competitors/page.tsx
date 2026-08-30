'use client';

import { useEffect, useState, useCallback } from 'react';

interface Competitor { id: string; name: string; website: string | null; notes: string | null; source: string; collected_at: string }
interface Feature { id: string; competitor_id: string; feature_key: string; feature_value: string }

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [newColumn, setNewColumn] = useState('');
  const [editing, setEditing] = useState<{ competitorId: string; key: string; value: string } | null>(null);

  const load = useCallback(() => {
    fetch('/api/competitors', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setCompetitors(d.competitors ?? []); setFeatures(d.features ?? []); setColumns(d.featureColumns ?? []); });
  }, []);
  useEffect(load, [load]);

  const valueFor = (competitorId: string, key: string) => features.find(f => f.competitor_id === competitorId && f.feature_key === key)?.feature_value ?? '';

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website }),
    });
    setName(''); setWebsite('');
    load();
  };

  const addColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumn.trim()) return;
    setColumns(cols => (cols.includes(newColumn) ? cols : [...cols, newColumn]));
    setNewColumn('');
  };

  const saveFeature = async () => {
    if (!editing) return;
    await fetch(`/api/competitors/${editing.competitorId}/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureKey: editing.key, featureValue: editing.value }),
    });
    setEditing(null);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Competitors</h1>
      <p className="text-sm text-gray-500">Manual entry — real, sourced data only. No live scraping in this pass.</p>

      <div className="flex flex-wrap gap-4">
        <form onSubmit={addCompetitor} className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Competitor name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Add competitor</button>
        </form>

        <form onSubmit={addColumn} className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-600">New feature column</label>
            <input value={newColumn} onChange={e => setNewColumn(e.target.value)} placeholder="e.g. monthly_price" className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-900">Add column</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2">Competitor</th>
              <th className="whitespace-nowrap px-4 py-2">Website</th>
              {columns.map(c => <th key={c} className="whitespace-nowrap px-4 py-2">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {competitors.map(c => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium">{c.name}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">{c.website || '—'}</td>
                {columns.map(col => (
                  <td key={col} className="whitespace-nowrap px-4 py-2">
                    {editing?.competitorId === c.id && editing.key === col ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editing.value}
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onBlur={saveFeature}
                          onKeyDown={e => e.key === 'Enter' && saveFeature()}
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <button onClick={() => setEditing({ competitorId: c.id, key: col, value: valueFor(c.id, col) })} className="text-gray-700 hover:underline">
                        {valueFor(c.id, col) || <span className="text-gray-300">— set —</span>}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!competitors.length && (
              <tr><td colSpan={2 + columns.length} className="px-4 py-6 text-center text-gray-400">No competitors yet — add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
