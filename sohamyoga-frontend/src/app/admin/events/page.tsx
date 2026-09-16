'use client';

import { useCallback, useEffect, useState } from 'react';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  format: string;
  location: string | null;
  join_url: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  status: string;
  registration_count: number;
  reg_count: string;
  created_at: string;
}

interface Registration {
  id: string;
  name: string;
  email: string;
  status: string;
  registered_at: string;
  checked_in_at: string | null;
}

interface Summary {
  total: string;
  upcoming: string;
  past: string;
  total_regs: string;
}

type TabKey = 'Overview' | 'Upcoming' | 'Past' | 'Registrations' | 'Create';
const TABS: TabKey[] = ['Overview', 'Upcoming', 'Past', 'Registrations', 'Create'];

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-500',
};

const VALID_STATUSES = ['draft', 'published', 'cancelled', 'completed'];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

interface CreateForm {
  slug: string;
  title: string;
  description: string;
  type: string;
  format: string;
  location: string;
  join_url: string;
  starts_at: string;
  ends_at: string;
  capacity: string;
}

const EMPTY_FORM: CreateForm = {
  slug: '', title: '', description: '', type: 'webinar', format: 'online',
  location: '', join_url: '', starts_at: '', ends_at: '', capacity: '',
};

export default function EventsAdminPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registrations
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  // Create form
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/events', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEvents(data.events ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  }, [load]);

  const loadRegistrations = useCallback(async (eventId: string) => {
    setRegsLoading(true);
    setSelectedEventId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setRegistrations(data.registrations ?? []);
    } finally {
      setRegsLoading(false);
    }
  }, []);

  const checkIn = useCallback(async (eventId: string, registrationId: string) => {
    await fetch(`/api/events/${eventId}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, action: 'check_in' }),
    });
    loadRegistrations(eventId);
  }, [loadRegistrations]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug,
          title: form.title,
          description: form.description,
          type: form.type,
          format: form.format,
          location: form.location || undefined,
          join_url: form.join_url || undefined,
          starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCreateSuccess(true);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }, [form, load]);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at) >= now);
  const past = events.filter((e) => new Date(e.ends_at) < now);

  function EventTable({ rows }: { rows: EventRow[] }) {
    if (!rows.length) return <p className="py-8 text-center text-sm text-gray-400">No events in this view.</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {['Title', 'Type', 'Format', 'Starts', 'Status', 'Registrations', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((ev) => (
              <tr key={ev.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{ev.title}</div>
                  <div className="font-mono text-xs text-gray-400">{ev.slug}</div>
                </td>
                <td className="px-3 py-2 text-gray-500">{ev.type}</td>
                <td className="px-3 py-2 text-gray-500">{ev.format.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(ev.starts_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <select
                    value={ev.status}
                    onChange={(e) => updateStatus(ev.id, e.target.value)}
                    className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[ev.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {VALID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {ev.reg_count}{ev.capacity ? ` / ${ev.capacity}` : ''}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => { setTab('Registrations'); loadRegistrations(ev.id); }}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    View regs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Event, Webinar & Workshop Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Real event registry with publish lifecycle, capacity-enforced registration, and check-in.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Events" value={summary?.total ?? '—'} color="blue" />
          <KpiCard label="Upcoming" value={summary?.upcoming ?? '—'} color="green" />
          <KpiCard label="Past" value={summary?.past ?? '—'} color="gray" />
          <KpiCard label="Total Registrations" value={summary?.total_regs ?? '—'} color="blue" />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading events…</div>
        ) : tab === 'Overview' ? (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">All Events ({events.length})</h3>
            </div>
            <EventTable rows={events} />
          </div>
        ) : tab === 'Upcoming' ? (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Upcoming Events ({upcoming.length})</h3>
            </div>
            <EventTable rows={upcoming} />
          </div>
        ) : tab === 'Past' ? (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Past Events ({past.length})</h3>
            </div>
            <EventTable rows={past} />
          </div>
        ) : tab === 'Registrations' ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-semibold text-gray-800">Select an Event to View Registrations</h3>
              <select
                value={selectedEventId ?? ''}
                onChange={(e) => e.target.value && loadRegistrations(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm"
              >
                <option value="">Select event…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({new Date(ev.starts_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            {selectedEventId && (
              <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Registrations ({registrations.length})
                  </h3>
                </div>
                {regsLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        {['Name', 'Email', 'Status', 'Registered', 'Checked In', 'Actions'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {registrations.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600">{r.email}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.status === 'attended' ? 'bg-green-100 text-green-700' :
                              r.status === 'no_show' ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">
                            {new Date(r.registered_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">
                            {r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {r.status === 'registered' && (
                              <button
                                onClick={() => checkIn(selectedEventId, r.id)}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                Check in
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!registrations.length && (
                        <tr><td colSpan={6} className="py-8 text-center text-gray-400">No registrations yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Create tab */
          <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-800">Create New Event</h3>
            {createSuccess && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Event created as draft.
              </div>
            )}
            {createError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="my-webinar-2026"
                    className="w-full rounded border px-3 py-1.5 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Event title"
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded border px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm">
                    {['event', 'webinar', 'workshop', 'seminar'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Format</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm">
                    {['online', 'in_person', 'hybrid'].map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {form.format !== 'online' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              )}
              {form.format !== 'in_person' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Join URL (Zoom/Meet)</label>
                  <input value={form.join_url} onChange={(e) => setForm({ ...form, join_url: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Starts At</label>
                  <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Ends At</label>
                  <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Capacity (blank = unlimited)</label>
                <input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !form.slug || !form.title || !form.starts_at || !form.ends_at}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Draft Event'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
