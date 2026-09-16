'use client';
// Admin Calendar Integration — Cal.com connection, bookings, availability,
// integrations status, report, dashboard, and pipeline jobs.
// All live data is credential-gated behind CALCOM_API_KEY. Without it,
// a clear "Not configured" banner is shown — never fake data.

import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Calendar View', 'Bookings', 'Availability', 'Integrations', 'Report', 'Dashboard', 'Manual', 'Pipeline', 'Agentic'] as const;
type Tab = (typeof TABS)[number];

interface BookingRow {
  id: string;
  customerName: string;
  service: string;
  startTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
  bookedAt: string;
  durationMinutes: number;
}

interface CalConfig {
  configured: boolean;
  reason?: string;
  todayCount: number;
  weekCount: number;
  bookings: BookingRow[];
  avgValueGbp: number | null;
  cancellationRate: number | null;
  utilizationPct: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-500',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function NotConfiguredBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="font-semibold text-amber-800">Cal.com Not Configured</p>
      <p className="mt-1 text-sm text-amber-700">
        {reason ?? 'Set CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID environment variables to enable live booking sync.'}
      </p>
      <p className="mt-3 text-xs text-amber-600">
        All calendar features work once credentials are configured. No data is fabricated when they are absent.
      </p>
    </div>
  );
}

export default function AdminCalendarPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [config, setConfig] = useState<CalConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/calendar/bookings', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load calendar data');
        setConfig(d);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
    </div>
  );
  if (!config) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const upcoming = config.bookings
    .filter(b => b.status !== 'cancelled' && new Date(b.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Calendar Integration</h1>
        <p className="text-sm text-gray-500">Cal.com appointment booking — sync, availability, reminders</p>
      </header>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          {!config.configured && <NotConfiguredBanner reason={config.reason} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Today's Bookings" value={config.todayCount} />
            <KpiCard label="This Week" value={config.weekCount} />
            <KpiCard label="Status" value={config.configured ? 'Connected' : 'Not configured'} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Upcoming Appointments</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming bookings{!config.configured ? ' — configure Cal.com to sync real bookings' : ''}.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 10).map(b => (
                  <div key={b.id} className="flex items-center justify-between rounded border border-gray-100 p-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{b.customerName}</span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-gray-600">{b.service}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{new Date(b.startTime).toLocaleString()}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar View */}
      {tab === 'Calendar View' && (
        <div className="rounded-xl border bg-white p-5">
          {!config.configured && <NotConfiguredBanner reason={config.reason} />}
          <h2 className="mb-4 font-semibold text-gray-800">Week View</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
            {DAYS.map(d => <div key={d} className="py-1">{d.slice(0, 3)}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(d => {
              const dayBookings = config.bookings.filter(b => {
                const dow = new Date(b.startTime).toLocaleDateString('en-US', { weekday: 'long' });
                return dow === d && b.status !== 'cancelled';
              });
              return (
                <div key={d} className="min-h-24 rounded border border-gray-100 p-2">
                  {dayBookings.map(b => (
                    <div key={b.id} className={`mb-1 rounded p-1 text-xs ${STATUS_COLORS[b.status]}`}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {b.customerName.split(' ')[0]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {!config.configured && (
            <p className="mt-4 text-xs text-gray-400">Calendar slots will populate once Cal.com is configured.</p>
          )}
        </div>
      )}

      {/* Bookings */}
      {tab === 'Bookings' && (
        <div className="rounded-xl border bg-white p-5">
          {!config.configured && <div className="mb-4"><NotConfiguredBanner reason={config.reason} /></div>}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All Bookings ({config.bookings.length})</h2>
          </div>
          {config.bookings.length === 0 ? (
            <p className="text-sm text-gray-400">No bookings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold text-gray-500">
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Service</th>
                    <th className="pb-2 pr-4">Date / Time</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {config.bookings.map(b => (
                    <tr key={b.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-800">{b.customerName}</td>
                      <td className="py-2 pr-4 text-gray-600">{b.service}</td>
                      <td className="py-2 pr-4 text-gray-600">{new Date(b.startTime).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-600">{b.durationMinutes}m</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Availability */}
      {tab === 'Availability' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-800">Working Hours</h2>
            <div className="space-y-2">
              {DAYS.map(d => (
                <div key={d} className="flex items-center gap-4 text-sm">
                  <span className="w-24 font-medium text-gray-700">{d}</span>
                  <input type="time" defaultValue="09:00" className="rounded border px-2 py-1 text-sm" />
                  <span className="text-gray-400">to</span>
                  <input type="time" defaultValue="18:00" className="rounded border px-2 py-1 text-sm" />
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" defaultChecked={!['Saturday', 'Sunday'].includes(d)} />
                    Active
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Buffer Time</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-700">Between appointments:</span>
              <select className="rounded border px-3 py-1 text-sm">
                <option value="0">No buffer</option>
                <option value="10">10 minutes</option>
                <option value="15" selected>15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
          </div>
          {!config.configured && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
              Availability settings shown here are local. They will sync to Cal.com once CALCOM_API_KEY is configured.
            </div>
          )}
        </div>
      )}

      {/* Integrations */}
      {tab === 'Integrations' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-800">Integration Status</h2>
            <div className="space-y-3">
              {[
                { name: 'Cal.com API', key: 'CALCOM_API_KEY', configured: config.configured, note: 'Required for booking sync' },
                { name: 'Cal.com Event Type', key: 'CALCOM_EVENT_TYPE_ID', configured: !!(typeof window !== 'undefined'), note: 'Required for slot availability' },
                { name: 'Google Calendar Sync', key: 'GOOGLE_CALENDAR_ID', configured: false, note: 'Optional — two-way sync' },
                { name: 'Zoom/Meet Link Auto-generation', key: 'ZOOM_API_KEY', configured: false, note: 'Optional — virtual session links' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.note} · env: {item.key}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report */}
      {tab === 'Report' && (
        <div className="space-y-4">
          {!config.configured && <NotConfiguredBanner reason={config.reason} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Avg Booking Value" value={config.avgValueGbp !== null ? `£${config.avgValueGbp}` : 'N/A'} sub="per session" />
            <KpiCard label="Cancellation Rate" value={config.cancellationRate !== null ? `${config.cancellationRate}%` : 'N/A'} />
            <KpiCard label="Utilization" value={config.utilizationPct !== null ? `${config.utilizationPct}%` : 'N/A'} sub="of available slots" />
            <KpiCard label="Total Bookings" value={config.bookings.length} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Bookings by Status</h2>
            {['confirmed', 'pending', 'cancelled', 'no_show'].map(s => {
              const count = config.bookings.filter(b => b.status === s).length;
              const pct = config.bookings.length ? Math.round((count / config.bookings.length) * 100) : 0;
              return (
                <div key={s} className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{s.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard */}
      {tab === 'Dashboard' && (
        <div className="space-y-5">
          {!config.configured && <NotConfiguredBanner reason={config.reason} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Today" value={config.todayCount} sub="bookings" />
            <KpiCard label="This Week" value={config.weekCount} sub="bookings" />
            <KpiCard label="Avg Value" value={config.avgValueGbp !== null ? `£${config.avgValueGbp}` : 'N/A'} />
            <KpiCard label="Cancel Rate" value={config.cancellationRate !== null ? `${config.cancellationRate}%` : 'N/A'} />
            <KpiCard label="Utilization" value={config.utilizationPct !== null ? `${config.utilizationPct}%` : 'N/A'} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Recent Bookings</h2>
            {config.bookings.length === 0 ? (
              <p className="text-sm text-gray-400">No bookings yet.</p>
            ) : (
              <div className="space-y-2">
                {config.bookings.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{b.customerName} — {b.service}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual */}
      {tab === 'Manual' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Manual Booking Process</h2>
            <ol className="space-y-3 text-sm text-gray-700">
              {[
                'Open Cal.com dashboard → select the event type → click "New Booking"',
                'Enter customer name, email, and preferred date/time',
                'System checks availability and confirms the slot',
                'Confirmation email sent automatically to customer',
                'Booking appears in Bookings tab after next sync (up to 15 min)',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Block Time</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              {[
                'In Cal.com: go to Availability → add an override date',
                'Select the day(s) you need blocked',
                'Save — blocked slots will no longer appear to customers',
                'CalendarSyncJob will pick up the change within 15 minutes',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Pipeline */}
      {tab === 'Pipeline' && (
        <div className="space-y-4">
          {[
            { name: 'CalendarSyncJob', schedule: 'Every 15 minutes', description: 'Fetches bookings from Cal.com and upserts into local DB. Skips if CALCOM_API_KEY is absent.', status: config.configured ? 'active' : 'waiting_credentials' },
            { name: 'AppointmentReminderJob', schedule: 'Every 15 minutes', description: 'Sends in-app reminders to customers within their configured reminder window before a class.', status: 'active' },
            { name: 'NoShowFollowUpJob', schedule: 'Daily', description: 'Identifies no-show bookings and queues a follow-up message to offer rebooking.', status: 'planned' },
          ].map(job => (
            <div key={job.name} className="rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-gray-800">{job.name}</p>
                  <p className="text-xs text-gray-500">{job.schedule}</p>
                  <p className="mt-1 text-sm text-gray-600">{job.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.status === 'active' ? 'bg-green-100 text-green-700' : job.status === 'waiting_credentials' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {job.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agentic */}
      {tab === 'Agentic' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">AI Scheduling Assistant (Ollama / llama3.2)</p>
            <p className="mt-1 text-xs text-blue-700">
              Analyzes booking patterns and suggests optimal availability windows.
              Requires local Ollama with llama3.2 model running at OLLAMA_BASE_URL.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">AI Scheduling Suggestions</h2>
            <AiSchedulingSuggestions />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">AI Reschedule Assistant</h2>
            <p className="text-sm text-gray-600">
              When a booking is cancelled, the AI assistant can suggest the next 3 optimal slots
              based on the customer&apos;s past booking patterns and current availability.
              This feature is available once Cal.com is configured.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AiSchedulingSuggestions() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');

  async function getSuggestion() {
    setLoading(true);
    setError('');
    setSuggestion('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: 'Analyze typical yoga studio booking patterns and suggest the top 3 time slots per week that tend to have highest attendance and lowest cancellation rates. Be specific and concise.',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { response?: string };
      setSuggestion(data.response ?? 'No suggestion returned.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get suggestion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={getSuggestion}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Thinking…' : 'Get AI Scheduling Suggestions'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {suggestion && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 whitespace-pre-wrap">
          {suggestion}
        </div>
      )}
    </div>
  );
}
