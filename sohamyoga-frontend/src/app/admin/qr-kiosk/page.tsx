'use client';
// Admin QR Kiosk Login Management — session logs, scan history, session
// revocation, and monitoring. Reads from qr_login_challenge table.

import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Session Logs', 'Report', 'Manual'] as const;
type Tab = (typeof TABS)[number];

interface ChallengeRow {
  id: string;
  challenge_token: string;
  browser_session_id: string;
  device_hint: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  created_at: string;
  expires_at: string;
  used_at: string | null;
  approved_by_session_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  used: 'bg-blue-100 text-blue-700',
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function AdminQrKioskPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [sessions, setSessions] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/qr-kiosk/sessions', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load sessions');
        setSessions(d.sessions ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const revokeSession = async (id: string) => {
    await fetch(`/api/admin/qr-kiosk/sessions/${id}/revoke`, { method: 'POST' });
    load();
  };

  const stats = {
    total: sessions.length,
    approved: sessions.filter(s => s.status === 'approved' || s.status === 'used').length,
    pending: sessions.filter(s => s.status === 'pending').length,
    expired: sessions.filter(s => s.status === 'expired').length,
    rejected: sessions.filter(s => s.status === 'rejected').length,
  };
  const approvalRate = stats.total ? Math.round(((stats.approved) / stats.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">QR Kiosk Login</h1>
        <p className="text-sm text-gray-500">
          Passwordless kiosk authentication via QR scan — session monitoring and logs
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <KpiCard label="Total Sessions" value={stats.total} />
            <KpiCard label="Approved" value={stats.approved} sub={`${approvalRate}% approval rate`} />
            <KpiCard label="Pending" value={stats.pending} />
            <KpiCard label="Expired / Rejected" value={stats.expired + stats.rejected} />
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">How It Works</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              {[
                'Customer arrives at kiosk — kiosk displays a QR code encoding a one-time challenge token',
                'Customer scans the QR with their authenticated phone',
                'Phone shows an approval prompt — customer taps Approve',
                'Kiosk detects the approval (polling /api/auth/qr-challenge/poll) and shows the customer logged in',
                'Token is marked "used" — cannot be reused; expires after 60 seconds if not acted on',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Recent Sessions</h2>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              sessions.length === 0 ? <p className="text-sm text-gray-400">No sessions recorded yet.</p> : (
                <div className="space-y-2">
                  {sessions.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded border border-gray-100 p-2 text-sm">
                      <div>
                        <span className="font-mono text-xs text-gray-600">{s.device_hint}</span>
                        <span className="ml-2 text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Session Logs */}
      {tab === 'Session Logs' && (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All QR Challenge Sessions ({sessions.length})</h2>
            <button onClick={load} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
              Refresh
            </button>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            sessions.length === 0 ? <p className="text-sm text-gray-400">No sessions yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold text-gray-500">
                      <th className="pb-2 pr-4">Device</th>
                      <th className="pb-2 pr-4">Created</th>
                      <th className="pb-2 pr-4">Expires</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} className="border-b border-gray-50">
                        <td className="py-2 pr-4">
                          <span className="font-mono text-xs text-gray-700">{s.device_hint}</span>
                          <br />
                          <span className="text-xs text-gray-400">{s.browser_session_id.slice(0, 8)}…</span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-gray-600">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-xs text-gray-600">{new Date(s.expires_at).toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                        </td>
                        <td className="py-2">
                          {s.status === 'pending' || s.status === 'approved' ? (
                            <button
                              onClick={() => revokeSession(s.id)}
                              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Revoke
                            </button>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* Report */}
      {tab === 'Report' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Sessions" value={stats.total} />
            <KpiCard label="Approval Rate" value={`${approvalRate}%`} />
            <KpiCard label="Rejected" value={stats.rejected} />
            <KpiCard label="Expired (unused)" value={stats.expired} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Session Status Breakdown</h2>
            {(['approved', 'used', 'pending', 'expired', 'rejected'] as const).map(s => {
              const count = sessions.filter(r => r.status === s).length;
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={s} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{s}</span>
                    <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Cleanup Job</h2>
            <p className="text-sm text-gray-600">
              <span className="font-mono text-xs">QrSessionCleanupJob</span> runs hourly and automatically sets pending-but-expired
              tokens to <span className="font-mono text-xs">status=expired</span>. This table should not accumulate stale pending rows.
            </p>
          </div>
        </div>
      )}

      {/* Manual */}
      {tab === 'Manual' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Generating a Kiosk QR Code</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              {[
                'Navigate to /auth/qr-login on the kiosk device (or any shared display)',
                'The page calls POST /api/auth/qr-challenge to generate a one-time token',
                'A QR code is displayed — it encodes the challenge token only, never a password',
                'The QR code auto-refreshes every 60 seconds if not scanned',
                'Staff can open this page on any public display — it requires no authentication',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Revoking an Active Session</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              {[
                'Go to Session Logs tab',
                'Find the session by device hint or browser session ID',
                'Click Revoke — sets status to "rejected" immediately',
                'The kiosk poll will receive the rejected status and clear the login state',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-blue-50 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">Security Note</p>
            <p className="mt-1 text-xs text-blue-700">
              Each QR encodes only a random 40-hex-char challenge token, never a session token or password.
              Tokens are single-use, expire in 60 seconds, and are logged with device hint and timestamp.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
