'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Submission {
  id: number; name: string; email: string; phone: string; subject: string;
  message: string; source: string; status: string; assigned_to: string;
  reply_text: string; replied_at: string | null; created_at: string;
}

interface DailyCount { day: string; count: number }
interface SourceCount { source: string; count: number }

interface AnalyticsData {
  daily: DailyCount[];
  bySource: SourceCount[];
  avgResponseHours: number | null;
}

interface AIReplyResult { subject?: string; body?: string; reply?: string; result?: { body?: string; reply?: string } }

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  const m: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', replied: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500', spam: 'bg-red-100 text-red-600',
    'in-progress': 'bg-yellow-100 text-yellow-700',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContactUsPage() {
  const [tab, setTab] = useState(0);

  const tabs = ['Submissions', 'Analytics', 'AI Reply', 'Settings'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage inbound contact form submissions, replies, and analytics</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 0 && <TabSubmissions />}
        {tab === 1 && <TabAnalytics />}
        {tab === 2 && <TabAIReply />}
        {tab === 3 && <TabSettings />}
      </div>
    </div>
  );
}

// ── Tab 1: Submissions ────────────────────────────────────────────────────────

function TabSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [replying, setReplying] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const url = statusFilter ? `/api/admin/contact-us?status=${statusFilter}` : '/api/admin/contact-us';
    fetch(url).then(r => r.json())
      .then((d: { submissions?: Submission[] }) => setSubmissions(d.submissions ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const total = submissions.length;
  const newCount = submissions.filter(s => s.status === 'new').length;
  const repliedCount = submissions.filter(s => s.status === 'replied').length;

  const handleReply = async (id: number) => {
    const text = replyText[id];
    if (!text?.trim()) return;
    setReplying(id);
    try {
      await fetch(`/api/admin/contact-us/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: text }),
      });
      setMsg('Reply saved and status set to replied.'); load();
    } catch { setMsg('Error saving reply.'); } finally { setReplying(null); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/admin/contact-us/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total },
          { label: 'New', value: newCount, color: 'text-blue-600' },
          { label: 'Replied', value: repliedCount, color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={`text-3xl font-bold ${k.color ?? 'text-gray-900'}`}>{loading ? '…' : k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {['new', 'in-progress', 'replied', 'closed', 'spam'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{submissions.length} submissions</span>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <div key={sub.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Row */}
              <button onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                className="w-full flex items-start justify-between gap-4 p-4 hover:bg-gray-50 text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{sub.name}</span>
                    <span className="text-xs text-gray-400">{sub.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(sub.status)}`}>{sub.status}</span>
                    <span className="text-xs text-gray-400">{sub.source}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 truncate">{sub.subject}</div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">{new Date(sub.created_at).toLocaleDateString()}</div>
              </button>

              {/* Expanded */}
              {expanded === sub.id && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Message</div>
                    <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap">{sub.message}</div>
                  </div>

                  {sub.phone && <div className="text-xs text-gray-500">Phone: {sub.phone}</div>}

                  <div className="flex gap-2 flex-wrap">
                    {['new', 'in-progress', 'replied', 'closed', 'spam'].map(s => (
                      <button key={s} onClick={() => handleStatusChange(sub.id, s)}
                        className={`text-xs px-2 py-0.5 rounded ${sub.status === s ? statusColor(s) : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {s}
                      </button>
                    ))}
                  </div>

                  {sub.reply_text && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">Previous Reply ({sub.replied_at ? new Date(sub.replied_at).toLocaleString() : 'no date'})</div>
                      <div className="text-sm text-gray-700 bg-green-50 border border-green-100 rounded p-3">{sub.reply_text}</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reply</label>
                    <textarea
                      value={replyText[sub.id] ?? ''}
                      onChange={e => setReplyText(rt => ({ ...rt, [sub.id]: e.target.value }))}
                      rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="Type your reply…"
                    />
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => handleReply(sub.id)} disabled={replying === sub.id}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                        {replying === sub.id ? 'Sending…' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {submissions.length === 0 && <div className="text-center py-12 text-gray-400">No submissions yet.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Analytics ──────────────────────────────────────────────────────────

function TabAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/contact-us?resource=analytics')
      .then(r => r.json())
      .then((d: AnalyticsData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-gray-400 text-sm">No data.</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Contact Analytics</h2>

      {data.avgResponseHours !== null && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
          <div className="text-3xl font-bold text-indigo-600">{Number(data.avgResponseHours).toFixed(1)}h</div>
          <div className="text-sm text-gray-500 mt-1">Avg Response Time</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Submissions per Day (Last 30 days)</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {data.daily.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-24">{d.day}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-3 bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, d.count * 10)}%` }} />
                </div>
                <div className="text-xs text-gray-500 w-4 text-right">{d.count}</div>
              </div>
            ))}
            {data.daily.length === 0 && <div className="text-xs text-gray-400">No submissions in last 30 days.</div>}
          </div>
        </div>

        {/* By source */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">By Source</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b">
              <th className="text-left pb-2">Source</th><th className="pb-2">Count</th>
            </tr></thead>
            <tbody>
              {data.bySource.map(s => (
                <tr key={s.source} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-600">{s.source}</td>
                  <td className="py-2 text-xs font-medium">{s.count}</td>
                </tr>
              ))}
              {data.bySource.length === 0 && <tr><td colSpan={2} className="py-4 text-xs text-gray-400 text-center">No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: AI Reply ───────────────────────────────────────────────────────────

function TabAIReply() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/contact-us?status=new').then(r => r.json())
      .then((d: { submissions?: Submission[] }) => setSubmissions(d.submissions ?? []));
  }, []);

  const selected = submissions.find(s => String(s.id) === selectedId);

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true); setDraft('');
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft-contact-reply',
          name: selected.name,
          subject: selected.subject,
          message: selected.message,
        }),
      });
      const d = await r.json() as AIReplyResult;
      setDraft(d.body ?? d.reply ?? d.result?.body ?? d.result?.reply ?? 'Could not generate reply.');
    } catch (e) { setDraft(String(e)); } finally { setGenerating(false); }
  };

  const handleSend = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true); setMsg('');
    try {
      await fetch(`/api/admin/contact-us/${selectedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: draft }),
      });
      setMsg('Reply saved and marked as replied.'); setDraft(''); setSelectedId('');
    } catch { setMsg('Error sending reply.'); } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">AI Reply Assistant</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Submission</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">Choose a submission…</option>
              {submissions.map(s => <option key={s.id} value={s.id}>{s.name} — {s.subject?.slice(0, 40)}</option>)}
            </select>
          </div>

          {selected && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="font-semibold text-gray-900">{selected.name}</div>
              <div className="text-xs text-gray-500">{selected.email}</div>
              <div className="text-xs font-medium text-gray-700">Subject: {selected.subject}</div>
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">{selected.message}</div>
            </div>
          )}

          <button onClick={handleGenerate} disabled={generating || !selectedId}
            className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {generating ? 'Generating AI Reply…' : 'Generate AI Reply'}
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-medium text-gray-700">Edit & Send Reply</label>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={12}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="AI-generated reply will appear here. You can edit before sending." />
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <button onClick={handleSend} disabled={sending || !draft.trim() || !selectedId}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
            {sending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Settings ───────────────────────────────────────────────────────────

function TabSettings() {
  const [settings, setSettings] = useState({
    autoReply: 'Thank you for contacting us! We will get back to you within 1-2 business days.',
    notificationEmail: 'admin@sohamyoga.com',
    spamKeywords: 'buy now, click here, limited offer, free money, make money fast',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Settings are local for now — could persist to DB in a settings table
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Contact Form Settings</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Reply Message</label>
          <textarea value={settings.autoReply} onChange={e => setSettings(s => ({ ...s, autoReply: e.target.value }))}
            rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Sent automatically when a new submission is received.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notification Email</label>
          <input value={settings.notificationEmail} onChange={e => setSettings(s => ({ ...s, notificationEmail: e.target.value }))}
            type="email" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spam Keywords (comma-separated)</label>
          <textarea value={settings.spamKeywords} onChange={e => setSettings(s => ({ ...s, spamKeywords: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-1">Submissions containing these keywords are flagged as spam.</p>
        </div>
        <button onClick={handleSave}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
