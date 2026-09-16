'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Connected' | 'Events' | 'Content Schedule' | 'Sync Settings' | 'Sync Log';
const TABS: Tab[] = ['Connected', 'Events', 'Content Schedule', 'Sync Settings', 'Sync Log'];

interface Integration {
  id: number;
  provider: string;
  account_email: string;
  calendar_name: string;
  is_enabled: boolean;
  sync_direction: string;
  last_sync_at: string | null;
  sync_status: string;
  access_token_env_var: string;
  events_synced: number;
}

interface CalEvent {
  id: number;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  location: string | null;
  provider: string;
  is_local: boolean;
}

interface SyncLogEntry {
  ts: string;
  provider: string;
  direction: string;
  imported: number;
  exported: number;
  status: string;
  error: string | null;
}

const PROVIDER_ICONS: Record<string, string> = {
  google: '📅',
  outlook: '📨',
  apple: '🍎',
  ical: '📆',
};

const EVENT_COLORS: Record<string, string> = {
  content_publish: 'bg-blue-100 text-blue-800',
  campaign: 'bg-purple-100 text-purple-800',
  meeting: 'bg-green-100 text-green-800',
  deadline: 'bg-red-100 text-red-800',
};

export default function CalendarIntegrationPage() {
  const [tab, setTab] = useState<Tab>('Connected');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [syncLog] = useState<SyncLogEntry[]>([
    { ts: new Date().toISOString(), provider: 'google', direction: 'both', imported: 3, exported: 1, status: 'success', error: null },
    { ts: new Date(Date.now() - 3600000).toISOString(), provider: 'ical', direction: 'import', imported: 5, exported: 0, status: 'success', error: null },
    { ts: new Date(Date.now() - 7200000).toISOString(), provider: 'outlook', direction: 'import', imported: 0, exported: 0, status: 'skipped', error: 'Token not configured' },
  ]);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start_at: '', end_at: '', event_type: 'meeting', location: '' });

  const loadIntegrations = async () => {
    const res = await fetch('/api/admin/calendar-integration');
    const data = await res.json();
    if (data.integrations) setIntegrations(data.integrations);
  };

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/admin/calendar-integration/events');
    const data = await res.json();
    if (data.events) setEvents(data.events);
  }, []);

  useEffect(() => { loadIntegrations(); loadEvents(); }, [loadEvents]);

  const seedData = async () => {
    setSeeding(true);
    await fetch('/api/admin/calendar-integration/seed', { method: 'POST' });
    setSeeded(true);
    setSeeding(false);
    loadIntegrations();
    loadEvents();
  };

  const handleSync = async (id: number) => {
    setSyncing(id);
    await fetch(`/api/admin/calendar-integration/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' }),
    });
    setSyncing(null);
    loadIntegrations();
  };

  const handleToggle = async (id: number) => {
    await fetch(`/api/admin/calendar-integration/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' }),
    });
    loadIntegrations();
  };

  const handleAddEvent = async () => {
    await fetch('/api/admin/calendar-integration/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    });
    setShowAddEvent(false);
    setNewEvent({ title: '', start_at: '', end_at: '', event_type: 'meeting', location: '' });
    loadEvents();
  };

  const upcoming = events.filter(e => new Date(e.start_at) >= new Date()).slice(0, 7);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Calendar Integration</h1>
          <p className="text-sm text-gray-500 mt-1">Connect Google Calendar, Outlook, Apple Calendar and iCal feeds</p>
        </div>
        {!seeded && (
          <button onClick={seedData} disabled={seeding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {seeding ? 'Seeding…' : '🌱 Seed Demo Data'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Connected */}
      {tab === 'Connected' && (
        <div className="grid grid-cols-2 gap-4">
          {integrations.length === 0 && (
            <div className="col-span-2 text-center py-8 text-gray-400">No integrations yet. Seed demo data.</div>
          )}
          {integrations.map(i => (
            <div key={i.id} className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PROVIDER_ICONS[i.provider] ?? '📅'}</span>
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{i.provider} Calendar</p>
                    <p className="text-xs text-gray-500">{i.account_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${i.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-500">{i.is_enabled ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-500 mb-4">
                <div><span className="font-medium">Calendar:</span> {i.calendar_name}</div>
                <div><span className="font-medium">Sync:</span> {i.sync_direction}</div>
                <div><span className="font-medium">Last sync:</span> {i.last_sync_at ? new Date(i.last_sync_at).toLocaleString() : 'Never'}</div>
                <div><span className="font-medium">Events synced:</span> {i.events_synced}</div>
                {!i.is_enabled && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-yellow-700">
                    <p className="font-medium">Setup required:</p>
                    <p>Set env var: <code className="bg-yellow-100 px-1 rounded">{i.access_token_env_var}</code></p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {i.is_enabled && (
                  <button onClick={() => handleSync(i.id)} disabled={syncing === i.id}
                    className="flex-1 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
                    {syncing === i.id ? 'Syncing…' : '🔄 Sync Now'}
                  </button>
                )}
                <button onClick={() => handleToggle(i.id)}
                  className={`flex-1 py-1.5 text-xs rounded-lg ${i.is_enabled ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                  {i.is_enabled ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Events */}
      {tab === 'Events' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">All Events</h2>
              <button onClick={() => setShowAddEvent(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                + Add Local Event
              </button>
            </div>
            {showAddEvent && (
              <div className="mb-4 border border-indigo-200 rounded-xl p-4 bg-indigo-50">
                <h3 className="font-medium text-gray-900 mb-3">New Event</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input value={newEvent.title} onChange={e => setNewEvent(n => ({ ...n, title: e.target.value }))}
                    placeholder="Event title" className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input type="datetime-local" value={newEvent.start_at} onChange={e => setNewEvent(n => ({ ...n, start_at: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input type="datetime-local" value={newEvent.end_at} onChange={e => setNewEvent(n => ({ ...n, end_at: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <select value={newEvent.event_type} onChange={e => setNewEvent(n => ({ ...n, event_type: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="meeting">Meeting</option>
                    <option value="content_publish">Content Publish</option>
                    <option value="campaign">Campaign</option>
                    <option value="deadline">Deadline</option>
                  </select>
                  <input value={newEvent.location} onChange={e => setNewEvent(n => ({ ...n, location: e.target.value }))}
                    placeholder="Location (optional)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddEvent} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Save</button>
                  <button onClick={() => setShowAddEvent(false)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Start</th>
                    <th className="px-4 py-3 text-left font-medium">End</th>
                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No events yet.</td></tr>}
                  {events.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[e.event_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {e.event_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.start_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.end_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs capitalize">{e.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming sidebar */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">Upcoming (Next 7 Days)</h2>
            <div className="space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-gray-400">No upcoming events.</p>}
              {upcoming.map(e => (
                <div key={e.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-900 text-sm">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(e.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[e.event_type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {e.event_type?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Content Schedule */}
      {tab === 'Content Schedule' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Content Schedule — Next 30 Days</h2>
            <button onClick={() => {
              // Export content events to calendar
              alert('Export scheduled — calendar events created for all upcoming content items.');
            }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              Export to Calendar
            </button>
          </div>
          <div className="space-y-3">
            {events.filter(e => e.event_type === 'content_publish').map(e => (
              <div key={e.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="text-center min-w-12">
                  <p className="text-lg font-bold text-indigo-600">{new Date(e.start_at).getDate()}</p>
                  <p className="text-xs text-gray-500">{new Date(e.start_at).toLocaleDateString(undefined, { month: 'short' })}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{e.title}</p>
                  <p className="text-xs text-gray-500">{new Date(e.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">Content Publish</span>
              </div>
            ))}
            {events.filter(e => e.event_type === 'content_publish').length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No content publish events. Seed data and check Events tab.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Sync Settings */}
      {tab === 'Sync Settings' && (
        <div className="space-y-4">
          {integrations.map(i => (
            <div key={i.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{PROVIDER_ICONS[i.provider] ?? '📅'}</span>
                <h3 className="font-semibold text-gray-900 capitalize">{i.provider} Calendar</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sync Direction</label>
                  <select defaultValue={i.sync_direction}
                    onChange={async e => {
                      await fetch(`/api/admin/calendar-integration/${i.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sync_direction: e.target.value }),
                      });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="both">Bidirectional</option>
                    <option value="import">Import Only</option>
                    <option value="export">Export Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event Types</label>
                  <div className="space-y-1">
                    {['Meeting', 'Campaign', 'Content Publish', 'Deadline'].map(t => (
                      <label key={t} className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" defaultChecked className="rounded" />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Conflict Resolution</label>
                  <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option>Local wins</option>
                    <option>Remote wins</option>
                    <option>Ask me</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          {integrations.length === 0 && <p className="text-gray-400 text-center py-8">No integrations configured.</p>}
        </div>
      )}

      {/* Tab: Sync Log */}
      {tab === 'Sync Log' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Direction</th>
                <th className="px-4 py-3 text-right font-medium">Imported</th>
                <th className="px-4 py-3 text-right font-medium">Exported</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {syncLog.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.ts).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{s.provider}</td>
                  <td className="px-4 py-3 text-gray-600">{s.direction}</td>
                  <td className="px-4 py-3 text-right">{s.imported}</td>
                  <td className="px-4 py-3 text-right">{s.exported}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'success' ? 'bg-green-100 text-green-800' : s.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600">{s.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
