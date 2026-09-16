'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Compose' | 'History' | 'Alert Rules' | 'Templates';
const TABS: Tab[] = ['Compose', 'History', 'Alert Rules', 'Templates'];

interface Broadcast {
  id: number;
  name: string;
  subject: string;
  body: string;
  broadcast_type: string;
  target_audience: string;
  status: string;
  recipient_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface AlertRule {
  id: number;
  name: string;
  category: string;
  severity: string;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  channels: string;
}

const TEMPLATES = [
  { key: 'welcome', label: 'Welcome Email', subject: 'Welcome to SohamYoga Platform!', body: 'Hi {{first_name}}, welcome aboard! We\'re excited to have you as part of the SohamYoga community. Your account is ready and waiting.' },
  { key: 'weekly_digest', label: 'Weekly Digest', subject: 'Your Weekly Marketing Digest — {{week}}', body: 'Hi {{first_name}}, here\'s your weekly summary of platform activity, top-performing content, and upcoming campaigns.' },
  { key: 'promotion', label: 'Promotion', subject: 'Exclusive Offer for {{company}}', body: 'Hi {{first_name}}, we have a special offer just for you! Use code SAVE20 to get 20% off your next annual plan.' },
  { key: 'event_reminder', label: 'Event Reminder', subject: 'Reminder: Your event is tomorrow', body: 'Hi {{first_name}}, just a reminder that your scheduled event is coming up tomorrow. Don\'t miss it!' },
  { key: 'billing_notice', label: 'Billing Notice', subject: 'Billing Update for {{company}}', body: 'Hi {{first_name}}, your subscription renewal is due soon. Please update your payment details to avoid interruption.' },
  { key: 'feature_announcement', label: 'Feature Announcement', subject: 'New Feature: {{feature_name}}', body: 'Hi {{first_name}}, we\'re excited to announce a new feature: {{feature_name}}. Here\'s how it benefits you...' },
  { key: 're-engagement', label: 'Re-Engagement', subject: 'We miss you, {{first_name}}!', body: 'Hi {{first_name}}, we noticed you haven\'t logged in recently. Here\'s what\'s new on the platform — come check it out!' },
  { key: 'review_request', label: 'Review Request', subject: 'How was your experience with {{company}}?', body: 'Hi {{first_name}}, we value your feedback! Take 2 minutes to share your experience and help us improve.' },
];

const SEVERITIES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const TYPE_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800',
  whatsapp: 'bg-green-100 text-green-800',
  sms: 'bg-purple-100 text-purple-800',
  push: 'bg-indigo-100 text-indigo-800',
  in_app: 'bg-cyan-100 text-cyan-800',
  all: 'bg-gray-100 text-gray-800',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-yellow-100 text-yellow-800',
  sending: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function BroadcastPage() {
  const [tab, setTab] = useState<Tab>('Compose');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Compose form state
  const [form, setForm] = useState({
    name: '', subject: '', body: '', broadcast_type: 'email',
    target_audience: 'all_customers', scheduled_at: '',
  });
  const [aiImproving, setAiImproving] = useState(false);
  const [sending, setSending] = useState(false);

  // History filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const seedData = async () => {
    setSeeding(true);
    await fetch('/api/admin/broadcast/seed', { method: 'POST' });
    setSeeded(true);
    setSeeding(false);
    loadBroadcasts();
    loadRules();
  };

  const loadBroadcasts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('type', filterType);
    const res = await fetch(`/api/admin/broadcast?${params}`);
    const data = await res.json();
    if (data.broadcasts) setBroadcasts(data.broadcasts);
  }, [filterStatus, filterType]);

  const loadRules = async () => {
    const res = await fetch('/api/admin/alert-rules');
    const data = await res.json();
    if (data.rules) setRules(data.rules);
  };

  useEffect(() => { loadBroadcasts(); loadRules(); }, [loadBroadcasts]);
  useEffect(() => { loadBroadcasts(); }, [filterStatus, filterType, loadBroadcasts]);

  const handleAiImprove = async () => {
    if (!form.body) return;
    setAiImproving(true);
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Rewrite this broadcast message for better engagement. Keep it concise and compelling. Return only the improved message text, no explanations.\n\nOriginal: ${form.body}`,
          stream: false,
        }),
      });
      const data = await res.json();
      if (data.response) setForm(f => ({ ...f, body: data.response.trim() }));
    } catch {
      alert('Ollama unavailable. Ensure it is running at localhost:11434');
    }
    setAiImproving(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const createRes = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, scheduled_at: form.scheduled_at || undefined }),
      });
      const created = await createRes.json();
      if (created.broadcast && !form.scheduled_at) {
        await fetch(`/api/admin/broadcast/${created.broadcast.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send' }),
        });
      }
      setForm({ name: '', subject: '', body: '', broadcast_type: 'email', target_audience: 'all_customers', scheduled_at: '' });
      loadBroadcasts();
      setTab('History');
    } catch (err) {
      alert('Error: ' + String(err));
    }
    setSending(false);
  };

  const toggleRule = async (rule: AlertRule) => {
    await fetch('/api/admin/alert-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    loadRules();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📢 Broadcast & Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Send messages to customers, manage alert rules and templates</p>
        </div>
        {!seeded && (
          <button onClick={seedData} disabled={seeding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {seeding ? 'Seeding…' : '🌱 Seed Demo Data'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Compose */}
      {tab === 'Compose' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. September Newsletter" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.broadcast_type} onChange={e => setForm(f => ({ ...f, broadcast_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="in_app">In-App</option>
                  <option value="all">All Channels</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all_customers">All Customers</option>
                  <option value="leads">Active Leads</option>
                  <option value="subscribers">Subscribers</option>
                  <option value="test">Test (5 users)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Email subject line" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Message Body</label>
                <button onClick={handleAiImprove} disabled={aiImproving || !form.body}
                  className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50">
                  {aiImproving ? '🤖 Improving…' : '🤖 AI Improve Message'}
                </button>
              </div>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Write your message here…" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Personalization Tokens</p>
              <div className="flex flex-wrap gap-2">
                {['{{first_name}}', '{{last_name}}', '{{company}}', '{{plan_name}}', '{{expiry_date}}'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, body: f.body + t }))}
                    className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 font-mono">
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button onClick={handleSend} disabled={sending || !form.name || !form.body}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
              {sending ? 'Sending…' : form.scheduled_at ? '📅 Schedule Broadcast' : '🚀 Send Now'}
            </button>
          </div>

          {/* Preview pane */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview</p>
            {form.subject && <p className="font-semibold text-gray-800 mb-2">{form.subject}</p>}
            {form.body ? (
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200">
                {form.body}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic">Start typing to see preview…</div>
            )}
            {form.target_audience && (
              <div className="mt-3 text-xs text-gray-500">
                <span className="font-medium">Audience:</span> {form.target_audience.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {tab === 'History' && (
        <div>
          <div className="flex gap-3 mb-4">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Types</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="all">All Channels</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Audience</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Recipients</th>
                  <th className="px-4 py-3 text-right font-medium">Delivered</th>
                  <th className="px-4 py-3 text-right font-medium">Open %</th>
                  <th className="px-4 py-3 text-right font-medium">Click %</th>
                  <th className="px-4 py-3 text-left font-medium">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {broadcasts.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">No broadcasts yet. Seed demo data or create one.</td></tr>
                )}
                {broadcasts.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[b.broadcast_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {b.broadcast_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.target_audience?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{b.recipient_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{b.delivered_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {b.delivered_count > 0 ? ((b.opened_count / b.delivered_count) * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.opened_count > 0 ? ((b.clicked_count / b.opened_count) * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {b.sent_at ? new Date(b.sent_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Alert Rules */}
      {tab === 'Alert Rules' && (
        <div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Severity</th>
                  <th className="px-4 py-3 text-left font-medium">Channels</th>
                  <th className="px-4 py-3 text-center font-medium">Active</th>
                  <th className="px-4 py-3 text-left font-medium">Last Triggered</th>
                  <th className="px-4 py-3 text-right font-medium">Triggers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No rules yet. Seed demo data first.</td></tr>
                )}
                {rules.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITIES[r.severity] ?? 'bg-gray-100 text-gray-700'}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.channels}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleRule(r)}
                        className={`w-10 h-5 rounded-full transition-colors ${r.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full shadow transform transition-transform mx-0.5 ${r.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{r.trigger_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Templates */}
      {tab === 'Templates' && (
        <div className="grid grid-cols-2 gap-4">
          {TEMPLATES.map(t => (
            <div key={t.key} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-sm">{t.label}</h3>
                <button
                  onClick={() => {
                    setForm(f => ({ ...f, name: t.label, subject: t.subject, body: t.body }));
                    setTab('Compose');
                  }}
                  className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                  Use Template
                </button>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">Subject: {t.subject}</p>
              <p className="text-xs text-gray-600 line-clamp-3">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
