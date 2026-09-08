'use client';
// Module — Customer Self-Service Call In / Call Out. Staff queue (Feature),
// live counts (Dashboard), and the request list itself doubling as the
// Report (no separate fabricated report table — the same real call_request
// rows are the report).

import { useEffect, useState, useCallback } from 'react';

interface CallRequest {
  id: string; direction: 'call_in' | 'call_out'; reason: string; phone: string;
  preferred_time: string | null; status: string; outcome_notes: string | null;
  completed_at: string | null; created_at: string; customer_name: string; customer_email: string;
}
interface Dashboard { openCount: number; callInOpen: number; callOutOpen: number; completedToday: number; avgResponseMinutes: number | null }

const STATUSES = ['requested', 'scheduled', 'completed', 'cancelled'];

export default function AdminCallRequestsPage() {
  const [requests, setRequests] = useState<CallRequest[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    const qs = filter ? `?status=${filter}` : '';
    fetch(`/api/admin/call-requests${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setRequests(d.requests ?? []); setDashboard(d.dashboard ?? null); });
  }, [filter]);
  useEffect(() => { load() }, [load]);

  async function setStatus(requestId: string, status: string) {
    await fetch('/api/admin/call-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status, outcomeNotes: notesDraft[requestId] }),
    });
    load();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Call In / Call Out</h1>
        <p className="text-sm text-gray-500">Customer self-service Call In (they'll call us) and Call Out (callback request) queue. Real staff-worked queue — no automated dialer exists.</p>
      </div>

      {/* Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Open requests</div>
            <div className="mt-1 text-2xl font-semibold text-gray-800">{dashboard.openCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Call In / Call Out open</div>
            <div className="mt-1 text-2xl font-semibold text-gray-800">{dashboard.callInOpen} / {dashboard.callOutOpen}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Completed today</div>
            <div className="mt-1 text-2xl font-semibold text-gray-800">{dashboard.completedToday}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Avg response time</div>
            <div className="mt-1 text-2xl font-semibold text-gray-800">{dashboard.avgResponseMinutes !== null ? `${dashboard.avgResponseMinutes}m` : '—'}</div>
          </div>
        </div>
      )}

      {/* Feature: queue + filter */}
      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`rounded px-3 py-1.5 text-sm ${filter === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded px-3 py-1.5 text-sm capitalize ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
        ))}
      </div>

      {/* Report: the real request list */}
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.direction === 'call_in' ? 'Call In' : 'Call Out'}</span>
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 capitalize">{r.status}</span>
                <h3 className="mt-1 font-semibold text-gray-800">{r.customer_name} <span className="font-normal text-gray-400">· {r.customer_email}</span></h3>
                <p className="text-sm text-gray-600">{r.phone}{r.preferred_time ? ` · preferred: ${new Date(r.preferred_time).toLocaleString()}` : ''}</p>
                {r.reason && <p className="mt-1 text-sm text-gray-500">{r.reason}</p>}
              </div>
            </div>
            {(r.status === 'requested' || r.status === 'scheduled') && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input placeholder="Outcome notes" className="min-w-[200px] flex-1 rounded border border-gray-300 p-1.5 text-xs"
                  value={notesDraft[r.id] ?? ''} onChange={e => setNotesDraft({ ...notesDraft, [r.id]: e.target.value })} />
                {r.status === 'requested' && <button onClick={() => setStatus(r.id, 'scheduled')} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Mark scheduled</button>}
                <button onClick={() => setStatus(r.id, 'completed')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Mark completed</button>
                <button onClick={() => setStatus(r.id, 'cancelled')} className="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button>
              </div>
            )}
            {r.outcome_notes && <p className="mt-2 text-xs text-gray-400">Note: {r.outcome_notes}</p>}
          </div>
        ))}
        {!requests.length && <p className="text-sm text-gray-400">No requests.</p>}
      </div>
    </div>
  );
}
