'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type TabId = 'sessions' | 'tokens' | 'analytics' | 'alerts' | 'policies';

interface Session {
  id: number;
  session_id: string;
  user_email: string | null;
  user_role: string;
  ip_address: string | null;
  device_type: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

interface Token {
  id: number;
  token_type: string;
  user_email: string | null;
  scope: string[] | null;
  is_active: boolean;
  issued_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface Stats {
  active_sessions: number;
  active_tokens: number;
  expired_tokens: number;
  revoked_today: number;
}

interface SessionsData {
  sessions: Session[];
  tokens: Token[];
  stats: Stats;
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full mx-auto" />;
}

function RoleBadge({ role }: { role: string }) {
  const cls = role === 'admin' ? 'bg-red-500/30 text-red-200 border-red-400/40'
    : role === 'vendor' ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
    : 'bg-blue-500/30 text-blue-200 border-blue-400/40';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{role}</span>;
}

function TokenTypeBadge({ type }: { type: string }) {
  const cls = type === 'api_key' ? 'bg-purple-500/30 text-purple-200 border-purple-400/40'
    : type === 'refresh' ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
    : type === 'webhook' ? 'bg-green-500/30 text-green-200 border-green-400/40'
    : 'bg-blue-500/30 text-blue-200 border-blue-400/40';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{type}</span>;
}

function StatusBadge({ active, revokedAt }: { active: boolean; revokedAt?: string | null }) {
  if (revokedAt) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-500/30 text-red-200 border-red-400/40">revoked</span>;
  if (active) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/30 text-emerald-200 border-emerald-400/40">active</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-500/30 text-gray-200 border-gray-400/40">expired</span>;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Tab: Active Sessions ───────────────────────────────────────────────────
function ActiveSessionsTab({ data, onRevoke, onRevokeAll }: {
  data: SessionsData | null;
  onRevoke: (sessionId: string) => void;
  onRevokeAll: (email: string) => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [reason, setReason] = useState('admin_bulk_revoke');

  if (!data) return <div className="py-12 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-white/50 text-xs uppercase border-b border-white/10">
                <th className="text-left py-2">Email</th>
                <th className="text-left py-2">Role</th>
                <th className="text-left py-2">IP</th>
                <th className="text-left py-2">Device</th>
                <th className="text-left py-2">Country</th>
                <th className="text-left py-2">Last Seen</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-left py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-white/40 text-xs">No active sessions.</td></tr>
              )}
              {data.sessions.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white/90 text-xs">{s.user_email ?? '—'}</td>
                  <td className="py-2"><RoleBadge role={s.user_role} /></td>
                  <td className="py-2 text-white/60 text-xs font-mono">{s.ip_address ?? '—'}</td>
                  <td className="py-2 text-white/60 text-xs">{s.device_type ?? '—'}</td>
                  <td className="py-2 text-white/60 text-xs">{s.country ?? '—'}</td>
                  <td className="py-2 text-white/60 text-xs">{relativeTime(s.last_seen_at)}</td>
                  <td className="py-2 text-white/50 text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : '—'}</td>
                  <td className="py-2 flex gap-2">
                    <button onClick={() => onRevoke(s.session_id)} className="text-xs text-red-300 hover:text-red-200 underline">Revoke</button>
                    {s.user_email && (
                      <button onClick={() => setConfirmEmail(s.user_email!)} className="text-xs text-amber-300 hover:text-amber-200 underline">Revoke All</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Confirm modal */}
      {confirmEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <GlassCard className="max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Revoke all sessions for {confirmEmail}?</h3>
            <div className="mb-3">
              <label className="block text-white/60 text-xs mb-1">Reason</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { onRevokeAll(confirmEmail); setConfirmEmail(null); }}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/30 hover:bg-red-500/50 text-red-200 text-sm font-semibold"
              >
                Confirm
              </button>
              <button onClick={() => setConfirmEmail(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">
                Cancel
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ── Tab: Token Registry ────────────────────────────────────────────────────
function TokenRegistryTab({ data, onRevokeToken }: {
  data: SessionsData | null;
  onRevokeToken: (id: number) => void;
}) {
  if (!data) return <div className="py-12 text-center"><Spinner /></div>;
  return (
    <GlassCard>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Scope</th>
              <th className="text-left py-2">Issued</th>
              <th className="text-left py-2">Expires</th>
              <th className="text-left py-2">Last Used</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.tokens.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-white/40 text-xs">No tokens found.</td></tr>
            )}
            {data.tokens.map(t => (
              <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1.5"><TokenTypeBadge type={t.token_type} /></td>
                <td className="py-1.5 text-white/80 text-xs">{t.user_email ?? '—'}</td>
                <td className="py-1.5">
                  <div className="flex gap-1 flex-wrap">
                    {(t.scope ?? []).map((s, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-white/10 text-white/70 text-xs rounded">{s}</span>
                    ))}
                    {!t.scope?.length && <span className="text-white/30 text-xs">—</span>}
                  </div>
                </td>
                <td className="py-1.5 text-white/50 text-xs">{new Date(t.issued_at).toLocaleDateString()}</td>
                <td className="py-1.5 text-white/50 text-xs">{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : '—'}</td>
                <td className="py-1.5 text-white/50 text-xs">{t.last_used_at ? relativeTime(t.last_used_at) : '—'}</td>
                <td className="py-1.5"><StatusBadge active={t.is_active} revokedAt={t.revoked_at} /></td>
                <td className="py-1.5">
                  {t.is_active && (
                    <button onClick={() => onRevokeToken(t.id)} className="text-xs text-red-300 hover:text-red-200 underline">Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ── Tab: Session Analytics ─────────────────────────────────────────────────
function SessionAnalyticsTab({ data }: { data: SessionsData | null }) {
  if (!data) return <div className="py-12 text-center"><Spinner /></div>;

  const { stats, sessions } = data;

  const deviceCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const d = s.device_type ?? 'unknown';
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  const countryCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const c = s.country ?? 'unknown';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  const maxDevice = Math.max(1, ...Object.values(deviceCounts));

  const uniqueUsers = new Set(sessions.map(s => s.user_email).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Sessions', value: String(stats.active_sessions) },
          { label: 'Unique Users Online', value: String(uniqueUsers) },
          { label: 'Active Tokens', value: String(stats.active_tokens) },
          { label: 'Revoked Today', value: String(stats.revoked_today) },
        ].map(c => (
          <GlassCard key={c.label}>
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-white text-2xl font-bold">{c.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Sessions by Device</h3>
          <div className="space-y-2">
            {Object.entries(deviceCounts).map(([device, count]) => (
              <div key={device}>
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span>{device}</span><span>{count}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(count / maxDevice) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(deviceCounts).length === 0 && <p className="text-white/40 text-xs">No data yet.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-white/80 text-sm font-semibold mb-3">Sessions by Country</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, count]) => (
                <tr key={country} className="border-b border-white/5">
                  <td className="py-1 text-white/80 text-xs">{country}</td>
                  <td className="py-1 text-white/60 text-xs text-right">{count}</td>
                </tr>
              ))}
              {Object.keys(countryCounts).length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-white/40 text-xs">No data yet.</td></tr>
              )}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
}

// ── Tab: Security Alerts ───────────────────────────────────────────────────
function SecurityAlertsTab({ data }: { data: SessionsData | null }) {
  if (!data) return <div className="py-12 text-center"><Spinner /></div>;

  const { sessions } = data;

  // Same user >3 IPs in last hour
  const oneHourAgo = Date.now() - 3600000;
  const recentSessions = sessions.filter(s => new Date(s.created_at).getTime() > oneHourAgo);
  const ipsByEmail = recentSessions.reduce<Record<string, Set<string>>>((acc, s) => {
    if (s.user_email && s.ip_address) {
      if (!acc[s.user_email]) acc[s.user_email] = new Set();
      acc[s.user_email].add(s.ip_address);
    }
    return acc;
  }, {});
  const suspicious = Object.entries(ipsByEmail).filter(([, ips]) => ips.size > 3);

  const expiringSoon = sessions.filter(s => {
    if (!s.expires_at) return false;
    const diff = new Date(s.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 86400000;
  });

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>Suspicious Activity</span>
          {suspicious.length > 0 && <span className="px-2 py-0.5 bg-red-500/40 text-red-200 rounded-full text-xs font-bold">{suspicious.length}</span>}
        </h3>
        {suspicious.length === 0 ? (
          <p className="text-emerald-300 text-sm">No suspicious activity detected.</p>
        ) : (
          <div className="space-y-2">
            {suspicious.map(([email, ips]) => (
              <div key={email} className="p-3 bg-red-500/10 border border-red-400/30 rounded-xl">
                <p className="text-red-200 text-sm font-semibold">{email}</p>
                <p className="text-white/60 text-xs mt-1">{ips.size} different IPs in the last hour: {Array.from(ips).join(', ')}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-semibold mb-3">Sessions Expiring in 24h</h3>
        {expiringSoon.length === 0 ? (
          <p className="text-white/50 text-sm">No sessions expiring soon.</p>
        ) : (
          <div className="space-y-1">
            {expiringSoon.map(s => (
              <div key={s.id} className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-white/80">{s.user_email ?? '—'}</span>
                <span className="text-amber-300">{s.expires_at ? new Date(s.expires_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-semibold mb-2">Revoked Sessions Today</h3>
        <p className="text-white text-2xl font-bold">{data.stats.revoked_today}</p>
      </GlassCard>
    </div>
  );
}

// ── Tab: Policies ──────────────────────────────────────────────────────────
function PoliciesTab() {
  const [toast, setToast] = useState('');

  const policies = [
    { title: 'Max Session Duration', value: '7 days', detail: 'User sessions expire after 7 days of inactivity.' },
    { title: 'Access Token Expiry', value: '1 hour', detail: 'JWT access tokens expire after 1 hour.' },
    { title: 'Refresh Token Expiry', value: '30 days', detail: 'Refresh tokens valid for 30 days with rotation.' },
    { title: 'Concurrent Session Limit', value: '5 per user', detail: 'Maximum 5 concurrent active sessions per user account.' },
    { title: 'Refresh Token Rotation', value: 'Enabled', detail: 'Refresh tokens are rotated on each use (one-time-use).' },
    { title: 'API Key Expiry', value: 'No expiry', detail: 'API keys do not expire; revoke manually when no longer needed.' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies.map(p => (
          <GlassCard key={p.title}>
            <p className="text-white/60 text-xs uppercase tracking-wide mb-1">{p.title}</p>
            <p className="text-white font-bold text-lg mb-1">{p.value}</p>
            <p className="text-white/50 text-xs">{p.detail}</p>
          </GlassCard>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => { setToast('Policy changes require server restart'); setTimeout(() => setToast(''), 3000); }}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm"
        >
          Update Policy
        </button>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 bg-amber-500/90 text-white rounded-xl shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'sessions', label: 'Active Sessions' },
  { id: 'tokens', label: 'Token Registry' },
  { id: 'analytics', label: 'Session Analytics' },
  { id: 'alerts', label: 'Security Alerts' },
  { id: 'policies', label: 'Policies' },
];

export default function SessionManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sessions', { cache: 'no-store' });
      if (res.ok) setData(await res.json() as SessionsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const revokeSession = async (sessionId: string) => {
    await fetch('/api/admin/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    void load();
  };

  const revokeAll = async (email: string) => {
    await fetch('/api/admin/sessions/revoke-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: email }),
    });
    void load();
  };

  const revokeToken = async (id: number) => {
    await fetch('/api/admin/tokens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Session &amp; Token Management</h1>
          <p className="text-white/60 text-sm mt-1">Manage active sessions, auth tokens, and security policies.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && activeTab !== 'policies' ? (
          <div className="py-12 text-center"><Spinner /></div>
        ) : (
          <div>
            {activeTab === 'sessions' && <ActiveSessionsTab data={data} onRevoke={revokeSession} onRevokeAll={revokeAll} />}
            {activeTab === 'tokens' && <TokenRegistryTab data={data} onRevokeToken={revokeToken} />}
            {activeTab === 'analytics' && <SessionAnalyticsTab data={data} />}
            {activeTab === 'alerts' && <SecurityAlertsTab data={data} />}
            {activeTab === 'policies' && <PoliciesTab />}
          </div>
        )}
      </div>
    </div>
  );
}
