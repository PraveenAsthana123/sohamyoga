'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PortalConnection {
  id: string;
  portal: string;
  portal_name: string;
  status: string;
  api_key_set: boolean;
  org_id: string | null;
  org_name: string | null;
  profile_url: string | null;
  last_sync_at: string | null;
  events_synced: number;
  created_at: string;
}

interface ExternalEvent {
  id: string;
  portal: string;
  external_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  format: string;
  status: string;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  location_name: string | null;
  location_address: string | null;
  meeting_url: string | null;
  capacity: number | null;
  rsvp_count: number;
  waitlist_count: number;
  attendees_count: number;
  ticket_price: string;
  is_free: boolean;
  image_url: string | null;
  tags: string[] | null;
  portal_url: string | null;
  synced_from_portal: boolean;
  created_at: string;
}

interface Attendee {
  id: string;
  event_id: string;
  portal: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  rsvp_status: string;
  ticket_type: string | null;
  registered_at: string;
  checked_in_at: string | null;
}

interface AttendeeStats {
  going: string;
  waitlist: string;
  not_going: string;
  checked_in: string;
  total: string;
}

interface PortalStat {
  portal: string;
  total_events: number;
  total_rsvps: number;
  total_attendees: number;
  avg_attendance_rate: string | null;
}

interface Summary {
  total_events: string;
  upcoming: string;
  total_rsvps: string;
  avg_attendance_rate: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PORTAL_META: Record<string, { emoji: string; color: string; bg: string; name: string }> = {
  meetup:          { emoji: '📅', color: 'text-red-700',     bg: 'bg-red-50 border-red-200',     name: 'Meetup.com' },
  eventbrite:      { emoji: '🎟️', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', name: 'Eventbrite' },
  luma:            { emoji: '✨', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200', name: 'Luma' },
  google_meet:     { emoji: '🎥', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    name: 'Google Meet' },
  linkedin_events: { emoji: '💼', color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200',      name: 'LinkedIn Events' },
  zoom:            { emoji: '📹', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', name: 'Zoom' },
  facebook_events: { emoji: '📘', color: 'text-blue-800',   bg: 'bg-blue-50 border-blue-300',    name: 'Facebook Events' },
  humanitix:       { emoji: '🎫', color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',    name: 'Humanitix' },
  ticketmaster:    { emoji: '🏟️', color: 'text-cyan-700',   bg: 'bg-cyan-50 border-cyan-200',    name: 'Ticketmaster' },
};

const PORTAL_ENV: Record<string, { vars: string[]; url: string; steps: string[] }> = {
  meetup:          { vars: ['MEETUP_API_KEY', 'MEETUP_GROUP_URLNAME'], url: 'https://secure.meetup.com/meetup_api', steps: ['Create account at meetup.com', 'Go to API settings → create key', 'Set MEETUP_API_KEY + MEETUP_GROUP_URLNAME'] },
  eventbrite:      { vars: ['EVENTBRITE_TOKEN', 'EVENTBRITE_ORG_ID'], url: 'https://www.eventbrite.com/platform/api', steps: ['Login at eventbrite.com', 'Account → Developer → Create app → Copy Private Token', 'Set EVENTBRITE_TOKEN + EVENTBRITE_ORG_ID'] },
  luma:            { vars: ['LUMA_API_KEY', 'LUMA_CALENDAR_ID'], url: 'https://lu.ma/developers', steps: ['Login at lu.ma', 'Settings → API Keys → Generate key', 'Set LUMA_API_KEY + LUMA_CALENDAR_ID'] },
  google_meet:     { vars: ['GOOGLE_CALENDAR_TOKEN'], url: 'https://console.cloud.google.com', steps: ['Enable Google Calendar API in GCP', 'Create OAuth 2.0 credentials', 'Set GOOGLE_CALENDAR_TOKEN'] },
  zoom:            { vars: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'], url: 'https://marketplace.zoom.us', steps: ['Login at marketplace.zoom.us', 'Develop → Build App → Server-to-Server OAuth', 'Set ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET'] },
  linkedin_events: { vars: ['LINKEDIN_CLIENT_ID'], url: 'https://www.linkedin.com/developers', steps: ['Create LinkedIn App at developers portal', 'Enable Marketing Developer Platform', 'Set LINKEDIN_CLIENT_ID (may already exist)'] },
  facebook_events: { vars: ['META_PAGE_ACCESS_TOKEN'], url: 'https://developers.facebook.com', steps: ['Create Meta App at developers.facebook.com', 'Add Page token with events_management permission', 'Set META_PAGE_ACCESS_TOKEN (may already exist)'] },
  humanitix:       { vars: ['HUMANITIX_API_KEY'], url: 'https://humanitix.com/api', steps: ['Login at humanitix.com', 'Settings → Developer → Request API access', 'Set HUMANITIX_API_KEY'] },
  ticketmaster:    { vars: ['TICKETMASTER_API_KEY'], url: 'https://developer.ticketmaster.com', steps: ['Register at developer.ticketmaster.com', 'Create App → copy Consumer Key', 'Set TICKETMASTER_API_KEY'] },
};

const EVENT_TYPES = ['networking','workshop','webinar','conference','meetup','social','business','hackathon'];
const FORMATS = ['online','in_person','hybrid'];
const STATUSES = ['draft','published','cancelled','completed'];

const TABS = ['Dashboard','All Events','Meetup.com','Attendees','Business Events','Setup'] as const;
type TabKey = typeof TABS[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function statusDot(s: string): string {
  if (s === 'connected') return 'bg-green-500';
  if (s === 'demo') return 'bg-amber-400';
  return 'bg-gray-300';
}

function statusLabel(s: string): string {
  if (s === 'connected') return 'Connected';
  if (s === 'demo') return 'Demo';
  return 'Disconnected';
}

function rsvpBadge(s: string): string {
  const m: Record<string,string> = { going: 'bg-green-100 text-green-700', waitlist: 'bg-amber-100 text-amber-700', not_going: 'bg-red-100 text-red-700', checked_in: 'bg-blue-100 text-blue-700' };
  return m[s] ?? 'bg-gray-100 text-gray-500';
}

function formatBadge(f: string): string {
  const m: Record<string,string> = { online: 'bg-blue-100 text-blue-700', in_person: 'bg-green-100 text-green-700', hybrid: 'bg-purple-100 text-purple-700' };
  return m[f] ?? 'bg-gray-100 text-gray-500';
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: 'blue'|'green'|'amber'|'purple'|'gray' }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-600',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

// ── Create Event Modal ───────────────────────────────────────────────────────

interface CreateEventModalProps {
  portals: PortalConnection[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateEventModal({ portals, onClose, onCreated }: CreateEventModalProps) {
  const [form, setForm] = useState({
    title: '', description: '', event_type: 'networking', format: 'online',
    start_at: '', end_at: '', timezone: 'America/Toronto',
    location_name: '', location_address: '', meeting_url: '',
    capacity: '', ticket_price: '', is_free: true, image_url: '',
    tags: '', publish_portals: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string,unknown> | null>(null);

  const connectedPortals = portals.filter(p => p.status !== 'disconnected');

  const togglePortal = (portal: string) => {
    setForm(f => ({
      ...f,
      publish_portals: f.publish_portals.includes(portal)
        ? f.publish_portals.filter(p => p !== portal)
        : [...f.publish_portals, portal],
    }));
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/admin/event-portals/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : null,
          ticket_price: form.is_free ? 0 : Number(form.ticket_price),
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      const data = await r.json() as Record<string,unknown>;
      if (!r.ok) { setError((data.error as string) ?? 'Failed to create event.'); return; }
      setResult(data);
      onCreated();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Create New Event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        {result ? (
          <div>
            <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-green-700 mb-4">
              Event created successfully!
            </div>
            {Boolean(result.warnings) && (
              <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 mb-4 text-sm">
                {String(result.warnings)}
              </div>
            )}
            {Boolean(result.manual_links) && (
              <div className="text-sm text-gray-600 mb-4">
                <p className="font-medium mb-2">Manual publish links:</p>
                {Object.entries(result.manual_links as Record<string,string>).map(([k, v]) => (
                  <div key={k}><a href={v} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{PORTAL_META[k]?.name ?? k}</a></div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Close</button>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Event title" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded border px-3 py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
                <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm">
                  {FORMATS.map(f => <option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                <input type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                <input type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
              </div>
            </div>
            {form.format !== 'online' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location Name</label>
                  <input value={form.location_name} onChange={e => setForm({ ...form, location_name: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Yoga Studio Toronto" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input value={form.location_address} onChange={e => setForm({ ...form, location_address: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              </div>
            )}
            {form.format !== 'in_person' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Meeting URL</label>
                <input value={form.meeting_url} onChange={e => setForm({ ...form, meeting_url: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="https://meet.google.com/..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Unlimited" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ticket Price</label>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={form.is_free} onChange={e => setForm({ ...form, is_free: e.target.checked })} />
                    Free
                  </label>
                  {!form.is_free && (
                    <input type="number" min="0" step="0.01" value={form.ticket_price} onChange={e => setForm({ ...form, ticket_price: e.target.value })} className="flex-1 rounded border px-3 py-1.5 text-sm" placeholder="0.00" />
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
              <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="yoga, wellness, online" />
            </div>

            {connectedPortals.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Publish to portals</label>
                <div className="flex flex-wrap gap-2">
                  {connectedPortals.map(p => (
                    <label key={p.portal} className="flex items-center gap-1.5 text-xs rounded border px-2 py-1 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={form.publish_portals.includes(p.portal)} onChange={() => togglePortal(p.portal)} />
                      {PORTAL_META[p.portal]?.emoji} {PORTAL_META[p.portal]?.name ?? p.portal}
                      {p.status === 'demo' && <span className="text-amber-500">(demo)</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} disabled={saving} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create & Publish'}
              </button>
              <button onClick={onClose} className="rounded-md border px-5 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EventPortalsPage() {
  const [tab, setTab] = useState<TabKey>('Dashboard');
  const [portals, setPortals] = useState<PortalConnection[]>([]);
  const [stats, setStats] = useState<PortalStat[]>([]);
  const [upcomingByPortal, setUpcomingByPortal] = useState<Record<string,number>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Array<{portal:string;synced:number;demo:boolean;warning?:string;error?:string}> | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters
  const [filterPortal, setFilterPortal] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Attendees tab
  const [selectedEventId, setSelectedEventId] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeStats, setAttendeeStats] = useState<AttendeeStats | null>(null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [addAttendeeForm, setAddAttendeeForm] = useState({ name: '', email: '', phone: '', ticket_type: 'General' });
  const [addingAttendee, setAddingAttendee] = useState(false);

  // Meet link
  const [meetForm, setMeetForm] = useState({ title: '', start_at: '', end_at: '' });
  const [meetResult, setMeetResult] = useState<Record<string,unknown> | null>(null);
  const [creatingMeet, setCreatingMeet] = useState(false);

  // Business event form
  const [bizForm, setBizForm] = useState({
    title: '', description: '', event_type: 'conference', format: 'in_person',
    start_at: '', end_at: '', location_name: '', location_address: '',
    capacity: '', ticket_price: '', is_free: false, image_url: '',
    tags: '', website_url: '', hashtag: '',
    sponsors: '', speakers: '', agenda: '',
    estimated_cost: '', actual_cost: '',
  });
  const [bizSaving, setBizSaving] = useState(false);
  const [bizResult, setBizResult] = useState('');
  const [bizError, setBizError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/event-portals');
      if (r.ok) {
        const data = await r.json() as { portals: PortalConnection[]; stats: PortalStat[]; upcomingByPortal: Record<string,number>; summary: Summary };
        setPortals(data.portals ?? []);
        setStats(data.stats ?? []);
        setUpcomingByPortal(data.upcomingByPortal ?? {});
        setSummary(data.summary ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterPortal) params.set('portal', filterPortal);
    if (filterFormat) params.set('format', filterFormat);
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('type', filterType);
    try {
      const r = await fetch(`/api/admin/event-portals/events?${params.toString()}`);
      if (r.ok) {
        const data = await r.json() as { events: ExternalEvent[] };
        setEvents(data.events ?? []);
      }
    } catch { /* ignore */ }
  }, [filterPortal, filterFormat, filterStatus, filterType]);

  const loadAttendees = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setAttendeesLoading(true);
    try {
      const r = await fetch(`/api/admin/event-portals/events/${eventId}/attendees`);
      if (r.ok) {
        const data = await r.json() as { attendees: Attendee[]; stats: AttendeeStats };
        setAttendees(data.attendees ?? []);
        setAttendeeStats(data.stats ?? null);
      }
    } catch { /* ignore */ }
    finally { setAttendeesLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'All Events' || tab === 'Meetup.com') loadEvents(); }, [tab, loadEvents]);
  useEffect(() => { if (selectedEventId) loadAttendees(selectedEventId); }, [selectedEventId, loadAttendees]);

  const handleSyncAll = async (portal?: string) => {
    setSyncing(true); setSyncResults(null);
    try {
      const r = await fetch('/api/admin/event-portals/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portal ? { portal } : {}),
      });
      const data = await r.json() as { results: typeof syncResults };
      setSyncResults(data.results ?? []);
      await loadDashboard();
    } catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  const handleCheckin = async (attendeeId: string) => {
    if (!selectedEventId) return;
    try {
      await fetch(`/api/admin/event-portals/events/${selectedEventId}/attendees`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: attendeeId, action: 'checkin' }),
      });
      await loadAttendees(selectedEventId);
    } catch { /* ignore */ }
  };

  const handleBulkCheckin = async () => {
    if (!selectedEventId) return;
    try {
      await fetch(`/api/admin/event-portals/events/${selectedEventId}/attendees`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_checkin' }),
      });
      await loadAttendees(selectedEventId);
    } catch { /* ignore */ }
  };

  const handleAddAttendee = async () => {
    if (!selectedEventId || !addAttendeeForm.name || !addAttendeeForm.email) return;
    setAddingAttendee(true);
    try {
      await fetch(`/api/admin/event-portals/events/${selectedEventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addAttendeeForm),
      });
      setAddAttendeeForm({ name: '', email: '', phone: '', ticket_type: 'General' });
      await loadAttendees(selectedEventId);
    } catch { /* ignore */ }
    finally { setAddingAttendee(false); }
  };

  const exportCsv = () => {
    if (!attendees.length) return;
    const headers = ['Name', 'Email', 'Phone', 'RSVP Status', 'Ticket Type', 'Registered At', 'Checked In At'];
    const rows = attendees.map(a => [a.name ?? '', a.email ?? '', a.phone ?? '', a.rsvp_status, a.ticket_type ?? '', fmtDate(a.registered_at), fmtDate(a.checked_in_at)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'attendees.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateMeet = async () => {
    setCreatingMeet(true); setMeetResult(null);
    try {
      const r = await fetch('/api/admin/event-portals/google-meet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetForm),
      });
      const data = await r.json() as Record<string,unknown>;
      setMeetResult(data);
    } catch { /* ignore */ }
    finally { setCreatingMeet(false); }
  };

  const handleCreateBizEvent = async () => {
    if (!bizForm.title.trim()) { setBizError('Title is required.'); return; }
    setBizSaving(true); setBizError(''); setBizResult('');
    try {
      const r = await fetch('/api/admin/event-portals/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bizForm.title, description: bizForm.description,
          event_type: bizForm.event_type, format: bizForm.format,
          start_at: bizForm.start_at || null, end_at: bizForm.end_at || null,
          location_name: bizForm.location_name || null, location_address: bizForm.location_address || null,
          capacity: bizForm.capacity ? Number(bizForm.capacity) : null,
          ticket_price: bizForm.is_free ? 0 : Number(bizForm.ticket_price),
          is_free: bizForm.is_free,
          image_url: bizForm.image_url || null,
          tags: bizForm.tags ? bizForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          portal: 'google_meet',
        }),
      });
      if (r.ok) { setBizResult('Business event created!'); await loadEvents(); }
      else { const d = await r.json() as { error?: string }; setBizError(d.error ?? 'Failed.'); }
    } catch { setBizError('Network error.'); }
    finally { setBizSaving(false); }
  };

  const meetupEvents = events.filter(e => e.portal === 'meetup');
  const activePortals = portals.filter(p => p.status === 'connected').length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Event Portals Integration Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and sync events across all external event platforms</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Create Event
            </button>
            <button
              onClick={() => handleSyncAll()}
              disabled={syncing}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '↻ Sync All'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Sync results banner */}
        {syncResults && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800 mb-2">Sync complete</p>
            <div className="flex flex-wrap gap-3">
              {syncResults.map(r => (
                <span key={r.portal} className="text-xs bg-white rounded border px-2 py-1">
                  {PORTAL_META[r.portal]?.emoji} {r.portal}: {r.synced} events {r.demo && <span className="text-amber-600">(demo)</span>}
                  {r.warning && <span className="text-amber-600 ml-1">⚠</span>}
                  {r.error && <span className="text-red-600 ml-1">✗</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Dashboard ── */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-gray-400 text-sm">Loading…</div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <KpiCard label="Total Events" value={summary?.total_events ?? '0'} color="blue" />
                  <KpiCard label="Upcoming" value={summary?.upcoming ?? '0'} color="green" />
                  <KpiCard label="Total RSVPs" value={summary?.total_rsvps ?? '0'} color="purple" />
                  <KpiCard label="Avg Attendance" value={summary?.avg_attendance_rate ? `${(Number(summary.avg_attendance_rate)*100).toFixed(1)}%` : '—'} color="amber" />
                  <KpiCard label="Active Portals" value={activePortals} color="blue" />
                  <KpiCard label="Portals" value={portals.length} color="gray" sub="total configured" />
                </div>

                {/* Portal status grid */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Portal Status</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {portals.map(p => {
                      const meta = PORTAL_META[p.portal];
                      const stat = stats.find(s => s.portal === p.portal);
                      return (
                        <div key={p.portal} className={`rounded-lg border p-4 ${meta?.bg ?? 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{meta?.emoji ?? '🔗'}</span>
                              <div>
                                <div className={`text-sm font-semibold ${meta?.color ?? 'text-gray-700'}`}>{meta?.name ?? p.portal}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`inline-block w-2 h-2 rounded-full ${statusDot(p.status)}`} />
                                  <span className="text-xs text-gray-500">{statusLabel(p.status)}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => p.status === 'disconnected' ? setTab('Setup') : handleSyncAll(p.portal)}
                              disabled={syncing}
                              className="text-xs rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {p.status === 'disconnected' ? 'Connect' : 'Sync'}
                            </button>
                          </div>
                          <div className="mt-3 flex gap-4 text-xs text-gray-500">
                            <span>{stat?.total_events ?? p.events_synced} events</span>
                            <span>{upcomingByPortal[p.portal] ?? 0} upcoming</span>
                            {p.last_sync_at && <span>Last sync: {fmtShort(p.last_sync_at)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats table */}
                {stats.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Platform Analytics</h2>
                    <div className="rounded-lg border bg-white overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-4 py-2 text-left">Platform</th>
                            <th className="px-4 py-2 text-right">Events</th>
                            <th className="px-4 py-2 text-right">Total RSVPs</th>
                            <th className="px-4 py-2 text-right">Attendees</th>
                            <th className="px-4 py-2 text-right">Avg Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {stats.map(s => (
                            <tr key={s.portal} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{PORTAL_META[s.portal]?.emoji} {PORTAL_META[s.portal]?.name ?? s.portal}</td>
                              <td className="px-4 py-2 text-right">{s.total_events}</td>
                              <td className="px-4 py-2 text-right">{s.total_rsvps}</td>
                              <td className="px-4 py-2 text-right">{s.total_attendees}</td>
                              <td className="px-4 py-2 text-right">{s.avg_attendance_rate ? `${(Number(s.avg_attendance_rate)*100).toFixed(1)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: All Events ── */}
        {tab === 'All Events' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select value={filterPortal} onChange={e => setFilterPortal(e.target.value)} className="rounded border px-3 py-1.5 text-sm bg-white">
                <option value="">All Portals</option>
                {Object.entries(PORTAL_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.name}</option>)}
              </select>
              <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} className="rounded border px-3 py-1.5 text-sm bg-white">
                <option value="">All Formats</option>
                {FORMATS.map(f => <option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded border px-3 py-1.5 text-sm bg-white">
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded border px-3 py-1.5 text-sm bg-white">
                <option value="">All Types</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={loadEvents} className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">Filter</button>
              <span className="text-xs text-gray-400 ml-auto">{events.length} events</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {events.map(ev => {
                const meta = PORTAL_META[ev.portal];
                const portalColors: Record<string,string> = {
                  meetup: 'bg-red-100', eventbrite: 'bg-orange-100', luma: 'bg-purple-100',
                  google_meet: 'bg-blue-100', zoom: 'bg-indigo-100', facebook_events: 'bg-blue-200',
                  linkedin_events: 'bg-sky-100', humanitix: 'bg-teal-100', ticketmaster: 'bg-cyan-100',
                };
                return (
                  <div key={ev.id} className="rounded-lg border bg-white overflow-hidden hover:shadow-sm">
                    <div className={`h-2 ${portalColors[ev.portal] ?? 'bg-gray-100'}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-sm font-semibold text-gray-800 leading-tight">{ev.title}</div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{meta?.emoji} {meta?.name ?? ev.portal}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${formatBadge(ev.format)}`}>{ev.format.replace(/_/g,' ')}</span>
                        </div>
                      </div>
                      {ev.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{ev.description}</p>}
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>📅 {fmtDate(ev.start_at)}</div>
                        {ev.location_name && <div>📍 {ev.location_name}</div>}
                        {ev.meeting_url && <div>🔗 <a href={ev.meeting_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">Join link</a></div>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-gray-500">
                          {ev.rsvp_count} RSVPs{ev.capacity ? ` / ${ev.capacity}` : ''}
                        </div>
                        <div>
                          {ev.is_free ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Free</span>
                          ) : (
                            <span className="text-xs text-gray-700 font-medium">${Number(ev.ticket_price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400 text-sm">No events found. Try syncing or adjusting filters.</div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Meetup.com ── */}
        {tab === 'Meetup.com' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Group info */}
              <div className="rounded-lg border bg-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">📅</span>
                  <div>
                    <div className="font-semibold text-gray-800">Meetup.com Group</div>
                    <div className="text-xs text-gray-500">
                      {portals.find(p=>p.portal==='meetup')?.org_name ?? 'Not configured'}
                    </div>
                  </div>
                </div>
                {(() => {
                  const s = stats.find(x => x.portal === 'meetup');
                  return s ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded border bg-red-50 p-2 text-center"><div className="font-bold text-red-700">{s.total_events}</div><div className="text-xs text-gray-500">Events</div></div>
                      <div className="rounded border bg-red-50 p-2 text-center"><div className="font-bold text-red-700">{s.total_rsvps}</div><div className="text-xs text-gray-500">Total RSVPs</div></div>
                      <div className="rounded border bg-red-50 p-2 text-center"><div className="font-bold text-red-700">{s.total_attendees}</div><div className="text-xs text-gray-500">Attended</div></div>
                      <div className="rounded border bg-red-50 p-2 text-center"><div className="font-bold text-red-700">{s.avg_attendance_rate ? `${(Number(s.avg_attendance_rate)*100).toFixed(0)}%` : '—'}</div><div className="text-xs text-gray-500">Avg Rate</div></div>
                    </div>
                  ) : null;
                })()}
                <button onClick={() => handleSyncAll('meetup')} disabled={syncing} className="mt-4 w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50">
                  ↻ Sync Meetup Events
                </button>
              </div>

              {/* Setup section */}
              <div className="rounded-lg border bg-white p-5">
                <div className="font-semibold text-gray-800 mb-3">API Setup</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-600">MEETUP_API_KEY</span>
                    <span className="text-gray-400">Not set</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-600">MEETUP_GROUP_URLNAME</span>
                    <span className="text-gray-400">Not set</span>
                  </div>
                </div>
                <a href="https://secure.meetup.com/meetup_api" target="_blank" rel="noreferrer" className="mt-3 block text-xs text-blue-600 hover:underline">→ Get API key at secure.meetup.com/meetup_api</a>
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Running in demo mode — events are seeded locally.</div>
              </div>

              {/* Analytics */}
              <div className="rounded-lg border bg-white p-5">
                <div className="font-semibold text-gray-800 mb-3">Event Analytics</div>
                {(() => {
                  const s = stats.find(x => x.portal === 'meetup');
                  if (!s) return <div className="text-xs text-gray-400">No data</div>;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Avg RSVPs / event</span><span className="font-medium">{s.total_events > 0 ? Math.round(s.total_rsvps / s.total_events) : 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Attendance rate</span><span className="font-medium">{s.avg_attendance_rate ? `${(Number(s.avg_attendance_rate)*100).toFixed(1)}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Total attended</span><span className="font-medium">{s.total_attendees}</span></div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Meetup event list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Meetup Events ({meetupEvents.length})</h3>
                <button onClick={() => setShowCreateModal(true)} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Post to Meetup</button>
              </div>
              <div className="space-y-3">
                {meetupEvents.length === 0 && <div className="text-sm text-gray-400 py-6 text-center">No Meetup events. Click "↻ Sync All" to import demo events.</div>}
                {meetupEvents.map(ev => (
                  <div key={ev.id} className="rounded-lg border bg-white p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800">{ev.title}</div>
                      <div className="text-xs text-gray-500 mt-1">📅 {fmtDate(ev.start_at)} · {ev.format.replace(/_/g,' ')}</div>
                      {ev.location_name && <div className="text-xs text-gray-500">📍 {ev.location_name}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-red-700">{ev.rsvp_count}</div>
                      <div className="text-xs text-gray-400">RSVPs</div>
                      {ev.is_free ? <div className="text-xs text-green-600 mt-1">Free</div> : <div className="text-xs text-gray-600">${Number(ev.ticket_price).toFixed(2)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Attendees ── */}
        {tab === 'Attendees' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="rounded border px-3 py-2 text-sm bg-white min-w-[280px]"
              >
                <option value="">— Select an event —</option>
                {events.length === 0 && <option disabled>Load "All Events" tab first</option>}
                {events.map(ev => <option key={ev.id} value={ev.id}>{PORTAL_META[ev.portal]?.emoji} {ev.title} ({fmtShort(ev.start_at)})</option>)}
              </select>
              {selectedEventId && (
                <>
                  <button onClick={handleBulkCheckin} className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700">✓ Mark All Present</button>
                  <button onClick={exportCsv} className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50">⬇ Export CSV</button>
                </>
              )}
            </div>

            {selectedEventId && (
              <>
                {/* Stats */}
                {attendeeStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard label="Going" value={attendeeStats.going} color="green" />
                    <KpiCard label="Waitlist" value={attendeeStats.waitlist} color="amber" />
                    <KpiCard label="Not Going" value={attendeeStats.not_going} color="gray" />
                    <KpiCard label="Checked In" value={attendeeStats.checked_in} color="blue" />
                    <KpiCard
                      label="Attendance Rate"
                      value={Number(attendeeStats.going) > 0 && Number(attendeeStats.total) > 0 ? `${Math.round((Number(attendeeStats.checked_in)/Number(attendeeStats.going))*100)}%` : '—'}
                      color="purple"
                    />
                  </div>
                )}

                {/* QR placeholder */}
                <div className="rounded-lg border bg-white p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl">📱</div>
                  <div>
                    <div className="font-medium text-sm text-gray-700">QR Check-in</div>
                    <div className="text-xs text-gray-400 mt-0.5">Scan attendee QR code to check them in automatically</div>
                    <div className="text-xs text-amber-600 mt-1">QR scanning requires mobile integration — use manual check-in below</div>
                  </div>
                </div>

                {/* Add attendee */}
                <div className="rounded-lg border bg-white p-4">
                  <div className="font-medium text-sm text-gray-700 mb-3">Add Attendee Manually</div>
                  <div className="flex flex-wrap gap-3">
                    <input value={addAttendeeForm.name} onChange={e => setAddAttendeeForm({...addAttendeeForm, name: e.target.value})} placeholder="Full name" className="rounded border px-3 py-1.5 text-sm w-40" />
                    <input value={addAttendeeForm.email} onChange={e => setAddAttendeeForm({...addAttendeeForm, email: e.target.value})} placeholder="Email" className="rounded border px-3 py-1.5 text-sm w-48" />
                    <input value={addAttendeeForm.phone} onChange={e => setAddAttendeeForm({...addAttendeeForm, phone: e.target.value})} placeholder="Phone" className="rounded border px-3 py-1.5 text-sm w-36" />
                    <input value={addAttendeeForm.ticket_type} onChange={e => setAddAttendeeForm({...addAttendeeForm, ticket_type: e.target.value})} placeholder="Ticket type" className="rounded border px-3 py-1.5 text-sm w-28" />
                    <button onClick={handleAddAttendee} disabled={addingAttendee} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                      {addingAttendee ? 'Adding…' : '+ Add'}
                    </button>
                  </div>
                </div>

                {/* Attendees table */}
                {attendeesLoading ? (
                  <div className="text-gray-400 text-sm">Loading attendees…</div>
                ) : (
                  <div className="rounded-lg border bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Email</th>
                          <th className="px-4 py-2 text-left">RSVP</th>
                          <th className="px-4 py-2 text-left">Ticket</th>
                          <th className="px-4 py-2 text-left">Registered</th>
                          <th className="px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {attendees.map(a => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{a.name ?? '—'}</td>
                            <td className="px-4 py-2 text-gray-500">{a.email ?? '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${rsvpBadge(a.rsvp_status)}`}>{a.rsvp_status.replace(/_/g,' ')}</span>
                            </td>
                            <td className="px-4 py-2 text-gray-500">{a.ticket_type ?? '—'}</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(a.registered_at)}</td>
                            <td className="px-4 py-2">
                              {a.rsvp_status !== 'checked_in' ? (
                                <button onClick={() => handleCheckin(a.id)} className="text-xs bg-green-600 text-white rounded px-2 py-0.5 hover:bg-green-700">Check In</button>
                              ) : (
                                <span className="text-xs text-green-600">✓ {a.checked_in_at ? fmtShort(a.checked_in_at) : 'Checked in'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {attendees.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No attendees for this event.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {!selectedEventId && (
              <div className="text-center py-12 text-gray-400 text-sm">Select an event above to manage attendees.</div>
            )}
          </div>
        )}

        {/* ── Tab: Business Events ── */}
        {tab === 'Business Events' && (
          <div className="space-y-6">
            {/* Create business event */}
            <div className="rounded-lg border bg-white p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Create Business Event</h3>
              {bizResult && <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{bizResult}</div>}
              {bizError && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{bizError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                  <input value={bizForm.title} onChange={e => setBizForm({...bizForm, title: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Annual Wellness Conference 2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
                  <select value={bizForm.event_type} onChange={e => setBizForm({...bizForm, event_type: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm">
                    {['conference','networking','business','hackathon','workshop'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={bizForm.description} onChange={e => setBizForm({...bizForm, description: e.target.value})} rows={2} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date/Time</label>
                  <input type="datetime-local" value={bizForm.start_at} onChange={e => setBizForm({...bizForm, start_at: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date/Time</label>
                  <input type="datetime-local" value={bizForm.end_at} onChange={e => setBizForm({...bizForm, end_at: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Venue Name</label>
                  <input value={bizForm.location_name} onChange={e => setBizForm({...bizForm, location_name: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Metro Toronto Convention Centre" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input value={bizForm.location_address} onChange={e => setBizForm({...bizForm, location_address: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Event Website URL</label>
                  <input value={bizForm.website_url} onChange={e => setBizForm({...bizForm, website_url: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="https://event.example.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Social Hashtag</label>
                  <input value={bizForm.hashtag} onChange={e => setBizForm({...bizForm, hashtag: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="#YogaSummit2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
                  <input type="number" value={bizForm.capacity} onChange={e => setBizForm({...bizForm, capacity: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ticket Price</label>
                  <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={bizForm.is_free} onChange={e => setBizForm({...bizForm, is_free: e.target.checked})} /> Free</label>
                    {!bizForm.is_free && <input type="number" step="0.01" value={bizForm.ticket_price} onChange={e => setBizForm({...bizForm, ticket_price: e.target.value})} className="flex-1 rounded border px-3 py-1.5 text-sm" placeholder="0.00" />}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sponsors (comma-separated)</label>
                  <input value={bizForm.sponsors} onChange={e => setBizForm({...bizForm, sponsors: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Lululemon, Gaiam, Manduka" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tags</label>
                  <input value={bizForm.tags} onChange={e => setBizForm({...bizForm, tags: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="conference, yoga, wellness" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Speakers (name - bio, one per line)</label>
                  <textarea value={bizForm.speakers} onChange={e => setBizForm({...bizForm, speakers: e.target.value})} rows={2} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Jane Smith - Lead yoga instructor, 15 years&#10;Dr. Raj Kumar - Wellness researcher" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Agenda (time - activity, one per line)</label>
                  <textarea value={bizForm.agenda} onChange={e => setBizForm({...bizForm, agenda: e.target.value})} rows={3} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="09:00 - Registration &amp; Welcome&#10;10:00 - Keynote: Future of Yoga&#10;12:00 - Lunch Break" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Cost ($)</label>
                  <input type="number" value={bizForm.estimated_cost} onChange={e => setBizForm({...bizForm, estimated_cost: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Actual Cost ($)</label>
                  <input type="number" value={bizForm.actual_cost} onChange={e => setBizForm({...bizForm, actual_cost: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              </div>

              <button onClick={handleCreateBizEvent} disabled={bizSaving} className="mt-4 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {bizSaving ? 'Creating…' : 'Create Business Event'}
              </button>
            </div>

            {/* Existing business events */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Business Events</h3>
              <div className="space-y-3">
                {events.filter(e => ['conference','business','hackathon'].includes(e.event_type)).map(ev => (
                  <div key={ev.id} className="rounded-lg border bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-800">{ev.title}</div>
                        <div className="text-xs text-gray-500 mt-1 space-x-3">
                          <span>📅 {fmtDate(ev.start_at)}</span>
                          <span>🏷️ {ev.event_type}</span>
                          {ev.location_name && <span>📍 {ev.location_name}</span>}
                        </div>
                        {ev.tags && ev.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {ev.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-gray-700">{ev.rsvp_count} RSVPs</div>
                        {ev.capacity && <div className="text-xs text-gray-400">{ev.capacity} capacity</div>}
                        {ev.is_free ? <div className="text-xs text-green-600 mt-1">Free</div> : <div className="text-xs font-medium text-gray-700">${Number(ev.ticket_price).toFixed(2)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {events.filter(e => ['conference','business','hackathon'].includes(e.event_type)).length === 0 && (
                  <div className="text-sm text-gray-400 py-6 text-center">No business events yet.</div>
                )}
              </div>
            </div>

            {/* Google Meet quick create */}
            <div className="rounded-lg border bg-white p-5">
              <h3 className="font-semibold text-gray-800 mb-3">🎥 Create Google Meet Link</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meeting Title</label>
                  <input value={meetForm.title} onChange={e => setMeetForm({...meetForm, title: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" placeholder="Team Strategy Call" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                  <input type="datetime-local" value={meetForm.start_at} onChange={e => setMeetForm({...meetForm, start_at: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                  <input type="datetime-local" value={meetForm.end_at} onChange={e => setMeetForm({...meetForm, end_at: e.target.value})} className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
              </div>
              <button onClick={handleCreateMeet} disabled={creatingMeet} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {creatingMeet ? 'Creating…' : '🎥 Generate Meet Link'}
              </button>
              {meetResult && (
                <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
                  <div className="font-medium text-blue-800 mb-1">Meet Link:</div>
                  <a href={meetResult.meeting_url as string} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{meetResult.meeting_url as string}</a>
                  {Boolean(meetResult.warning) && <div className="text-amber-600 text-xs mt-2">{String(meetResult.warning)}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Setup ── */}
        {tab === 'Setup' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Add environment variables to your <code className="font-mono text-xs">.env.local</code> file and restart the dev server to activate each portal.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(PORTAL_ENV).map(([portal, cfg]) => {
                const meta = PORTAL_META[portal];
                const conn = portals.find(p => p.portal === portal);
                return (
                  <div key={portal} className={`rounded-lg border p-5 ${meta?.bg ?? 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{meta?.emoji}</span>
                      <div>
                        <div className={`font-semibold text-sm ${meta?.color ?? 'text-gray-700'}`}>{meta?.name ?? portal}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${statusDot(conn?.status ?? 'disconnected')}`} />
                          <span className="text-xs text-gray-500">{statusLabel(conn?.status ?? 'disconnected')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {cfg.vars.map(v => (
                        <div key={v} className="flex items-center justify-between text-xs">
                          <code className="font-mono text-gray-700">{v}</code>
                          <span className="text-gray-400">✗ not set</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3 space-y-1">
                      <div className="text-xs font-medium text-gray-600 mb-1.5">{cfg.steps.length} steps to connect:</div>
                      {cfg.steps.map((step, i) => (
                        <div key={i} className="flex gap-1.5 text-xs text-gray-500">
                          <span className="shrink-0 font-medium text-gray-400">{i+1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>

                    <a href={cfg.url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-blue-600 hover:underline">→ {cfg.url.replace('https://','')}</a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateEventModal
          portals={portals}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { loadDashboard(); loadEvents(); }}
        />
      )}
    </div>
  );
}
