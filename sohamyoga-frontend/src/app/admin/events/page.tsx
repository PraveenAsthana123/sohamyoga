'use client';
// Module 19 — Event, Webinar, Workshop & Seminar Management. Was 0/14: nothing
// distinct from recurring yoga-class booking existed. This is a real event
// registry with publish/cancel/complete lifecycle, capacity-enforced public
// registration, and admin check-in.

import { useEffect, useState, useCallback } from 'react';

interface EventRow {
  id: string; slug: string; title: string; type: string; format: string; location: string | null;
  joinUrl: string | null; startsAt: string; endsAt: string; capacity: number | null; status: string; registrationCount: number;
}
interface Registration { id: string; name: string; email: string; status: string; registered_at: string; checked_in_at: string | null }

function NewEventForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(''); const [title, setTitle] = useState('');
  const [type, setType] = useState('webinar'); const [format, setFormat] = useState('online');
  const [location, setLocation] = useState(''); const [joinUrl, setJoinUrl] = useState('');
  const [startsAt, setStartsAt] = useState(''); const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, title, type, format,
        location: location || undefined, joinUrl: joinUrl || undefined,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        capacity: capacity ? Number(capacity) : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setSlug(''); setTitle(''); onCreated(); }
    else setError(body.error ?? 'Failed to create event.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Event</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm">
          <option value="event">event</option><option value="webinar">webinar</option><option value="workshop">workshop</option><option value="seminar">seminar</option>
        </select>
        <select value={format} onChange={e => setFormat(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm">
          <option value="online">online</option><option value="in_person">in_person</option><option value="hybrid">hybrid</option>
        </select>
      </div>
      {format !== 'online' && <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="w-full border rounded px-2 py-1.5 text-sm" />}
      {format !== 'in_person' && <input value={joinUrl} onChange={e => setJoinUrl(e.target.value)} placeholder="Join URL (Zoom/Meet)" className="w-full border rounded px-2 py-1.5 text-sm" />}
      <div className="flex gap-2">
        <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm" />
        <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm" />
      </div>
      <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Capacity (blank = unlimited)" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !slug || !title || !startsAt || !endsAt} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function EventsAdmin() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/events', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setEvents(d?.events ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: 'publish' | 'cancel' | 'complete') {
    await fetch(`/api/events/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }
  async function viewRegistrations(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    const res = await fetch(`/api/events/${id}/registrations`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setRegistrations(body.registrations ?? []);
    setExpanded(id);
  }
  async function checkIn(eventId: string, registrationId: string) {
    await fetch(`/api/events/${eventId}/registrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, action: 'check_in' }),
    });
    const res = await fetch(`/api/events/${eventId}/registrations`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setRegistrations(body.registrations ?? []);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Event, Webinar & Workshop Management</h1><p className="text-sm text-gray-500">Real registry with publish lifecycle, capacity-enforced registration, and check-in.</p></div>
        <NewEventForm onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{ev.title} <span className="text-xs text-gray-400">({ev.type} · {ev.format})</span></p>
                  <p className="text-xs text-gray-400 font-mono">/events/{ev.slug} · {new Date(ev.startsAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ev.status === 'published' ? 'bg-green-100 text-green-700' : ev.status === 'cancelled' ? 'bg-red-100 text-red-600' : ev.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{ev.status}</span>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                {ev.status === 'draft' && <button onClick={() => transition(ev.id, 'publish')} className="text-xs text-green-600 hover:underline">Publish</button>}
                {ev.status === 'published' && <button onClick={() => transition(ev.id, 'complete')} className="text-xs text-gray-600 hover:underline">Mark completed</button>}
                {(ev.status === 'draft' || ev.status === 'published') && <button onClick={() => transition(ev.id, 'cancel')} className="text-xs text-red-500 hover:underline">Cancel</button>}
                <button onClick={() => viewRegistrations(ev.id)} className="text-xs text-indigo-600 hover:underline">
                  {ev.registrationCount}{ev.capacity ? ` / ${ev.capacity}` : ''} registered {expanded === ev.id ? '▲' : '▼'}
                </button>
              </div>
              {expanded === ev.id && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {registrations.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                      <span className="text-gray-700">{r.name} · {r.email}</span>
                      <span className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded ${r.status === 'attended' ? 'bg-green-100 text-green-700' : r.status === 'no_show' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                        {r.status === 'registered' && <button onClick={() => checkIn(ev.id, r.id)} className="text-indigo-600 hover:underline">Check in</button>}
                      </span>
                    </div>
                  ))}
                  {!registrations.length && <p className="text-xs text-gray-400">No registrations yet.</p>}
                </div>
              )}
            </div>
          ))}
          {!events.length && <p className="text-sm text-gray-400">No events yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
