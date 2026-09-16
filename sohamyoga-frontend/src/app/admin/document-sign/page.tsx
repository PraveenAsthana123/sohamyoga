'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Pending Signatures', 'All Requests', 'Send for Signature', 'Audit Trail', 'Analytics'] as const;
type Tab = typeof TABS[number];

interface SigRow {
  id: number;
  document_id: number;
  document_title: string;
  signer_name: string;
  signer_email: string;
  signer_role: string | null;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_reason: string | null;
  signature_token: string;
  ip_address: string | null;
  created_at: string;
}

interface DocOption { id: number; title: string; }

const badge = (color: string, label: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-500/20 text-${color}-300`}>{label}</span>
);

const statusColor: Record<string, string> = {
  pending: 'gray', sent: 'blue', viewed: 'yellow', signed: 'green', declined: 'red', expired: 'orange',
};

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DocumentSignPage() {
  const [tab, setTab] = useState<Tab>('Pending Signatures');
  const [sigs, setSigs] = useState<SigRow[]>([]);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({ document_id: '', signer_name: '', signer_email: '', signer_role: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchSigs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/document-sign?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json() as { signatures: SigRow[] };
      setSigs(data.signatures ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/documents', { cache: 'no-store' });
      const data = await res.json() as { documents: { id: number; title: string }[] };
      setDocs((data.documents ?? []).map(d => ({ id: d.id, title: d.title })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchSigs(); }, [fetchSigs]);
  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const body = {
        document_id: Number(form.document_id),
        signer_name: form.signer_name,
        signer_email: form.signer_email,
        signer_role: form.signer_role || undefined,
      };
      const res = await fetch('/api/admin/document-sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setMsg('Signature request created.');
        setForm({ document_id: '', signer_name: '', signer_email: '', signer_role: '' });
        void fetchSigs();
      } else {
        const d = await res.json() as { error: string };
        setMsg(`Error: ${d.error}`);
      }
    } catch { setMsg('Network error.'); }
    setSaving(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch('/api/admin/document-sign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    void fetchSigs();
  }

  const pending = sigs.filter(s => s.status === 'pending' || s.status === 'sent');
  const auditEvents = [...sigs]
    .flatMap(s => {
      const events: { time: string; label: string; sig: SigRow }[] = [];
      if (s.sent_at) events.push({ time: s.sent_at, label: 'Sent', sig: s });
      if (s.viewed_at) events.push({ time: s.viewed_at, label: 'Viewed', sig: s });
      if (s.signed_at) events.push({ time: s.signed_at, label: 'Signed', sig: s });
      if (s.status === 'declined') events.push({ time: s.created_at, label: 'Declined', sig: s });
      return events;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Analytics
  const total = sigs.length;
  const signedCount = sigs.filter(s => s.status === 'signed').length;
  const completionRate = total ? ((signedCount / total) * 100).toFixed(1) : '0';
  const avgTimeToSignMs = sigs
    .filter(s => s.status === 'signed' && s.signed_at)
    .map(s => new Date(s.signed_at!).getTime() - new Date(s.created_at).getTime());
  const avgDays = avgTimeToSignMs.length
    ? (avgTimeToSignMs.reduce((a, b) => a + b, 0) / avgTimeToSignMs.length / 86400000).toFixed(1)
    : '—';

  const glassCard = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400';
  const labelClass = 'block text-white/70 text-sm mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Document Sign</h1>
          <p className="text-white/60 mt-1">Manage signature requests, track signing status, and audit trail</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Pending Signatures */}
        {tab === 'Pending Signatures' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Pending & Sent ({pending.length})</h2>
            {loading ? <p className="text-white/50">Loading…</p> : (
              pending.length === 0 ? <p className="text-white/40">No pending signature requests.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pending.map(s => (
                    <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">{s.signer_name}</span>
                        {badge(statusColor[s.status] ?? 'gray', s.status)}
                      </div>
                      <div className="text-white/60 text-xs">{s.signer_email}</div>
                      {s.signer_role && <div className="text-white/50 text-xs">Role: {s.signer_role}</div>}
                      <div className="text-white/70 text-xs">📄 {s.document_title}</div>
                      {s.sent_at && <div className="text-white/40 text-xs">Sent: {formatDate(s.sent_at)}</div>}
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => void updateStatus(s.id, 'sent')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs">
                          Send Reminder
                        </button>
                        <button onClick={() => void updateStatus(s.id, 'expired')}
                          className="bg-red-600/80 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* All Requests */}
        {tab === 'All Requests' && (
          <div className={glassCard}>
            <div className="flex flex-wrap gap-2 mb-4">
              {['', 'pending', 'sent', 'viewed', 'signed', 'declined', 'expired'].map(v => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === v ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                  {v === '' ? 'All' : v}
                </button>
              ))}
            </div>
            {loading ? <p className="text-white/50">Loading…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs uppercase">
                      <th className="text-left py-2 pr-3">Document</th>
                      <th className="text-left py-2 pr-3">Signer</th>
                      <th className="text-left py-2 pr-3">Role</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Sent</th>
                      <th className="text-left py-2">Signed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sigs.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-white/40">No requests found.</td></tr>}
                    {sigs.map(s => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 text-white font-medium">{s.document_title}</td>
                        <td className="py-2 pr-3">
                          <div className="text-white">{s.signer_name}</div>
                          <div className="text-white/50 text-xs">{s.signer_email}</div>
                        </td>
                        <td className="py-2 pr-3 text-white/60">{s.signer_role ?? '—'}</td>
                        <td className="py-2 pr-3">{badge(statusColor[s.status] ?? 'gray', s.status)}</td>
                        <td className="py-2 pr-3 text-white/60 text-xs">{formatDate(s.sent_at)}</td>
                        <td className="py-2 text-white/60 text-xs">{formatDate(s.signed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Send for Signature */}
        {tab === 'Send for Signature' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Create Signature Request</h2>
            <form onSubmit={e => void handleSend(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Document *</label>
                <select className={inputClass} value={form.document_id} onChange={e => setForm(f => ({ ...f, document_id: e.target.value }))} required>
                  <option value="">— Select a document —</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Signer Name *</label>
                <input className={inputClass} value={form.signer_name} onChange={e => setForm(f => ({ ...f, signer_name: e.target.value }))} placeholder="Jane Smith" required />
              </div>
              <div>
                <label className={labelClass}>Signer Email *</label>
                <input type="email" className={inputClass} value={form.signer_email} onChange={e => setForm(f => ({ ...f, signer_email: e.target.value }))} placeholder="jane@example.com" required />
              </div>
              <div>
                <label className={labelClass}>Signer Role</label>
                <select className={inputClass} value={form.signer_role} onChange={e => setForm(f => ({ ...f, signer_role: e.target.value }))}>
                  <option value="">— Select role —</option>
                  {['client', 'vendor', 'internal', 'legal'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Request'}
                </button>
                {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Audit Trail */}
        {tab === 'Audit Trail' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Audit Trail</h2>
            {auditEvents.length === 0 ? <p className="text-white/40">No signing events recorded yet.</p> : (
              <div className="space-y-3">
                {auditEvents.map((ev, i) => (
                  <div key={i} className="flex items-start gap-4 border-b border-white/5 pb-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${ev.label === 'Signed' ? 'bg-green-400' : ev.label === 'Declined' ? 'bg-red-400' : ev.label === 'Viewed' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">{ev.label} — {ev.sig.document_title}</div>
                      <div className="text-white/60 text-xs">{ev.sig.signer_name} ({ev.sig.signer_email})</div>
                    </div>
                    <div className="text-white/40 text-xs">{formatDate(ev.time)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics */}
        {tab === 'Analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Requests', value: String(total) },
                { label: 'Signed', value: String(signedCount) },
                { label: 'Completion Rate', value: `${completionRate}%` },
                { label: 'Avg Days to Sign', value: avgDays },
              ].map(k => (
                <div key={k.label} className={glassCard + ' text-center'}>
                  <div className="text-3xl font-bold text-white">{k.value}</div>
                  <div className="text-white/60 text-sm mt-1">{k.label}</div>
                </div>
              ))}
            </div>
            <div className={glassCard}>
              <h2 className="text-white font-semibold mb-4">Status Breakdown</h2>
              {(['pending', 'sent', 'viewed', 'signed', 'declined', 'expired'] as const).map(s => {
                const count = sigs.filter(sig => sig.status === s).length;
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-3 text-sm mb-3">
                    <span className="w-20 text-white/60 text-xs capitalize">{s}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded">
                      <div className={`h-2 rounded bg-${statusColor[s] ?? 'gray'}-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-white/80 text-xs">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
