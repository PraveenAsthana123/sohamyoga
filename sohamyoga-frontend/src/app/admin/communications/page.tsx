'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CommChannel {
  id: string;
  channel_type: string;
  channel_name: string;
  status: string;
  config_json: Record<string, string>;
  credentials_set: boolean;
  last_message_at: string | null;
  messages_today: number;
  created_at: string;
  unread_count: number;
  total_messages: number;
  latest_message_at: string | null;
}

interface CommMessage {
  id: string;
  channel_id: string | null;
  channel_type: string;
  direction: 'inbound' | 'outbound';
  from_address: string | null;
  to_address: string | null;
  contact_name: string | null;
  subject: string | null;
  body: string;
  body_html: string | null;
  status: string;
  external_id: string | null;
  thread_id: string | null;
  is_starred: boolean;
  is_spam: boolean;
  received_at: string;
  read_at: string | null;
  channel_name: string | null;
}

interface MessagesResponse {
  messages: CommMessage[];
  total: number;
  page: number;
  pages: number;
  unread_per_channel: Record<string, number>;
}

interface ChannelsResponse {
  channels: CommChannel[];
  summary: {
    total_unread: number;
    messages_24h: number;
    messages_7d: number;
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  email: '📧',
  whatsapp: '💬',
  sms: '📱',
  phone: '📞',
  apple_messages: '🍎',
};

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  demo: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  disconnected: 'bg-gray-100 text-gray-600',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
];
function avatarColor(name: string | null): string {
  const s = name ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials(name)}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-1">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 text-gray-500 truncate">{d.label}</span>
          <span className="text-gray-700 font-mono">
            {'▓'.repeat(Math.round((d.value / max) * 20)).padEnd(20, '░')}
          </span>
          <span className="text-gray-600 w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function SetupBanner({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 text-lg">⚠️</span>
          <span className="font-medium text-amber-800">{title}</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-amber-600 text-sm underline">
          {open ? 'Hide setup' : 'Show setup steps'}
        </button>
      </div>
      {open && (
        <ol className="mt-3 space-y-1 text-sm text-amber-900 list-decimal list-inside">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  );
}

function ComposeModal({
  onClose,
  defaultChannel,
  defaultTo,
  defaultSubject,
  threadId,
  onSent,
}: {
  onClose: () => void;
  defaultChannel?: string;
  defaultTo?: string;
  defaultSubject?: string;
  threadId?: string;
  onSent?: () => void;
}) {
  const [channel, setChannel] = useState(defaultChannel ?? 'email');
  const [to, setTo] = useState(defaultTo ?? '');
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ warning?: string; mailto_url?: string; wa_link?: string } | null>(null);
  const [error, setError] = useState('');

  async function send() {
    if (!to || !body) { setError('To and body are required'); return; }
    setSending(true); setError(''); setResult(null);
    try {
      const resp = await fetch('/api/admin/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_type: channel, to_address: to, subject, body, thread_id: threadId }),
      });
      const data = await resp.json() as typeof result & { error?: string };
      if (!resp.ok) { setError(data.error ?? 'Send failed'); return; }
      setResult(data);
      if (!data.warning) { onSent?.(); onClose(); }
    } catch { setError('Network error'); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">New Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="email">📧 Email</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="sms">📱 SMS</option>
              <option value="phone">📞 Phone (SMS)</option>
              <option value="apple_messages">🍎 Apple Messages (SMS fallback)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="email@example.com or +14161234567"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {channel === 'email' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Type your message…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {result?.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">⚠️ {result.warning}</p>
              {result.mailto_url && (
                <a href={result.mailto_url} className="text-blue-600 underline mt-1 block">
                  Open in email client (mailto)
                </a>
              )}
              {result.wa_link && (
                <a href={result.wa_link} target="_blank" rel="noreferrer" className="text-green-600 underline mt-1 block">
                  Open WhatsApp Web
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={send} disabled={sending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Unified Inbox ────────────────────────────────────────────────────

function UnifiedInboxTab({
  channels,
  summary,
}: {
  channels: CommChannel[];
  summary: ChannelsResponse['summary'];
}) {
  const [channelFilter, setChannelFilter] = useState('all');
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [unreadPerChannel, setUnreadPerChannel] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<CommMessage | null>(null);
  const [thread, setThread] = useState<CommMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async (ch: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ channel: ch });
      if (q) params.set('search', q);
      const resp = await fetch(`/api/admin/communications/messages?${params}`);
      if (resp.ok) {
        const data = await resp.json() as MessagesResponse;
        setMessages(data.messages);
        setUnreadPerChannel(data.unread_per_channel);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMessages(channelFilter, search); }, [channelFilter, fetchMessages]);

  function onSearch(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchMessages(channelFilter, q), 400);
  }

  async function selectMessage(msg: CommMessage) {
    setSelected(msg);
    setThread([]);
    try {
      const resp = await fetch(`/api/admin/communications/messages/${msg.id}`);
      if (resp.ok) {
        const data = await resp.json() as { message: CommMessage; thread: CommMessage[] };
        setSelected(data.message);
        setThread(data.thread);
        // Refresh unread
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'read' } : m));
      }
    } catch { /* ignore */ }
  }

  async function toggleStar(msg: CommMessage) {
    await fetch(`/api/admin/communications/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: !msg.is_starred }),
    });
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_starred: !m.is_starred } : m));
    if (selected?.id === msg.id) setSelected({ ...msg, is_starred: !msg.is_starred });
  }

  async function markSpam(msg: CommMessage) {
    await fetch(`/api/admin/communications/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_spam: true }),
    });
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    if (selected?.id === msg.id) setSelected(null);
  }

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setReplying(true);
    try {
      await fetch('/api/admin/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_type: selected.channel_type,
          to_address: selected.from_address,
          subject: selected.subject ? `Re: ${selected.subject}` : undefined,
          body: replyBody,
          thread_id: selected.thread_id,
        }),
      });
      setReplyBody('');
      if (selected.thread_id) {
        const resp = await fetch(`/api/admin/communications/messages/${selected.id}`);
        if (resp.ok) {
          const data = await resp.json() as { message: CommMessage; thread: CommMessage[] };
          setThread(data.thread);
        }
      }
    } finally { setReplying(false); }
  }

  const totalUnread = Object.values(unreadPerChannel).reduce((a, b) => a + b, 0);

  const channelFilters = [
    { key: 'all', label: '🌐 All', count: totalUnread },
    ...channels.map(c => ({
      key: c.channel_type,
      label: `${CHANNEL_ICONS[c.channel_type] ?? '?'} ${c.channel_name}`,
      count: unreadPerChannel[c.channel_type] ?? 0,
    })),
  ];

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] border border-gray-200 rounded-xl overflow-hidden">
      {/* Sidebar — channel filters */}
      <div className="w-48 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search…"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {channelFilters.map(f => (
            <button key={f.key} onClick={() => setChannelFilter(f.key)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors ${channelFilter === f.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
              <span className="truncate">{f.label}</span>
              {f.count > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 shrink-0">{f.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200">
          <button onClick={() => setComposing(true)}
            className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 font-medium">
            ✏️ Compose
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${messages.length} messages`}
          </span>
          <span className="text-xs text-gray-400">{summary.total_unread} unread</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading && (
            <div className="p-6 text-center text-gray-400 text-sm">No messages found</div>
          )}
          {messages.map(msg => (
            <button key={msg.id} onClick={() => selectMessage(msg)}
              className={`w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${selected?.id === msg.id ? 'bg-blue-50' : ''}`}>
              <div className="flex items-start gap-2">
                <Avatar name={msg.contact_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm truncate ${msg.status === 'received' ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {msg.contact_name ?? msg.from_address ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(msg.received_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-400">{CHANNEL_ICONS[msg.channel_type]}</span>
                    {msg.subject && (
                      <span className="text-xs text-gray-600 truncate">{msg.subject}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{msg.body}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {msg.status === 'received' && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" title="Unread" />
                    )}
                    {msg.is_starred && <span className="text-yellow-400 text-xs">★</span>}
                    {msg.is_spam && <span className="text-red-400 text-xs">🚫</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message detail */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a message to read
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={selected.contact_name} size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{selected.contact_name ?? selected.from_address}</p>
                    <p className="text-xs text-gray-500">{selected.from_address}</p>
                    {selected.subject && <p className="text-sm font-medium text-gray-700 mt-0.5">{selected.subject}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{CHANNEL_ICONS[selected.channel_type]} {selected.channel_type}</span>
                      <span className="text-xs text-gray-400">{timeAgo(selected.received_at)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${selected.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {selected.direction}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleStar(selected)}
                    className={`text-lg ${selected.is_starred ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}>★</button>
                  <button onClick={() => markSpam(selected)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">🚫 Spam</button>
                </div>
              </div>
            </div>

            {/* Thread history */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {thread.length > 0 ? thread.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${m.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'} rounded-2xl px-4 py-3`}>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-xs mt-1 ${m.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {timeAgo(m.received_at)}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {selected.body}
                </div>
              )}
            </div>

            {/* Reply box */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
                rows={3} placeholder={`Reply via ${selected.channel_type}…`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white" />
              <div className="flex justify-end mt-2">
                <button onClick={sendReply} disabled={replying || !replyBody.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {replying ? 'Sending…' : `Send ${CHANNEL_ICONS[selected.channel_type]}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {composing && (
        <ComposeModal onClose={() => setComposing(false)} onSent={() => fetchMessages(channelFilter, search)} />
      )}
    </div>
  );
}

// ─── Tab 2: Email/Gmail ──────────────────────────────────────────────────────

function EmailTab({ channels }: { channels: CommChannel[] }) {
  const emailChannel = channels.find(c => c.channel_type === 'email');
  const isConnected = emailChannel?.status === 'connected';
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [folder, setFolder] = useState('inbox');
  const [composing, setComposing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');
  const [selected, setSelected] = useState<CommMessage | null>(null);
  const [thread, setThread] = useState<CommMessage[]>([]);

  const folders: Record<string, string> = { inbox: 'Inbox', sent: 'Sent', starred: 'Starred', spam: 'Spam' };

  async function fetchEmails() {
    const params = new URLSearchParams({ channel: 'email' });
    if (folder === 'sent') params.set('status', 'sent');
    if (folder === 'starred') params.set('status', 'all');
    const resp = await fetch(`/api/admin/communications/messages?${params}`);
    if (resp.ok) {
      const data = await resp.json() as MessagesResponse;
      let msgs = data.messages;
      if (folder === 'starred') msgs = msgs.filter(m => m.is_starred);
      if (folder === 'spam') msgs = msgs.filter(m => m.is_spam);
      if (folder === 'inbox') msgs = msgs.filter(m => !m.is_spam && m.direction === 'inbound');
      if (folder === 'sent') msgs = msgs.filter(m => m.direction === 'outbound');
      setMessages(msgs);
    }
  }

  useEffect(() => { fetchEmails(); }, [folder]);

  async function sync() {
    setSyncing(true); setSyncResult('');
    try {
      const resp = await fetch('/api/admin/communications/sync/gmail', { method: 'POST' });
      const data = await resp.json() as { synced?: number; mode?: string; warning?: string };
      setSyncResult(`Synced ${data.synced ?? 0} emails (${data.mode ?? '?'} mode)${data.warning ? ' — ' + data.warning : ''}`);
      fetchEmails();
    } finally { setSyncing(false); }
  }

  async function selectMsg(msg: CommMessage) {
    setSelected(msg);
    const resp = await fetch(`/api/admin/communications/messages/${msg.id}`);
    if (resp.ok) {
      const data = await resp.json() as { message: CommMessage; thread: CommMessage[] };
      setSelected(data.message);
      setThread(data.thread);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center justify-between p-3 rounded-lg ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-2">
          <span>{isConnected ? '✅' : '⚠️'}</span>
          <span className="text-sm font-medium">
            {isConnected ? 'Gmail connected — syncing' : 'Demo mode — connect Gmail for real emails'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={sync} disabled={syncing}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 bg-white">
            {syncing ? '⟳ Syncing…' : '⟳ Sync Now'}
          </button>
          {!isConnected && (
            <a href="/api/auth/google?scope=gmail"
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              🔗 Connect Gmail
            </a>
          )}
        </div>
      </div>
      {syncResult && <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">{syncResult}</p>}

      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-40 shrink-0 space-y-1">
          <button onClick={() => setComposing(true)}
            className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 mb-3 font-medium">
            ✏️ Compose
          </button>
          {Object.entries(folders).map(([k, v]) => (
            <button key={k} onClick={() => setFolder(k)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${folder === k ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>
              {v}
            </button>
          ))}
        </div>

        {/* Message list + detail */}
        <div className="flex-1 flex gap-3 min-w-0">
          <div className="w-80 shrink-0 border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">{folders[folder]}</div>
            <div className="overflow-y-auto max-h-[500px]">
              {messages.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">No messages</div>
              )}
              {messages.map(msg => (
                <button key={msg.id} onClick={() => selectMsg(msg)}
                  className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 ${selected?.id === msg.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${msg.status === 'received' ? 'font-semibold' : 'font-medium text-gray-600'}`}>
                      {msg.contact_name ?? msg.from_address}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-1">{timeAgo(msg.received_at)}</span>
                  </div>
                  {msg.subject && <p className="text-xs text-gray-600 truncate mt-0.5">{msg.subject}</p>}
                  <p className="text-xs text-gray-400 truncate mt-0.5">{msg.body}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 border border-gray-200 rounded-xl p-4 min-w-0 overflow-y-auto max-h-[500px]">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select an email</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selected.subject ?? '(no subject)'}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">From: {selected.contact_name ?? selected.from_address} &lt;{selected.from_address}&gt;</p>
                  <p className="text-xs text-gray-400">{new Date(selected.received_at).toLocaleString()}</p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  {thread.length > 0 ? (
                    <div className="space-y-4">
                      {thread.map(m => (
                        <div key={m.id} className={`p-3 rounded-lg ${m.direction === 'outbound' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">{m.direction === 'outbound' ? 'You' : m.contact_name ?? m.from_address}</span>
                            <span className="text-xs text-gray-400">{timeAgo(m.received_at)}</span>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.body}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {composing && (
        <ComposeModal defaultChannel="email" onClose={() => setComposing(false)} onSent={fetchEmails} />
      )}
    </div>
  );
}

// ─── Tab 3: WhatsApp ─────────────────────────────────────────────────────────

function WhatsAppTab({ channels }: { channels: CommChannel[] }) {
  const waChannel = channels.find(c => c.channel_type === 'whatsapp');
  const isConnected = waChannel?.status === 'connected';
  const [contacts, setContacts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<CommMessage[]>([]);
  const [allMessages, setAllMessages] = useState<CommMessage[]>([]);
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [waLink, setWaLink] = useState('');

  useEffect(() => {
    fetch('/api/admin/communications/messages?channel=whatsapp')
      .then(r => r.json())
      .then((data: MessagesResponse) => {
        setAllMessages(data.messages);
        const seen = new Set<string>();
        const clist: string[] = [];
        for (const m of data.messages) {
          const key = (m.direction === 'inbound' ? m.from_address : m.to_address) ?? m.contact_name ?? 'Unknown';
          if (!seen.has(key)) { seen.add(key); clist.push(key); }
        }
        setContacts(clist);
        if (clist.length > 0 && !selected) setSelected(clist[0]);
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const msgs = allMessages.filter(m =>
      m.from_address === selected || m.to_address === selected ||
      m.contact_name === selected,
    ).sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    setThread(msgs);
  }, [selected, allMessages]);

  async function sendWA() {
    if (!selected || !msgBody.trim()) return;
    setSending(true); setWaLink('');
    try {
      const resp = await fetch('/api/admin/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_type: 'whatsapp', to_address: selected, body: msgBody }),
      });
      const data = await resp.json() as { message?: CommMessage; wa_link?: string; warning?: string };
      if (data.wa_link) setWaLink(data.wa_link);
      if (data.message) {
        setAllMessages(prev => [...prev, data.message!]);
        setMsgBody('');
      }
    } finally { setSending(false); }
  }

  const waSetupSteps = [
    'Create Meta Business Account at business.facebook.com',
    'Add WhatsApp Business API product to your app',
    'Get Phone Number ID and generate a Permanent Access Token',
    'Set env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID',
    `Register webhook URL: {your_domain}/api/admin/communications/webhooks/whatsapp`,
    'Set WHATSAPP_VERIFY_TOKEN to any secret string you choose',
  ];

  return (
    <div className="space-y-4">
      {!isConnected && <SetupBanner title="WhatsApp not connected" steps={waSetupSteps} />}
      <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden h-[500px]">
        {/* Contact list */}
        <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50">
          <div className="p-3 border-b border-gray-200 text-sm font-medium text-gray-700">Conversations</div>
          <div className="overflow-y-auto flex-1">
            {contacts.length === 0 && <div className="p-4 text-sm text-gray-400">No conversations</div>}
            {contacts.map(c => (
              <button key={c} onClick={() => setSelected(c)}
                className={`w-full flex items-center gap-2 p-3 text-left border-b border-gray-100 hover:bg-white ${selected === c ? 'bg-white' : ''}`}>
                <Avatar name={c} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c}</p>
                  <p className="text-xs text-gray-400">WhatsApp</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Avatar name={selected} size="sm" />
            <span className="font-medium text-sm text-gray-800">{selected ?? 'Select a contact'}</span>
            {selected && (
              <a href={`https://wa.me/${(selected).replace(/\D/g, '')}?text=Hello`}
                target="_blank" rel="noreferrer"
                className="ml-auto text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600">
                📲 Quick WA.me
              </a>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {thread.map(m => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${m.direction === 'outbound' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-sm">{m.body}</p>
                  <p className={`text-xs mt-0.5 ${m.direction === 'outbound' ? 'text-green-100' : 'text-gray-400'}`}>{timeAgo(m.received_at)}</p>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              {waLink && (
                <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                  WhatsApp not configured —{' '}
                  <a href={waLink} target="_blank" rel="noreferrer" className="underline font-medium">Open WA.me link</a>
                </div>
              )}
              <div className="flex gap-2">
                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={2}
                  placeholder="Type a message…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                <button onClick={sendWA} disabled={sending || !msgBody.trim()}
                  className="px-4 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 text-sm">
                  {sending ? '…' : '▶'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: SMS & Phone ──────────────────────────────────────────────────────

function SmsPhoneTab({ channels }: { channels: CommChannel[] }) {
  const smsChannel = channels.find(c => c.channel_type === 'sms');
  const isConnected = smsChannel?.status === 'connected';
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<CommMessage[]>([]);
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    fetch('/api/admin/communications/messages?channel=sms')
      .then(r => r.json())
      .then((data: MessagesResponse) => {
        const sorted = data.messages.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
        setMessages(sorted);
        if (sorted.length > 0 && !selected) {
          const first = sorted[0].from_address ?? sorted[0].to_address ?? null;
          setSelected(first);
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const t = messages.filter(m => m.from_address === selected || m.to_address === selected)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    setThread(t);
  }, [selected, messages]);

  async function sendSms() {
    if (!selected || !msgBody.trim()) return;
    setSending(true);
    try {
      const resp = await fetch('/api/admin/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_type: 'sms', to_address: selected, body: msgBody }),
      });
      const data = await resp.json() as { message?: CommMessage };
      if (data.message) { setMessages(prev => [...prev, data.message!]); setMsgBody(''); }
    } finally { setSending(false); }
  }

  const contacts = [...new Set(messages.map(m => m.from_address ?? m.to_address ?? 'Unknown'))];

  const twilioSteps = [
    'Create a Twilio account at twilio.com/try-twilio (free trial credit included)',
    'Buy a phone number from the Twilio console (~$1/month)',
    'Set env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER',
    `Configure SMS webhook URL in Twilio console: {your_domain}/api/admin/communications/webhooks/twilio`,
    'Configure Voice webhook URL for inbound calls (same endpoint)',
  ];

  return (
    <div className="space-y-4">
      {!isConnected && <SetupBanner title="Twilio not connected" steps={twilioSteps} />}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        💡 Twilio pricing: SMS ~$0.0079/msg · Voice ~$0.0140/min · Phone number ~$1.00/month
      </div>
      <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden h-[450px]">
        {/* Contacts */}
        <div className="w-48 shrink-0 border-r border-gray-200 bg-gray-50">
          <div className="p-3 border-b border-gray-200 text-sm font-medium text-gray-700 flex items-center justify-between">
            SMS
            <button onClick={() => setComposing(true)}
              className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-lg">+ New</button>
          </div>
          <div className="overflow-y-auto">
            {contacts.map(c => (
              <button key={c} onClick={() => setSelected(c)}
                className={`w-full flex items-center gap-2 p-3 text-left border-b border-gray-100 hover:bg-white ${selected === c ? 'bg-white' : ''}`}>
                <Avatar name={c} size="sm" />
                <p className="text-sm text-gray-800 truncate">{c}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">{selected ?? 'Select contact'}</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {thread.filter(m => m.channel_type === 'sms').map(m => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${m.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-sm">{m.body}</p>
                  <p className={`text-xs mt-0.5 ${m.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>{timeAgo(m.received_at)}</p>
                </div>
              </div>
            ))}
            {/* Call log entries */}
            {thread.filter(m => m.channel_type === 'phone').map(m => (
              <div key={m.id} className="flex justify-center">
                <div className="bg-gray-100 text-gray-600 text-xs px-4 py-2 rounded-full flex items-center gap-2">
                  📞 {m.body}
                  <span className="text-gray-400">{timeAgo(m.received_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
              <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={2}
                placeholder="Type an SMS…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              <button onClick={sendSms} disabled={sending || !msgBody.trim()}
                className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm">
                {sending ? '…' : '▶'}
              </button>
            </div>
          )}
        </div>
      </div>

      {composing && (
        <ComposeModal defaultChannel="sms" onClose={() => setComposing(false)} onSent={() => {}} />
      )}
    </div>
  );
}

// ─── Tab 5: Apple Messages ───────────────────────────────────────────────────

function AppleMessagesTab({ channels }: { channels: CommChannel[] }) {
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const appleChannel = channels.find(c => c.channel_type === 'apple_messages');

  useEffect(() => {
    fetch('/api/admin/communications/messages?channel=apple_messages')
      .then(r => r.json())
      .then((data: MessagesResponse) => setMessages(data.messages))
      .catch(() => { /* ignore */ });
  }, []);

  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-4">
      {/* Explanation card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">🍎 Apple Messages for Business</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Apple iMessage API is NOT available for standard server-side integrations.</strong>{' '}
            Apple Business Connect (formerly Business Chat) requires:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
            <li>Apple Business Register (free) — <a href="https://register.apple.com/resources/business-connect/" target="_blank" rel="noreferrer" className="text-blue-600 underline">register.apple.com/resources/business-connect/</a></li>
            <li>Approved business profile (review process, weeks)</li>
            <li>Messages for Business API — enterprise partnership required (direct Apple approval)</li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-blue-800">✅ Best approach for most businesses</p>
          <p className="text-blue-700 mt-1">
            Use <strong>SMS via Twilio</strong> — messages automatically deliver as iMessage when the recipient has an iPhone with iMessage enabled. No extra setup required beyond Twilio.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-amber-800">🏢 Enterprise alternative</p>
          <p className="text-amber-700 mt-1">
            Apple Business Connect for large enterprises (10,000+ customers). Requires direct Apple partnership. Not available via API without formal agreement.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://register.apple.com/resources/business-connect/" target="_blank" rel="noreferrer"
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700">
            📖 Apple Business Connect Docs
          </a>
          <button onClick={() => setComposing(true)}
            className="text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            📱 Send as SMS (delivers as iMessage)
          </button>
        </div>
      </div>

      {/* Messages from DB with channel_type=apple_messages */}
      {messages.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
            Logged Apple Messages ({messages.length})
          </div>
          <div className="divide-y divide-gray-100">
            {messages.map(msg => (
              <div key={msg.id} className={`p-4 flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${msg.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'} rounded-2xl px-4 py-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={msg.contact_name} size="sm" />
                    <span className="text-xs opacity-70">{msg.contact_name ?? msg.from_address}</span>
                  </div>
                  <p className="text-sm">{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>{timeAgo(msg.received_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {composing && (
        <ComposeModal defaultChannel="sms" onClose={() => setComposing(false)} onSent={() => {}} />
      )}
    </div>
  );
}

// ─── Tab 6: Channel Setup & Monitoring ──────────────────────────────────────

function ChannelSetupTab({
  channels,
  summary,
}: {
  channels: CommChannel[];
  summary: ChannelsResponse['summary'];
}) {
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const ENV_VARS: Record<string, { vars: string[]; webhookPath?: string }> = {
    email: { vars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] },
    whatsapp: { vars: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'], webhookPath: '/api/admin/communications/webhooks/whatsapp' },
    sms: { vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'], webhookPath: '/api/admin/communications/webhooks/twilio' },
    phone: { vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'], webhookPath: '/api/admin/communications/webhooks/twilio' },
    apple_messages: { vars: [] },
  };

  async function testConnection(channel: CommChannel) {
    setTestResults(prev => ({ ...prev, [channel.id]: '⟳ Testing…' }));
    try {
      if (channel.channel_type === 'email') {
        const resp = await fetch('/api/admin/communications/sync/gmail', { method: 'POST' });
        const data = await resp.json() as { mode?: string; synced?: number; warning?: string };
        setTestResults(prev => ({ ...prev, [channel.id]: `${data.mode === 'demo' ? '⚠️ Demo mode' : '✅ Connected'} — synced ${data.synced ?? 0} messages` }));
      } else if (channel.channel_type === 'whatsapp') {
        const token = channel.credentials_set;
        setTestResults(prev => ({ ...prev, [channel.id]: token ? '✅ Credentials set — send a test message to verify' : '⚠️ WHATSAPP_TOKEN not set — configure env vars' }));
      } else if (channel.channel_type === 'sms' || channel.channel_type === 'phone') {
        const cred = channel.credentials_set;
        setTestResults(prev => ({ ...prev, [channel.id]: cred ? '✅ Credentials set — send a test SMS to verify' : '⚠️ Twilio credentials not set' }));
      } else {
        setTestResults(prev => ({ ...prev, [channel.id]: 'ℹ️ Apple Messages requires enterprise partnership — no automated test available' }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [channel.id]: '❌ Test failed — check console' }));
    }
  }

  // Simulate 24h volume as fixed demo data
  const volumeData = channels.map(c => ({
    label: c.channel_name,
    value: c.total_messages ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Unread</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_unread}</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
          <p className="text-sm text-gray-500">Messages (24h)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.messages_24h}</p>
        </div>
        <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
          <p className="text-sm text-gray-500">Messages (7d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.messages_7d}</p>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map(ch => {
          const env = ENV_VARS[ch.channel_type] ?? { vars: [] };
          return (
            <div key={ch.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CHANNEL_ICONS[ch.channel_type]}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{ch.channel_name}</p>
                    <p className="text-xs text-gray-500">{ch.channel_type}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[ch.status] ?? STATUS_COLORS.disconnected}`}>
                  {ch.status}
                </span>
              </div>

              {/* Env vars */}
              {env.vars.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Required Environment Variables</p>
                  {env.vars.map(v => {
                    // We can't check actual env var values client-side — show based on credentials_set
                    const set = ch.credentials_set;
                    return (
                      <div key={v} className="flex items-center justify-between text-xs">
                        <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{v}</code>
                        <span className={set ? 'text-green-600' : 'text-red-400'}>
                          {set ? '✓ Set' : '✗ Not set'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Webhook URL */}
              {env.webhookPath && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Webhook URL</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded block text-gray-700 truncate">
                    {'[your-domain]'}{env.webhookPath}
                  </code>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div>
                  <p className="text-gray-400">Unread</p>
                  <p className="font-semibold text-gray-800">{ch.unread_count}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total</p>
                  <p className="font-semibold text-gray-800">{ch.total_messages}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last msg</p>
                  <p className="font-semibold text-gray-800">
                    {ch.latest_message_at ? timeAgo(ch.latest_message_at) : '—'}
                  </p>
                </div>
              </div>

              {/* Test button */}
              <div>
                <button onClick={() => testConnection(ch)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                  🔌 Test Connection
                </button>
                {testResults[ch.id] && (
                  <p className="text-xs text-gray-600 mt-1">{testResults[ch.id]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Volume chart */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-800 mb-3">Message Volume by Channel</h3>
        <BarChart data={volumeData} />
      </div>

      {/* Apple Messages note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">🍎 Apple Messages integration note</p>
        <p>
          Apple iMessage Business requires a direct Apple Business Connect partnership. For most businesses,
          SMS via Twilio delivers as iMessage automatically to iPhone users.
          <a href="https://register.apple.com/resources/business-connect/" target="_blank" rel="noreferrer"
            className="text-blue-600 underline ml-1">
            Learn more →
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'inbox',    label: '🌐 Unified Inbox' },
  { key: 'email',   label: '📧 Email' },
  { key: 'wa',      label: '💬 WhatsApp' },
  { key: 'sms',     label: '📱 SMS & Phone' },
  { key: 'apple',   label: '🍎 Apple' },
  { key: 'setup',   label: '⚙️ Setup & Monitor' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CommunicationsPage() {
  const [tab, setTab] = useState<TabKey>('inbox');
  const [data, setData] = useState<ChannelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/communications')
      .then(r => r.json())
      .then((d: ChannelsResponse) => setData(d))
      .catch(() => setError('Failed to load communication channels'))
      .finally(() => setLoading(false));
  }, []);

  const totalUnread = data?.summary.total_unread ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-spin">⟳</div>
          <p className="text-gray-500 text-sm">Loading Communications Hub…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-blue-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unified Communications Hub</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                All channels in one place — Email, WhatsApp, SMS, Phone, Apple Messages
              </p>
            </div>
            {totalUnread > 0 && (
              <div className="bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                {totalUnread} unread
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {tab === 'inbox' && data && <UnifiedInboxTab channels={data.channels} summary={data.summary} />}
          {tab === 'email' && data && <EmailTab channels={data.channels} />}
          {tab === 'wa'    && data && <WhatsAppTab channels={data.channels} />}
          {tab === 'sms'   && data && <SmsPhoneTab channels={data.channels} />}
          {tab === 'apple' && data && <AppleMessagesTab channels={data.channels} />}
          {tab === 'setup' && data && <ChannelSetupTab channels={data.channels} summary={data.summary} />}
        </div>
      </div>
    </div>
  );
}
