'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Live Sessions' | 'Service Tickets' | 'Knowledge Base' | 'Bot Analytics' | 'Bot Configuration' | 'Demo Scenarios';
const TABS: Tab[] = ['Live Sessions', 'Service Tickets', 'Knowledge Base', 'Bot Analytics', 'Bot Configuration', 'Demo Scenarios'];

interface BotSession {
  id: number;
  session_token: string;
  user_type: string;
  user_email: string | null;
  context_type: string;
  started_at: string;
  last_message_at: string | null;
  message_count: number;
  resolved: boolean;
  escalated_to_human: boolean;
  satisfaction_score: number | null;
}

interface ServiceTicket {
  id: number;
  customer_email: string | null;
  customer_name: string | null;
  subject: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  assigned_agent: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface KbItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  usage_count: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  waiting: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-700',
};

const DEMO_SCENARIOS = [
  {
    title: 'Billing Query',
    steps: [
      { role: 'user', text: 'Hi, I want to know about upgrading my plan' },
      { role: 'assistant', text: 'Hi! I can help with that. Your current Starter plan ($49/mo) can be upgraded to Growth ($149/mo) or Enterprise ($499/mo). Upgrades are immediate with prorated billing.' },
      { role: 'user', text: 'What extra features do I get with Growth?' },
      { role: 'assistant', text: 'Growth adds: 20 platforms (vs 5), 5 team members, advanced analytics, affiliate management, and priority support. Annual billing saves you 20%.' },
      { role: 'user', text: 'Great, how do I upgrade?' },
      { role: 'assistant', text: 'Go to Settings > Subscription > Upgrade Plan. Your new billing starts immediately and unused days from current plan are prorated.' },
    ],
  },
  {
    title: 'Feature Query',
    steps: [
      { role: 'user', text: 'Does the platform support TikTok posting?' },
      { role: 'assistant', text: 'Yes! TikTok is one of our 36 supported platforms. You can schedule posts, reels, and stories directly from the platform.' },
      { role: 'user', text: 'Can the AI help write TikTok captions?' },
      { role: 'assistant', text: 'Absolutely! Our AI (powered by Ollama llama3.2) can generate engaging captions optimized for TikTok\'s algorithm, including hashtag suggestions.' },
    ],
  },
  {
    title: 'Operations Query',
    steps: [
      { role: 'user', text: 'My posts stopped publishing to Instagram' },
      { role: 'assistant', text: 'That usually means your Instagram token has expired. Go to Admin > Platform Credentials > Instagram and click Re-authenticate.' },
      { role: 'user', text: 'I re-authenticated but still not working' },
      { role: 'assistant', text: 'Check Admin > Health > Cron Jobs to ensure the social-auto-publish job is running. Also verify your Instagram account isn\'t in restricted mode.' },
      { role: 'user', text: 'The job shows as failed' },
      { role: 'assistant', text: 'I\'ll escalate this to our technical team. A support ticket has been created — you\'ll hear back within 2 hours.' },
    ],
  },
  {
    title: 'Complaint',
    steps: [
      { role: 'user', text: 'I was charged twice this month!' },
      { role: 'assistant', text: 'I\'m so sorry to hear that. Let me help resolve this immediately. Can you confirm the email on your account?' },
      { role: 'user', text: 'It is john@example.com' },
      { role: 'assistant', text: 'Thank you. Duplicate billing is rare and always resolved with a full refund. I\'ve escalated this as urgent to our billing team — you\'ll receive confirmation within 1 hour.' },
    ],
  },
  {
    title: 'General Query',
    steps: [
      { role: 'user', text: 'Is there a free trial?' },
      { role: 'assistant', text: 'Yes! We offer a 14-day free trial with full Growth plan features — no credit card required.' },
      { role: 'user', text: 'What happens when the trial ends?' },
      { role: 'assistant', text: 'You\'ll be prompted to choose a paid plan. If you don\'t upgrade, your account is paused (data kept for 30 days). No automatic charges.' },
    ],
  },
];

export default function CustomerServicePage() {
  const [tab, setTab] = useState<Tab>('Live Sessions');
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [kbItems, setKbItems] = useState<KbItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [ticketFilter, setTicketFilter] = useState('');
  const [kbCategory, setKbCategory] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [generatingFaq, setGeneratingFaq] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [newKb, setNewKb] = useState({ category: 'faq', question: '', answer: '' });
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/admin/bot-sessions');
      if (res.ok) { const d = await res.json(); setSessions(d.sessions ?? []); }
    } catch { /* table may not exist yet */ }
  };

  const loadTickets = useCallback(async () => {
    try {
      const params = ticketFilter ? `?status=${ticketFilter}` : '';
      const res = await fetch(`/api/admin/service-tickets${params}`);
      if (res.ok) { const d = await res.json(); setTickets(d.tickets ?? []); }
    } catch { /* table may not exist yet */ }
  }, [ticketFilter]);

  const loadKb = useCallback(async () => {
    try {
      const params = kbCategory ? `?category=${kbCategory}` : '';
      const res = await fetch(`/api/admin/bot-knowledge${params}`);
      if (res.ok) { const d = await res.json(); setKbItems(d.items ?? []); }
    } catch { /* table may not exist yet */ }
  }, [kbCategory]);

  useEffect(() => { loadSessions(); loadTickets(); loadKb(); }, [loadTickets, loadKb]);
  useEffect(() => { loadTickets(); }, [ticketFilter, loadTickets]);
  useEffect(() => { loadKb(); }, [kbCategory, loadKb]);

  const seedData = async () => {
    setSeeding(true);
    await fetch('/api/admin/bot-knowledge/seed', { method: 'POST' });
    setSeeded(true);
    setSeeding(false);
    loadKb();
  };

  const handleGenerateFaq = async () => {
    setGeneratingFaq(true);
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Generate 5 FAQ questions and answers for the "${kbCategory || 'general'}" category of a digital marketing SaaS platform. Format as JSON array: [{"question":"...","answer":"..."}]. Return only valid JSON.`,
          stream: false,
        }),
      });
      const data = await res.json();
      if (data.response) {
        const jsonMatch = data.response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const faqs = JSON.parse(jsonMatch[0]) as Array<{ question: string; answer: string }>;
          for (const faq of faqs) {
            await fetch('/api/admin/bot-knowledge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category: kbCategory || 'faq', question: faq.question, answer: faq.answer }),
            });
          }
          loadKb();
        }
      }
    } catch {
      alert('Ollama unavailable or returned invalid JSON');
    }
    setGeneratingFaq(false);
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    await fetch('/api/admin/service-tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedTicket.id, status: 'resolved', resolution_notes: resolutionNotes }),
    });
    setSelectedTicket(null);
    loadTickets();
  };

  const handleAddKb = async () => {
    if (!newKb.question || !newKb.answer) return;
    await fetch('/api/admin/bot-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKb),
    });
    setNewKb({ category: 'faq', question: '', answer: '' });
    loadKb();
  };

  const totalSessions = sessions.length;
  const resolved = sessions.filter(s => s.resolved && !s.escalated_to_human).length;
  const escalated = sessions.filter(s => s.escalated_to_human).length;
  const avgSatisfaction = sessions.filter(s => s.satisfaction_score).reduce((a, s) => a + (s.satisfaction_score ?? 0), 0) / (sessions.filter(s => s.satisfaction_score).length || 1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎧 Customer Service</h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered support bot, service tickets, and knowledge base</p>
        </div>
        {!seeded && (
          <button onClick={seedData} disabled={seeding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {seeding ? 'Seeding…' : '🌱 Seed Demo Data'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Live Sessions */}
      {tab === 'Live Sessions' && (
        <div>
          {sessions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">No active sessions</p>
              <p className="text-sm">Sessions will appear here when customers use the support chat</p>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Context</th>
                  <th className="px-4 py-3 text-right font-medium">Messages</th>
                  <th className="px-4 py-3 text-left font-medium">Started</th>
                  <th className="px-4 py-3 text-left font-medium">Last Message</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.user_email ?? 'Guest'}</p>
                      <p className="text-xs text-gray-500">{s.user_type}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.context_type}</td>
                    <td className="px-4 py-3 text-right">{s.message_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.last_message_at ? new Date(s.last_message_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      {s.escalated_to_human ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">Escalated</span>
                      ) : s.resolved ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Resolved</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          await fetch('/api/admin/service-tickets', {
                            method: 'POST' as const,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ session_id: s.id, customer_email: s.user_email, subject: 'Admin takeover', description: 'Admin took over this session', priority: 'high' }),
                          });
                          loadTickets();
                          setTab('Service Tickets');
                        }}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                        Take Over
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Service Tickets */}
      {tab === 'Service Tickets' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex gap-3 mb-4">
              <select value={ticketFilter} onChange={e => setTicketFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-center py-8 text-gray-400">No tickets yet.</p>}
              {tickets.map(t => (
                <div key={t.id}
                  onClick={() => { setSelectedTicket(t); setResolutionNotes(t.resolution_notes ?? ''); }}
                  className={`p-3 border rounded-xl cursor-pointer hover:border-indigo-300 transition-colors ${selectedTicket?.id === t.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{t.subject}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100'}`}>{t.priority}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t.customer_email ?? 'No email'} · {new Date(t.created_at).toLocaleDateString()}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100'}`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedTicket && (
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{selectedTicket.subject}</h3>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><span className="font-medium">Customer:</span> {selectedTicket.customer_name ?? 'Unknown'} ({selectedTicket.customer_email})</p>
                <p><span className="font-medium">Category:</span> {selectedTicket.category ?? 'General'}</p>
                {selectedTicket.description && <p><span className="font-medium">Description:</span> {selectedTicket.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select defaultValue={selectedTicket.status}
                    onChange={async e => {
                      await fetch('/api/admin/service-tickets', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: selectedTicket.id, status: e.target.value }),
                      });
                      loadTickets();
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting">Waiting</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select defaultValue={selectedTicket.priority}
                    onChange={async e => {
                      await fetch('/api/admin/service-tickets', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: selectedTicket.id, priority: e.target.value }),
                      });
                      loadTickets();
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Resolution Notes</label>
                <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)}
                  rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Add resolution notes…" />
              </div>
              <button onClick={handleResolveTicket}
                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Mark Resolved
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Knowledge Base */}
      {tab === 'Knowledge Base' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              <select value={kbCategory} onChange={e => setKbCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Categories</option>
                {['billing', 'features', 'operations', 'faq', 'pricing', 'troubleshooting'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <button onClick={handleGenerateFaq} disabled={generatingFaq}
                className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 disabled:opacity-50">
                {generatingFaq ? '🤖 Generating…' : '🤖 Generate FAQ'}
              </button>
            </div>
          </div>

          {/* Add entry form */}
          <div className="mb-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Add Knowledge Entry</h3>
            <div className="grid grid-cols-3 gap-3">
              <select value={newKb.category} onChange={e => setNewKb(n => ({ ...n, category: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['billing', 'features', 'operations', 'faq', 'pricing', 'troubleshooting'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input value={newKb.question} onChange={e => setNewKb(n => ({ ...n, question: e.target.value }))}
                placeholder="Question" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleAddKb} disabled={!newKb.question || !newKb.answer}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                Add
              </button>
              <textarea value={newKb.answer} onChange={e => setNewKb(n => ({ ...n, answer: e.target.value }))}
                placeholder="Answer" rows={2} className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {kbItems.length === 0 && <p className="col-span-2 text-center py-8 text-gray-400">No knowledge base entries. Seed demo data first.</p>}
            {kbItems.map(item => (
              <div key={item.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{item.category}</span>
                  <span className="text-xs text-gray-400">Used {item.usage_count}×</span>
                </div>
                <p className="font-medium text-gray-900 text-sm mt-1">{item.question}</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Bot Analytics */}
      {tab === 'Bot Analytics' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalSessions}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Resolved (no escalation)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{resolved}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Avg Satisfaction</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{sessions.filter(s => s.satisfaction_score).length > 0 ? avgSatisfaction.toFixed(1) : '—'}/5</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Escalation Rate</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{totalSessions > 0 ? ((escalated / totalSessions) * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="font-medium text-gray-900 mb-3">Sessions Overview</p>
            {sessions.length === 0 ? (
              <p className="text-gray-400 text-sm">No session data. Sessions will appear as customers use the support chat.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs">
                  <tr>
                    <th className="text-left py-2">Context</th>
                    <th className="text-right py-2">Sessions</th>
                    <th className="text-right py-2">Resolved</th>
                    <th className="text-right py-2">Escalated</th>
                  </tr>
                </thead>
                <tbody>
                  {['billing', 'features', 'operations', 'general'].map(ctx => {
                    const ctxSessions = sessions.filter(s => s.context_type === ctx);
                    return (
                      <tr key={ctx} className="border-t border-gray-100">
                        <td className="py-2 capitalize">{ctx}</td>
                        <td className="py-2 text-right">{ctxSessions.length}</td>
                        <td className="py-2 text-right">{ctxSessions.filter(s => s.resolved).length}</td>
                        <td className="py-2 text-right">{ctxSessions.filter(s => s.escalated_to_human).length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Bot Configuration */}
      {tab === 'Bot Configuration' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">System Prompt</h3>
            <textarea rows={8} readOnly
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 text-gray-700"
              value={`You are SohamBot, the customer service AI for the Sohamyoga digital marketing platform.

BILLING: Plans from $49/mo Starter to $499/mo Enterprise. 30-day money-back guarantee. Annual saves 20%.
FEATURES: 36 social platforms, AI content generation, 104 automated jobs, affiliate management, market research.
OPERATIONS: Next.js + PostgreSQL + Ollama (local AI). Health monitored every 5 minutes.
TROUBLESHOOT: Platform not posting → check /admin/platform-credentials. Workflow not triggering → check triggers.
ESCALATE: For refunds, account cancellation, billing disputes → create a support ticket.

Be helpful, concise, professional. Max 3 sentences per response.`} />
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Greeting Message</h3>
            <input defaultValue="Hi! I'm SohamBot. How can I help you today? 👋"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Reply Chips</h3>
            <div className="flex flex-wrap gap-2">
              {['Check my plan', 'Platform status', 'How to post', 'Talk to human'].map(c => (
                <span key={c} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm">{c}</span>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Escalation Keywords</h3>
            <p className="text-xs text-gray-500 mb-2">Sessions containing these words are flagged for human review:</p>
            <div className="flex flex-wrap gap-2">
              {['refund', 'cancel', 'legal', 'complaint', 'escalate', 'urgent', 'broken', 'fraud'].map(k => (
                <span key={k} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-mono">{k}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Demo Scenarios */}
      {tab === 'Demo Scenarios' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            {DEMO_SCENARIOS.map((s, i) => (
              <button key={i} onClick={() => setSelectedScenario(i)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selectedScenario === i ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.steps.length} steps</p>
              </button>
            ))}
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">{DEMO_SCENARIOS[selectedScenario].title}</h3>
            <div className="space-y-3">
              {DEMO_SCENARIOS[selectedScenario].steps.map((step, i) => (
                <div key={i} className={`flex ${step.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm px-4 py-3 rounded-2xl text-sm ${step.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    <p className={`text-xs font-medium mb-1 ${step.role === 'user' ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {step.role === 'user' ? 'Customer' : '🤖 SohamBot'}
                    </p>
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
