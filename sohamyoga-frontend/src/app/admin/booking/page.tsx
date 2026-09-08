'use client';
import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Today', 'Upcoming', 'Waitlist', 'No-shows', 'Rules', 'Reports'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface DashboardData {
  kpis: {
    totalBookingsMonth: number; confirmedToday: number; pendingConfirmations: number;
    cancellationsMonth: number; cancellationRatePct: number; noShowsMonth: number;
    noShowRatePct: number; waitlistConversionPct: number;
  };
  channelSplit: { channel: string; pct: number }[];
  last14Days: number[];
}

function OverviewTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => { fetchJson<DashboardData>('/api/booking/dashboard').then(setData); }, []);
  const k = data?.kpis;
  const maxDay = Math.max(1, ...(data?.last14Days ?? [0]));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Bookings (Month)" value={String(k?.totalBookingsMonth ?? 0)} color="blue" />
        <KpiCard label="Confirmed Today"         value={String(k?.confirmedToday ?? 0)} color="green" />
        <KpiCard label="Pending Confirmations"   value={String(k?.pendingConfirmations ?? 0)} color="amber" />
        <KpiCard label="Cancellations (Month)"   value={String(k?.cancellationsMonth ?? 0)} sub={`${k?.cancellationRatePct ?? 0}% rate`} color="rose" />
        <KpiCard label="No-shows (Month)"        value={String(k?.noShowsMonth ?? 0)} sub={`${k?.noShowRatePct ?? 0}% rate`} color="rose" />
        <KpiCard label="Waitlist Conversions"    value={`${k?.waitlistConversionPct ?? 0}%`} color="teal" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Booking Channel Split (Month)</h3>
          {!data?.channelSplit.length ? <EmptyState message="No bookings this month yet." /> : data.channelSplit.map(c => (
            <div key={c.channel} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-24 text-gray-600 capitalize">{c.channel.replace('_', ' ')}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: `${c.pct}%` }} /></div>
              <span className="w-8 text-right font-medium">{c.pct}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Daily Bookings — Last 14 Days</h3>
          <div className="flex items-end gap-1 h-24">
            {(data?.last14Days ?? Array(14).fill(0)).map((v, i) => (
              <div key={i} className="flex-1 bg-blue-400 rounded-t" style={{ height: `${(v / maxDay) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TodayBooking { id: string; time: string; class: string; student: string; status: string; method: string }

function TodayTab() {
  const [bookings, setBookings] = useState<TodayBooking[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => fetchJson<{ date: string; bookings: TodayBooking[] }>('/api/booking/today').then(d => {
    setBookings(d?.bookings ?? []); setDate(d?.date ?? ''); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  async function act(id: string, action: 'check_in' | 'cancel') {
    const res = await fetch(`/api/booking/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    if (res.ok) load();
  }

  async function generateInvoice(id: string) {
    const res = await fetch(`/api/admin/bookings/${id}/generate-invoice`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    alert(res.ok ? `Invoice ${body.invoice.invoice_number} created for $${body.invoice.total_cad}.` : (body.error || 'Failed to generate invoice.'));
  }

  async function generateOrder(id: string) {
    const res = await fetch(`/api/admin/bookings/${id}/generate-order`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    alert(res.ok ? `Order created (id ${String(body.orderId).slice(0, 8)}). View it in /admin/orders.` : (body.error || 'Failed to generate order.'));
  }

  const statusColor: Record<string, string> = { confirmed: 'green', checked_in: 'blue', no_show: 'red', pending: 'amber', cancelled: 'gray' };
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Today{date ? ` — ${new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</h3>
        <span className="text-xs text-gray-500">{bookings.length} bookings</span>
      </div>
      {loading ? <EmptyState message="Loading…" /> : bookings.length === 0 ? <EmptyState message="No bookings scheduled for today." /> : (
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time', 'Class', 'Student', 'Status', 'Channel', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map(b => (
            <tr key={b.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{b.time}</td>
              <td className="px-3 py-2 font-medium">{b.class}</td>
              <td className="px-3 py-2">{b.student}</td>
              <td className="px-3 py-2"><Badge color={statusColor[b.status]}>{b.status.replace('_', ' ')}</Badge></td>
              <td className="px-3 py-2 text-gray-600 text-xs">{b.method}</td>
              <td className="px-3 py-2">
                {['pending', 'confirmed'].includes(b.status) && (
                  <button onClick={() => act(b.id, 'check_in')} className="text-xs text-blue-600 hover:underline mr-2">Check In</button>
                )}
                {b.status === 'checked_in' && (
                  <>
                    <button onClick={() => generateInvoice(b.id)} className="text-xs text-indigo-600 hover:underline mr-2">Generate Invoice</button>
                    <button onClick={() => generateOrder(b.id)} className="text-xs text-teal-600 hover:underline mr-2">Generate Order</button>
                  </>
                )}
                {b.status !== 'cancelled' && (
                  <button onClick={() => act(b.id, 'cancel')} className="text-xs text-red-500 hover:underline">Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}

interface UpcomingSession { id: string; date: string; time: string; class: string; teacher: string; booked: number; available: number; statusLabel: string }

function UpcomingTab() {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchJson<{ sessions: UpcomingSession[] }>(`/api/booking/upcoming?days=${days}`).then(d => { setSessions(d?.sessions ?? []); setLoading(false); });
  }, [days]);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[{ label: 'Next 24 hrs', d: 1 }, { label: 'Next 7 days', d: 7 }, { label: 'Next 30 days', d: 30 }].map(f => (
          <button key={f.label} onClick={() => setDays(f.d)}
            className={`text-xs px-3 py-1.5 border rounded hover:bg-gray-50 ${days === f.d ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>{f.label}</button>
        ))}
      </div>
      {loading ? <EmptyState message="Loading…" /> : sessions.length === 0 ? <EmptyState message="No upcoming sessions scheduled." /> : (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Date', 'Time', 'Class', 'Teacher', 'Booked', 'Available', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.time}</td>
                <td className="px-3 py-2">{s.class}</td>
                <td className="px-3 py-2 text-gray-600">{s.teacher}</td>
                <td className="px-3 py-2">{s.booked}</td>
                <td className="px-3 py-2">{s.available}</td>
                <td className="px-3 py-2"><Badge color={s.statusLabel === 'Full' ? 'red' : s.statusLabel === 'Almost Full' ? 'amber' : 'green'}>{s.statusLabel}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

interface WaitlistData {
  kpis: { onWaitlist: number; promotedToday: number; expiredToday: number };
  queue: { id: string; class: string; student: string; position: string; joined: string; method: string }[];
}

function WaitlistTab() {
  const [data, setData] = useState<WaitlistData | null>(null);
  useEffect(() => { fetchJson<WaitlistData>('/api/booking/waitlist').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="On Waitlist"    value={String(data?.kpis.onWaitlist ?? 0)} color="amber" />
        <KpiCard label="Promoted Today" value={String(data?.kpis.promotedToday ?? 0)} color="green" />
        <KpiCard label="Expired Today"  value={String(data?.kpis.expiredToday ?? 0)} color="rose" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Waitlist Queue</h3>
        {!data?.queue.length ? <EmptyState message="No one is currently waitlisted." /> : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Class', 'Student', 'Position', 'Joined', 'Notify Method'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.queue.map(q => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{q.class}</td>
                <td className="px-3 py-2">{q.student}</td>
                <td className="px-3 py-2 font-bold text-amber-600">{q.position}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{new Date(q.joined).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{q.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

interface NoShowData {
  kpis: { noShowsMonth: number; strikeWarnings: number; suspensions: number };
  log: { id: string; student: string; class: string; date: string; strikes: number; action: string }[];
}

function NoShowsTab() {
  const [data, setData] = useState<NoShowData | null>(null);
  useEffect(() => { fetchJson<NoShowData>('/api/booking/no-shows').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="No-shows (Month)" value={String(data?.kpis.noShowsMonth ?? 0)} color="rose" />
        <KpiCard label="Strike Warnings"  value={String(data?.kpis.strikeWarnings ?? 0)} color="amber" />
        <KpiCard label="Suspensions"      value={String(data?.kpis.suspensions ?? 0)} sub="3+ strikes this month" color="red" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">No-show Log — This Month</h3>
        {!data?.log.length ? <EmptyState message="No no-shows recorded this month." /> : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Class', 'Date', 'Strikes', 'Action'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.log.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{l.student}</td>
                <td className="px-3 py-2 text-gray-600">{l.class}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(l.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-bold">{l.strikes}</td>
                <td className="px-3 py-2"><Badge color={l.action.includes('Suspend') ? 'red' : 'amber'}>{l.action}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-4">Booking Policy Rules (defaults)</h3>
        <div className="space-y-3">
          {[
            { rule: 'Cancellation window', value: '24 hours', note: 'Full credit if ≥ 24 hrs' },
            { rule: 'Late cancellation', value: '< 24 hours', note: 'Credit only (no cash refund)' },
            { rule: 'No-show policy', value: '3 strikes', note: 'Strike 3 = suspended, computed live from booking history' },
            { rule: 'Waitlist auto-promote', value: '2 hours before', note: 'Auto-promote + notify (not yet automated — manual for now)' },
            { rule: 'Advance booking limit', value: '14 days', note: 'Members; 7 days for drop-ins' },
            { rule: 'Max concurrent bookings', value: '3 classes/day', note: 'Per student per day' },
          ].map(({ rule, value, note }) => (
            <div key={rule} className="flex justify-between items-start py-2 border-b border-gray-50">
              <div>
                <div className="text-sm font-medium">{rule}</div>
                <div className="text-xs text-gray-500 mt-0.5">{note}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-700">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Booking Volume Report', desc: 'Daily/weekly/monthly bookings with trend' },
          { title: 'Cancellation Analysis', desc: 'Rates, reasons, by class type' },
          { title: 'No-show Report', desc: 'Students, classes, patterns' },
          { title: 'Waitlist Performance', desc: 'Conversion rates, wait times' },
          { title: 'Channel Attribution', desc: 'App vs web vs phone vs desk' },
          { title: 'Revenue Impact', desc: 'Lost revenue from cancellations/no-shows' },
        ].map(r => (
          <div key={r.title} className="border rounded-lg p-4">
            <div className="text-sm font-semibold">{r.title}</div>
            <div className="text-xs text-gray-500 mt-1">{r.desc}</div>
            <p className="mt-3 text-xs text-gray-400">See Overview/Today/Upcoming/No-shows tabs for the underlying data.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Booking Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor bookings, waitlists, no-shows and cancellation rules</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'  && <OverviewTab />}
      {tab === 'Today'     && <TodayTab />}
      {tab === 'Upcoming'  && <UpcomingTab />}
      {tab === 'Waitlist'  && <WaitlistTab />}
      {tab === 'No-shows'  && <NoShowsTab />}
      {tab === 'Rules'     && <RulesTab />}
      {tab === 'Reports'   && <ReportsTab />}
    </div>
  );
}
