'use client';

import { useEffect, useState, useCallback } from 'react';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  send_mode: string;
  status: string;
  topic_name: string | null;
  message_count: string;
  not_configured_count: string;
  created_at: string;
}
interface Message {
  id: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'survey' | 'interview'>('email');
  const [sendMode, setSendMode] = useState<'draft' | 'automatic'>('draft');
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendResult, setSendResult] = useState<string>('');

  const loadCampaigns = useCallback(() => {
    fetch('/api/campaigns', { cache: 'no-store' }).then(r => r.json()).then(d => setCampaigns(d.campaigns ?? []));
  }, []);
  useEffect(loadCampaigns, [loadCampaigns]);

  const loadMessages = useCallback((campaignId: string) => {
    fetch(`/api/campaigns/${campaignId}/messages`, { cache: 'no-store' }).then(r => r.json()).then(d => setMessages(d.messages ?? []));
  }, []);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, channel, sendMode }),
    });
    setName('');
    loadCampaigns();
  };

  const addMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !recipient.trim() || !body.trim()) return;
    await fetch(`/api/campaigns/${selected}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, subject, body }),
    });
    setRecipient(''); setSubject(''); setBody('');
    loadMessages(selected);
    loadCampaigns();
  };

  const sendCampaign = async () => {
    if (!selected) return;
    const res = await fetch(`/api/campaigns/${selected}/send`, { method: 'POST' });
    const data = await res.json();
    setSendResult(`${data.result}: ${data.reason} (${data.messagesAffected} message(s) affected)`);
    loadMessages(selected);
    loadCampaigns();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>

      <form onSubmit={createCampaign} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Channel</label>
          <select value={channel} onChange={e => setChannel(e.target.value as any)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            <option value="email">Email</option>
            <option value="survey">Survey</option>
            <option value="interview">Interview</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Send mode</label>
          <select value={sendMode} onChange={e => setSendMode(e.target.value as any)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            <option value="draft">Draft (human sends)</option>
            <option value="automatic">Automatic</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Create campaign</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Queue</h2>
          <ul className="space-y-1.5">
            {campaigns.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => { setSelected(c.id); loadMessages(c.id); setSendResult(''); }}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${selected === c.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-gray-50'}`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.channel} · {c.send_mode} · {c.status} · {c.message_count} message(s){Number(c.not_configured_count) > 0 && ` · ${c.not_configured_count} not_configured`}</div>
                </button>
              </li>
            ))}
            {!campaigns.length && <li className="text-sm text-gray-400">No campaigns yet.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Compose</h2>
          {selected ? (
            <div className="space-y-3">
              <form onSubmit={addMessage} className="space-y-2">
                <input placeholder="Recipient" value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
                <input placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
                <textarea placeholder="Body" value={body} onChange={e => setBody(e.target.value)} rows={4} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
                <button type="submit" className="rounded bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-900">Queue message</button>
              </form>
              <button onClick={sendCampaign} className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Send campaign</button>
              {sendResult && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{sendResult}</div>}

              <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-gray-100 pt-2">
                {messages.map(m => (
                  <div key={m.id} className="rounded border border-gray-100 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.recipient}</span>
                      <span className={`rounded px-1.5 py-0.5 ${m.status === 'not_configured' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{m.status}</span>
                    </div>
                    {m.subject && <div className="text-gray-500">{m.subject}</div>}
                    <div className="text-gray-700">{m.body}</div>
                    {m.error_message && <div className="mt-1 text-orange-700">{m.error_message}</div>}
                  </div>
                ))}
                {!messages.length && <div className="text-sm text-gray-400">No messages queued yet.</div>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select a campaign to compose.</p>
          )}
        </div>
      </div>
    </div>
  );
}
