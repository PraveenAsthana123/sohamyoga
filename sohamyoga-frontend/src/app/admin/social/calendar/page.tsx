'use client';
// Content Calendar -- a real date-grid view of scheduled/published posts
// across platforms, previously only ever shown as a flat draft/approval
// list (the scheduler page). Pure aggregation of real social_post rows.

import { useEffect, useMemo, useState } from 'react';

interface CalPost { id: string; platform: string; status: string; scheduledAt: string; publishedAt: string | null; excerpt: string | null }

const STATUS_DOT: Record<string, string> = {
  published: 'bg-green-500', queued: 'bg-amber-500', failed: 'bg-red-500', cancelled: 'bg-gray-400',
};

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function ContentCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const from = new Date(Date.UTC(year, month, 1)).toISOString();
    const to = new Date(Date.UTC(year, month + 1, 1)).toISOString();
    setLoading(true);
    fetch(`/api/admin/social/calendar?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setPosts(d.posts); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  const byDay = useMemo(() => {
    const map: Record<number, CalPost[]> = {};
    for (const p of posts) {
      const day = new Date(p.scheduledAt).getUTCDate();
      (map[day] ??= []).push(p);
    }
    return map;
  }, [posts]);

  const cells = monthGrid(year, month);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  function shiftMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => shiftMonth(-1)} className="px-2 py-1 text-sm rounded border hover:bg-gray-50">&larr;</button>
          <span className="text-sm font-medium w-36 text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="px-2 py-1 text-sm rounded border hover:bg-gray-50">&rarr;</button>
        </div>
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-xl overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-500 text-center">{d}</div>
          ))}
          {cells.map((day, i) => (
            <div key={i} className="bg-white min-h-[90px] p-1.5 align-top">
              {day && (
                <>
                  <p className="text-xs text-gray-400 mb-1">{day}</p>
                  <div className="space-y-1">
                    {(byDay[day] ?? []).slice(0, 3).map(p => (
                      <a key={p.id} href={`/admin/social/posts/${p.id}`} className="flex items-center gap-1 text-[10px] bg-gray-50 hover:bg-indigo-50 rounded px-1 py-0.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] ?? 'bg-gray-300'}`} />
                        <span className="truncate">{p.excerpt || p.platform}</span>
                      </a>
                    ))}
                    {(byDay[day]?.length ?? 0) > 3 && <p className="text-[10px] text-gray-400">+{byDay[day].length - 3} more</p>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && !posts.length && !error && <p className="text-sm text-gray-400">No posts scheduled this month.</p>}
    </div>
  );
}
