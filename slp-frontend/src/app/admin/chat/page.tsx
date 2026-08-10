'use client';
import { useState } from 'react';

type Tab = 'overview' | 'conversations' | 'agents' | 'bots' | 'channels' | 'analytics' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',      label: 'Overview'       },
  { id: 'conversations', label: 'Conversations'  },
  { id: 'agents',        label: 'Agents'         },
  { id: 'bots',          label: 'AI Bots'        },
  { id: 'channels',      label: 'Channels'       },
  { id: 'analytics',     label: 'Analytics'      },
  { id: 'integrations',  label: 'Integrations'   },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const KPI = [
  { label: 'Open Conversations',  value: '34',     sub: '↑ 12 from yesterday',   color: 'text-amber-600'  },
  { label: 'Pending (Unassigned)', value: '8',     sub: '3 urgent priority',     color: 'text-red-600'    },
  { label: 'Resolved Today',      value: '127',    sub: 'avg 4.2 min resolution', color: 'text-green-600'  },
  { label: 'Avg CSAT Score',      value: '4.6/5',  sub: '91% positive ratings',  color: 'text-blue-600'   },
  { label: 'Bot Handle Rate',     value: '68%',    sub: '32% escalated to human', color: 'text-purple-600' },
  { label: 'Avg Response Time',   value: '1m 42s', sub: 'SLA: < 3 min',          color: 'text-indigo-600' },
  { label: 'Active Agents',       value: '6 / 9',  sub: '2 busy, 1 away',        color: 'text-teal-600'   },
];

const CONVERSATIONS = [
  { id: 'C-1001', customer: 'Anjali Mehta',   channel: 'web',      status: 'open',     priority: 'high',   agent: 'Priya S.',   preview: 'I need to reschedule my class...', time: '2m ago' },
  { id: 'C-1002', customer: 'Raj Patel',       channel: 'whatsapp', status: 'pending',  priority: 'normal', agent: '—',          preview: 'Can I get a refund?',              time: '5m ago' },
  { id: 'C-1003', customer: 'Emma Wilson',     channel: 'email',    status: 'open',     priority: 'urgent', agent: 'Dev K.',     preview: 'Payment failed twice now.',        time: '8m ago' },
  { id: 'C-1004', customer: 'Fatima Al-Sayed', channel: 'telegram', status: 'resolved', priority: 'low',    agent: 'Priya S.',   preview: 'Thanks for the help!',            time: '1h ago' },
  { id: 'C-1005', customer: 'Carlos Rivera',   channel: 'web',      status: 'snoozed',  priority: 'normal', agent: 'AI Bot',     preview: 'Looking for beginner classes.',    time: '2h ago' },
];

const AGENTS = [
  { id: 'AG-1', name: 'Priya Sharma',   role: 'supervisor', status: 'online', load: 3, max: 5, csat: 94 },
  { id: 'AG-2', name: 'Dev Kumar',      role: 'agent',      status: 'busy',   load: 5, max: 5, csat: 88 },
  { id: 'AG-3', name: 'Sara Johansson', role: 'agent',      status: 'online', load: 2, max: 5, csat: 91 },
  { id: 'AG-4', name: 'Arjun Nair',     role: 'agent',      status: 'away',   load: 1, max: 5, csat: 85 },
  { id: 'AG-5', name: 'Min-Ji Park',    role: 'agent',      status: 'offline',load: 0, max: 5, csat: 89 },
];

const BOTS = [
  { id: 'BOT-1', name: 'SohamYoga Assistant', type: 'rag',       status: 'active',   model: 'llama3',    turns: 20, temp: 0.7, threshold: 0.6, triggers: ['speak to human', 'cancel', 'refund'] },
  { id: 'BOT-2', name: 'Booking Helper',       type: 'llm',       status: 'inactive', model: 'mistral',   turns: 10, temp: 0.5, threshold: 0.7, triggers: ['payment issue'] },
  { id: 'BOT-3', name: 'FAQ Bot',              type: 'rule_based',status: 'active',   model: '—',         turns: 5,  temp: 0.0, threshold: 0.9, triggers: ['hours', 'location', 'pricing'] },
];

const CHANNELS = [
  { channel: 'Web Chat',  icon: '💬', status: 'active', today: 89, csat: 4.7, bot: true, note: 'Embedded widget (Chatwoot)' },
  { channel: 'WhatsApp',  icon: '📱', status: 'active', today: 34, csat: 4.5, bot: true, note: 'Meta Business API' },
  { channel: 'Telegram',  icon: '✈️', status: 'active', today: 12, csat: 4.6, bot: true, note: 'Telegram Bot API' },
  { channel: 'Email',     icon: '📧', status: 'active', today: 21, csat: 4.3, bot: false, note: 'IMAP/SMTP via Chatwoot inbox' },
  { channel: 'Voice',     icon: '🎤', status: 'inactive', today: 0, csat: 0, bot: false, note: 'LiveKit — not enabled' },
  { channel: 'Video',     icon: '🎥', status: 'inactive', today: 0, csat: 0, bot: false, note: 'LiveKit — not enabled' },
  { channel: 'SMS',       icon: '📩', status: 'inactive', today: 0, csat: 0, bot: false, note: 'Requires Twilio/MSG91' },
];

const STATUS_BADGE: Record<string, string> = {
  open:     'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  resolved: 'bg-gray-100 text-gray-600',
  snoozed:  'bg-blue-100 text-blue-700',
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  training: 'bg-purple-100 text-purple-700',
  online:   'bg-green-100 text-green-700',
  busy:     'bg-amber-100 text-amber-700',
  away:     'bg-blue-100 text-blue-700',
  offline:  'bg-gray-100 text-gray-600',
};

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-gray-50 text-gray-500',
  normal: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');

  const filteredConversations = CONVERSATIONS.filter(c =>
    (statusFilter === 'all'  || c.status  === statusFilter) &&
    (channelFilter === 'all' || c.channel === channelFilter)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Wave 14 · Chatwoot · Open WebUI · LangGraph · LlamaIndex · Qdrant · LiveKit · Novu
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
              + New Conversation
            </button>
            <button className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
              Configure Bot
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {KPI.map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Conversation volume by channel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Today — Conversations by Channel</h3>
              <div className="space-y-3">
                {CHANNELS.filter(c => c.today > 0).map(ch => (
                  <div key={ch.channel} className="flex items-center gap-3">
                    <span className="w-6">{ch.icon}</span>
                    <span className="text-sm text-gray-600 w-24">{ch.channel}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${(ch.today / 89) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-8 text-right">{ch.today}</span>
                    <span className="text-xs text-gray-400">⭐ {ch.csat.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture flowchart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Architecture — Message Flow</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm text-center">
                {[
                  { label: 'Customer', sub: 'Web / WhatsApp / Telegram / Email', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                  { label: 'Chat Widget', sub: 'Chatwoot SDK', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { label: 'AI Triage', sub: 'LangGraph + Ollama + RAG', color: 'bg-purple-50 border-purple-200 text-purple-800' },
                  { label: 'Human Agent', sub: 'Chatwoot Inbox', color: 'bg-green-50 border-green-200 text-green-800' },
                  { label: 'Notification', sub: 'Novu (push / email)', color: 'bg-rose-50 border-rose-200 text-rose-800' },
                ].map((node, i) => (
                  <div key={node.label} className="flex flex-col items-center gap-2">
                    <div className={`w-full border rounded-xl p-3 ${node.color}`}>
                      <p className="font-semibold">{node.label}</p>
                      <p className="text-xs mt-0.5 opacity-70">{node.sub}</p>
                    </div>
                    {i < 4 && <span className="text-gray-300 text-lg hidden md:block">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Conversations ── */}
        {activeTab === 'conversations' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Statuses</option>
                {['open','pending','resolved','snoozed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Channels</option>
                {['web','whatsapp','telegram','email'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['ID','Customer','Channel','Status','Priority','Agent','Preview','Time'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredConversations.map(c => (
                    <tr key={c.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.customer}</td>
                      <td className="px-4 py-3 text-gray-600">{c.channel}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[c.priority]}`}>{c.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.agent}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.preview}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{c.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Agents ── */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map(ag => (
              <div key={ag.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{ag.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{ag.role}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ag.status]}`}>{ag.status}</span>
                </div>
                {/* Load bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Chat load</span>
                    <span>{ag.load} / {ag.max}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-2 rounded-full transition-all ${ag.load === ag.max ? 'bg-red-400' : ag.load >= ag.max * 0.8 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${(ag.load / ag.max) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">CSAT</span>
                  <span className="font-semibold text-amber-600">{ag.csat}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Bots ── */}
        {activeTab === 'bots' && (
          <div className="space-y-4">
            {BOTS.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{bot.name}</p>
                    <p className="text-xs text-gray-500">Type: <span className="font-medium text-gray-700">{bot.type}</span> · Model: <span className="font-medium text-gray-700">{bot.model}</span></p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[bot.status]}`}>{bot.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div><p className="text-gray-500 text-xs">Max Turns</p><p className="font-semibold">{bot.turns}</p></div>
                  <div><p className="text-gray-500 text-xs">Temperature</p><p className="font-semibold">{bot.temp}</p></div>
                  <div><p className="text-gray-500 text-xs">Confidence Threshold</p><p className="font-semibold">{bot.threshold}</p></div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Handoff Triggers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bot.triggers.map(t => (
                      <span key={t} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Channels ── */}
        {activeTab === 'channels' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Channel','Status','Conversations Today','CSAT','AI Bot','Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {CHANNELS.map(ch => (
                  <tr key={ch.channel} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="mr-2">{ch.icon}</span>{ch.channel}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{ch.status}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{ch.today || '—'}</td>
                    <td className="px-4 py-3">{ch.csat ? `⭐ ${ch.csat.toFixed(1)}` : '—'}</td>
                    <td className="px-4 py-3">{ch.bot ? '✅' : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{ch.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Avg First Response', value: '1m 42s', color: 'text-green-600' },
                { label: 'Avg Resolution Time', value: '12m 08s', color: 'text-blue-600' },
                { label: 'Bot Resolution Rate', value: '68%', color: 'text-purple-600' },
                { label: 'CSAT (30 days)',       value: '4.6 / 5', color: 'text-amber-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Funnel: visitor → chat → resolved */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Chat Funnel — Last 7 Days</h3>
              <div className="space-y-2">
                {[
                  { step: 'Widget shown',        count: 3200, pct: 100 },
                  { step: 'Chat opened',          count: 640,  pct: 20  },
                  { step: 'Bot responded',        count: 512,  pct: 16  },
                  { step: 'Human assigned',       count: 163,  pct: 5.1 },
                  { step: 'Conversation resolved',count: 140,  pct: 4.4 },
                  { step: 'CSAT submitted',       count: 89,   pct: 2.8 },
                ].map(f => (
                  <div key={f.step} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-44 flex-shrink-0">{f.step}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-amber-400 h-3 rounded-full" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-16 text-right">{f.count.toLocaleString()}</span>
                    <span className="text-gray-400 w-12 text-right text-xs">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CSAT distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">CSAT Distribution</h3>
              <div className="space-y-2">
                {[
                  { score: '⭐⭐⭐⭐⭐ (5)', pct: 74 },
                  { score: '⭐⭐⭐⭐ (4)',  pct: 17 },
                  { score: '⭐⭐⭐ (3)',    pct: 5  },
                  { score: '⭐⭐ (2)',      pct: 2  },
                  { score: '⭐ (1)',        pct: 2  },
                ].map(s => (
                  <div key={s.score} className="flex items-center gap-3 text-sm">
                    <span className="w-36 text-gray-600 flex-shrink-0">{s.score}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${s.pct > 50 ? 'bg-green-400' : s.pct > 10 ? 'bg-amber-300' : 'bg-red-400'}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-gray-500 w-10 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            {/* MCP Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">MCP Tool Registry — 13 Tools</h3>
              <div className="space-y-2">
                {[
                  { name: 'get_conversations',     tier: 'auto',              desc: 'List open conversations' },
                  { name: 'get_bot_status',         tier: 'auto',              desc: 'Active bot name, type, status' },
                  { name: 'get_conversation',       tier: 'staff',             desc: 'Full conversation detail' },
                  { name: 'send_message',           tier: 'staff',             desc: 'Send message as agent or bot' },
                  { name: 'assign_agent',           tier: 'staff',             desc: 'Assign / transfer conversation' },
                  { name: 'resolve_conversation',   tier: 'staff',             desc: 'Mark conversation resolved' },
                  { name: 'get_agent_stats',        tier: 'staff',             desc: 'Agent load and CSAT' },
                  { name: 'opt_out_chat_history',   tier: 'customer_confirm',  desc: 'Delete own chat history [OPT_OUT]' },
                  { name: 'get_conversation_pii',   tier: 'staff_approval',    desc: 'Access PII — audit-logged' },
                  { name: 'export_conversation',    tier: 'staff_approval',    desc: 'Export transcript for compliance' },
                  { name: 'update_bot_config',      tier: 'admin',             desc: 'Update prompt, model, temperature' },
                  { name: 'get_chat_analytics',     tier: 'admin',             desc: 'CSAT, resolution times, funnel' },
                  { name: 'delete_conversation_data', tier: 'admin_destructive', desc: 'Permanent delete [GDPR]' },
                ].map(t => {
                  const tierColor: Record<string, string> = {
                    auto:              'bg-gray-100 text-gray-600',
                    staff:             'bg-blue-100 text-blue-700',
                    customer_confirm:  'bg-yellow-100 text-yellow-700',
                    staff_approval:    'bg-orange-100 text-orange-700',
                    admin:             'bg-purple-100 text-purple-700',
                    admin_destructive: 'bg-red-100 text-red-700',
                  };
                  return (
                    <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <code className="text-xs font-mono text-gray-800 w-52 flex-shrink-0">{t.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tierColor[t.tier]}`}>{t.tier}</span>
                      <span className="text-xs text-gray-500">{t.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* External systems */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Open-Source Stack</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { layer: 'Customer Messaging', tool: 'Chatwoot',          note: 'multi-channel inbox' },
                    { layer: 'AI Chat Interface',  tool: 'Open WebUI + Ollama', note: 'local LLM' },
                    { layer: 'Agent Workflow',     tool: 'LangGraph',          note: 'state machine' },
                    { layer: 'Knowledge Search',   tool: 'LlamaIndex + Qdrant',note: 'RAG' },
                    { layer: 'Voice / Video',      tool: 'LiveKit',            note: 'WebRTC' },
                    { layer: 'Notifications',      tool: 'Novu',               note: 'push + email' },
                    { layer: 'Chat Analytics',     tool: 'PostHog',            note: 'events + funnels' },
                    { layer: 'Automation',         tool: 'Activepieces',       note: 'no-code flows' },
                  ].map(s => (
                    <div key={s.layer} className="flex items-start gap-2">
                      <span className="text-gray-500 w-36 flex-shrink-0">{s.layer}</span>
                      <span className="font-medium text-gray-800">{s.tool}</span>
                      <span className="text-gray-400">· {s.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">DB Tables</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['chat_conversation','chat_message','chat_agent','chat_bot','chat_handoff','chat_knowledge_base','chat_notification','chat_audit'].map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">DB Views</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['v_conversation_summary','v_agent_stats','v_chat_volume'].map(v => (
                    <span key={v} className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
