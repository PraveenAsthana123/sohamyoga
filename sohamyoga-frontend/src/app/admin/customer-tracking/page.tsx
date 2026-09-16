'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['live', 'byPage', 'byEvent', 'journeys', 'funnel'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  live: 'Live Feed',
  byPage: 'By Page',
  byEvent: 'By Event Type',
  journeys: 'Customer Journeys',
  funnel: 'Funnel Analysis',
};

interface TrackEvent {
  id: number;
  session_id: string | null;
  customer_id: number | null;
  event_type: string;
  page_path: string | null;
  element_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const EVENT_BADGE: Record<string, string> = {
  pageview: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  click: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  form_submit: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  cart_add: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  checkout_start: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  video_play: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  scroll_depth: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
};

function EventBadge({ type }: { type: string }) {
  const cls = EVENT_BADGE[type] ?? 'bg-white/10 text-white/60 border border-white/20';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{type}</span>;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString();
}

// ── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed({ events }: { events: TrackEvent[] }) {
  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl overflow-x-auto">
      <p className="text-white/60 text-xs mb-4">Auto-refreshes every 30 seconds. Showing last 100 events.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/60 text-left text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4">Time</th>
            <th className="pb-3 pr-4">Event</th>
            <th className="pb-3 pr-4">Page</th>
            <th className="pb-3 pr-4">Customer</th>
            <th className="pb-3">Element</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-white/40">No events recorded yet.</td></tr>
          )}
          {events.map(ev => (
            <tr key={ev.id} className="border-b border-white/10 text-white/80">
              <td className="py-2 pr-4 text-white/50 text-xs whitespace-nowrap">{fmt(ev.created_at)}</td>
              <td className="py-2 pr-4"><EventBadge type={ev.event_type} /></td>
              <td className="py-2 pr-4 text-white/70 max-w-[200px] truncate">{ev.page_path ?? '—'}</td>
              <td className="py-2 pr-4 text-white/70">{ev.customer_id ?? <span className="text-white/40">anon</span>}</td>
              <td className="py-2 text-white/50 text-xs">{ev.element_id ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── By Page ──────────────────────────────────────────────────────────────────
function ByPage({ events }: { events: TrackEvent[] }) {
  const pageMap = new Map<string, { views: number; sessions: Set<string>; eventTotal: number }>();
  for (const ev of events) {
    const path = ev.page_path ?? '(unknown)';
    if (!pageMap.has(path)) pageMap.set(path, { views: 0, sessions: new Set(), eventTotal: 0 });
    const p = pageMap.get(path)!;
    if (ev.event_type === 'pageview') p.views++;
    if (ev.session_id) p.sessions.add(ev.session_id);
    p.eventTotal++;
  }
  const rows = [...pageMap.entries()]
    .map(([path, d]) => ({
      path,
      views: d.views,
      sessions: d.sessions.size,
      avgEvents: d.sessions.size > 0 ? (d.eventTotal / d.sessions.size).toFixed(1) : '—',
    }))
    .sort((a, b) => b.views - a.views);

  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/60 text-left text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4">Page Path</th>
            <th className="pb-3 pr-4">Pageviews</th>
            <th className="pb-3 pr-4">Unique Sessions</th>
            <th className="pb-3">Avg Events/Session</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-white/40">No data.</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.path} className="border-b border-white/10 text-white/80">
              <td className="py-2 pr-4 font-mono text-xs">{r.path}</td>
              <td className="py-2 pr-4">{r.views}</td>
              <td className="py-2 pr-4">{r.sessions}</td>
              <td className="py-2">{r.avgEvents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── By Event Type ────────────────────────────────────────────────────────────
function ByEventType({ events }: { events: TrackEvent[] }) {
  const counts = new Map<string, number>();
  for (const ev of events) counts.set(ev.event_type, (counts.get(ev.event_type) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;

  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
      <h3 className="text-white font-semibold mb-4">Event Count Distribution</h3>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-white/40 text-sm">No data.</p>}
        {rows.map(([type, count]) => (
          <div key={type} className="flex items-center gap-3">
            <div className="w-36 shrink-0"><EventBadge type={type} /></div>
            <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
            <span className="text-white/80 text-sm w-10 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Customer Journeys ────────────────────────────────────────────────────────
function CustomerJourneys({ events }: { events: TrackEvent[] }) {
  const customerMap = new Map<number, TrackEvent[]>();
  for (const ev of events) {
    if (ev.customer_id == null) continue;
    if (!customerMap.has(ev.customer_id)) customerMap.set(ev.customer_id, []);
    customerMap.get(ev.customer_id)!.push(ev);
  }

  return (
    <div className="space-y-4">
      {customerMap.size === 0 && (
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl text-white/40 text-sm text-center">
          No identified customers in the last 100 events.
        </div>
      )}
      {[...customerMap.entries()].map(([customerId, evs]) => (
        <div key={customerId} className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-white font-semibold mb-3">Customer #{customerId}</h3>
          <div className="space-y-1">
            {evs.slice(0, 10).map(ev => (
              <div key={ev.id} className="flex items-center gap-3 text-sm">
                <span className="text-white/40 text-xs w-36 shrink-0">{fmt(ev.created_at)}</span>
                <EventBadge type={ev.event_type} />
                <span className="text-white/60 font-mono text-xs truncate">{ev.page_path ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Funnel Analysis ──────────────────────────────────────────────────────────
function FunnelAnalysis({ events }: { events: TrackEvent[] }) {
  const steps = [
    { label: 'Landing (pageview)', type: 'pageview', path: null },
    { label: 'Product View', type: 'pageview', path: '/products' },
    { label: 'Cart Add', type: 'cart_add', path: null },
    { label: 'Checkout Start', type: 'checkout_start', path: null },
    { label: 'Purchase (form_submit)', type: 'form_submit', path: '/checkout' },
  ];

  const counts = steps.map(step => {
    return events.filter(ev => {
      if (ev.event_type !== step.type) return false;
      if (step.path && (!ev.page_path || !ev.page_path.startsWith(step.path))) return false;
      return true;
    }).length;
  });

  const topCount = counts[0] || 1;

  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
      <h3 className="text-white font-semibold mb-6">5-Step Conversion Funnel</h3>
      <div className="space-y-4">
        {steps.map((step, i) => {
          const count = counts[i];
          const prev = i === 0 ? count : counts[i - 1];
          const dropOff = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0;
          return (
            <div key={step.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/80">{i + 1}. {step.label}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
              <div className="bg-white/10 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.round((count / topCount) * 100)}%` }}
                />
              </div>
              {i > 0 && (
                <p className="text-xs text-white/40 mt-1">
                  Drop-off from previous step: <span className="text-red-400">{dropOff}%</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerTrackingPage() {
  const [tab, setTab] = useState<Tab>('live');
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/track', { cache: 'no-store' });
      if (!res.ok) { setError('Failed to load events.'); return; }
      const data = await res.json();
      setEvents(data.events ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Customer Tracking</h1>
        <p className="text-white/60 mt-1">
          Real-time behaviour analytics — page views, clicks, funnel events.
          {lastRefresh && <span className="ml-2 text-white/40 text-xs">Last refresh: {lastRefresh.toLocaleTimeString()}</span>}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-white/60">Loading events…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          {tab === 'live' && <LiveFeed events={events} />}
          {tab === 'byPage' && <ByPage events={events} />}
          {tab === 'byEvent' && <ByEventType events={events} />}
          {tab === 'journeys' && <CustomerJourneys events={events} />}
          {tab === 'funnel' && <FunnelAnalysis events={events} />}
        </>
      )}
    </div>
  );
}
