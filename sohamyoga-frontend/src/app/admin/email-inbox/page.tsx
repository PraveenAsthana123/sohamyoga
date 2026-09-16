'use client';

import { useEffect, useState, useCallback } from 'react';

interface EmailMessage {
  id: number;
  message_id: string | null;
  thread_id: string | null;
  from_address: string;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  body_preview: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  label: string;
  received_at: string;
}

interface EmailConfig {
  smtp_configured: boolean;
  imap_configured: boolean;
  smtp_host: string | null;
  smtp_port: string | null;
  smtp_user: string | null;
  imap_host: string | null;
  imap_user: string | null;
}

const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'inbox' | 'starred' | 'sent' | 'compose' | 'config';

export default function EmailInboxPage() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [compose, setCompose] = useState({ to_address: '', subject: '', body_preview: '' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadMessages = useCallback(async (label?: string, is_starred?: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (label) params.set('label', label);
      if (is_starred !== undefined) params.set('is_starred', String(is_starred));
      const res = await fetch(`/api/admin/email-inbox?${params}`);
      const data = await res.json() as { messages: EmailMessage[]; unread_count: number };
      setMessages(data.messages || []);
      setUnreadCount(data.unread_count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/admin/email-inbox/config');
    const data = await res.json() as EmailConfig;
    setConfig(data);
  }, []);

  useEffect(() => {
    if (tab === 'inbox') loadMessages('inbox');
    else if (tab === 'starred') loadMessages(undefined, true);
    else if (tab === 'sent') loadMessages('sent');
    else if (tab === 'config') loadConfig();
  }, [tab, loadMessages, loadConfig]);

  const markRead = async (id: number) => {
    await fetch('/api/admin/email-inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    });
    setMessages((m) => m.map((msg) => msg.id === id ? { ...msg, is_read: true } : msg));
  };

  const toggleStar = async (msg: EmailMessage) => {
    await fetch('/api/admin/email-inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msg.id, is_starred: !msg.is_starred }),
    });
    setMessages((m) => m.map((x) => x.id === msg.id ? { ...x, is_starred: !x.is_starred } : x));
  };

  const deleteMsg = async (id: number) => {
    await fetch(`/api/admin/email-inbox?id=${id}`, { method: 'DELETE' });
    setMessages((m) => m.filter((x) => x.id !== id));
    showToast('Deleted');
  };

  const sendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/email-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...compose, from_address: 'admin@sohamyoga.com', label: 'sent' }),
    });
    if (res.ok) { showToast('Message saved to Sent'); setCompose({ to_address: '', subject: '', body_preview: '' }); }
    else showToast('Error saving message');
  };

  const renderMessages = (msgs: EmailMessage[]) => (
    <div className="space-y-2">
      {msgs.map((msg) => (
        <div key={msg.id} className={`rounded-xl border border-white/10 p-4 transition-colors cursor-pointer ${msg.is_read ? 'bg-white/5' : 'bg-white/15'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0" onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}>
              <div className="flex items-center gap-2">
                {!msg.is_read && <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />}
                <p className="font-semibold text-white truncate">{msg.from_name || msg.from_address}</p>
                <p className="text-xs text-white/40 flex-shrink-0">{new Date(msg.received_at).toLocaleString()}</p>
              </div>
              <p className="text-sm text-white/80 truncate">{msg.subject || '(no subject)'}</p>
              {expanded === msg.id && <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">{msg.body_preview || '(no content)'}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleStar(msg)} title="Star" className="text-sm">{msg.is_starred ? '★' : '☆'}</button>
              {!msg.is_read && <button onClick={() => markRead(msg.id)} className="text-xs text-blue-300 hover:text-blue-100">Mark read</button>}
              <button onClick={() => deleteMsg(msg.id)} className="text-xs text-red-300 hover:text-red-100">Delete</button>
            </div>
          </div>
        </div>
      ))}
      {!msgs.length && !loading && <p className="py-8 text-center text-white/40">No messages</p>}
      {loading && <p className="py-8 text-center text-white/40">Loading…</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white  shadow-xl">
          {toast}
        </div>
      )}
      <h1 className="mb-2 text-3xl font-bold text-white">Email Inbox 📧</h1>
      <p className="mb-6 text-white/50 text-sm">Unread: {unreadCount}</p>

      <div className="mb-6 flex gap-2 flex-wrap">
        {([['inbox','Inbox'],['starred','Starred'],['sent','Sent / Archived'],['compose','Compose'],['config','Settings']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'inbox' && <div className={glass}><h2 className="mb-4 text-lg font-semibold text-white">Inbox</h2>{renderMessages(messages)}</div>}
      {tab === 'starred' && <div className={glass}><h2 className="mb-4 text-lg font-semibold text-white">Starred</h2>{renderMessages(messages.filter((m) => m.is_starred))}</div>}
      {tab === 'sent' && (
        <div className={glass}>
          <h2 className="mb-4 text-lg font-semibold text-white">Sent & Archived</h2>
          <div className="mb-3 flex gap-3">
            <button onClick={() => loadMessages('sent')} className="text-xs text-white/60 hover:text-white">Sent</button>
            <button onClick={() => loadMessages('archived')} className="text-xs text-white/60 hover:text-white">Archived</button>
          </div>
          {renderMessages(messages)}
        </div>
      )}
      {tab === 'compose' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Compose</h2>
          <div className="mb-4 rounded-xl bg-amber-500/20 border border-amber-500/30 p-3 text-sm text-amber-200">
            Note: Actual SMTP sending requires SMTP credentials configured via environment variables. Messages will be saved to Sent folder for record-keeping.
          </div>
          <form onSubmit={sendCompose} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">To</label>
              <input required value={compose.to_address} onChange={(e) => setCompose((f) => ({ ...f, to_address: e.target.value }))}
                placeholder="recipient@example.com" type="email"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Subject</label>
              <input required value={compose.subject} onChange={(e) => setCompose((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Body</label>
              <textarea required rows={6} value={compose.body_preview} onChange={(e) => setCompose((f) => ({ ...f, body_preview: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30" />
            </div>
            <button type="submit" className="rounded-xl bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-500">Save to Sent</button>
          </form>
        </div>
      )}
      {tab === 'config' && config && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Email Settings</h2>
          <div className="space-y-3">
            {[
              { label: 'SMTP Configured', value: config.smtp_configured },
              { label: 'IMAP Configured', value: config.imap_configured },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="text-white/80">{label}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${value ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
                  {value ? 'Configured' : 'Not configured'}
                </span>
              </div>
            ))}
            <div className="rounded-xl bg-white/5 p-3 border border-white/10">
              <p className="text-sm text-white/60 mb-1">Environment variables required:</p>
              {['SMTP_HOST','SMTP_PORT','SMTP_USER','IMAP_HOST','IMAP_USER'].map((v) => (
                <p key={v} className="text-xs font-mono text-white/50">{v}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
