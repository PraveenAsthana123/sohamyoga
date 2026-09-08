'use client';
import { useEffect, useState } from 'react';

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

// Real schema exists (chat_conversation, chat_message, chat_agent, chat_bot)
// but this page previously rendered a hardcoded "Mock data" block with
// fictional customers/agents/KPIs even though every real table has zero
// rows. Every tab below now reads real data -- an honest empty state until
// real chat traffic exists, never a fabricated number. The Channels tab's
// per-channel note text and the Integrations tab's MCP tool list/stack
// reference describe real intended architecture (verified against
// ChatMcpRegistry.ts, which has exactly these 13 tools), not live metrics.

const REAL_CHANNELS = [
  { channel: 'web',      label: 'Web Chat', icon: '💬', note: 'Embedded widget (Chatwoot)' },
  { channel: 'whatsapp', label: 'WhatsApp', icon: '📱', note: 'Meta Business API -- needs credentials' },
  { channel: 'telegram', label: 'Telegram', icon: '✈️', note: 'Telegram Bot API' },
  { channel: 'email',    label: 'Email',    icon: '📧', note: 'IMAP/SMTP via Chatwoot inbox' },
  { channel: 'voice',    label: 'Voice',    icon: '🎤', note: 'LiveKit -- not enabled' },
  { channel: 'video',    label: 'Video',    icon: '🎥', note: 'LiveKit -- not enabled' },
  { channel: 'sms',      label: 'SMS',      icon: '📩', note: 'Requires Twilio/MSG91' },
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

interface Overview {
  openConversations: number; pendingUnassigned: number; resolvedConversations: number; snoozedConversations: number;
  agentsOnline: number; totalAgents: number; botsActive: number; totalBots: number;
}
interface Conversation {
  id: string; customerId: string; channel: string; status: string; priority: string; subject: string | null;
  agent: string | null; messageCount: number; lastActivityAt: string; lastMessage: string | null;
}
interface Agent { id: string; name: string; role: string; status: string; currentLoad: number; maxConcurrent: number; csat: number | null }
interface Bot { id: string; name: string; type: string; status: string; model: string | null; maxTurns: number; temperature: number; handoffTriggers: string[] }

function useJson<T>(url: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => { fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setData); }, [url]);
  return data;
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{message}</p>;
}

export default function ChatAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');

  const overview = useJson<Overview>('/api/admin/chat/overview');
  const conversationsData = useJson<{ conversations: Conversation[] }>('/api/admin/chat/conversations');
  const agentsData = useJson<{ agents: Agent[] }>('/api/admin/chat/agents');
  const botsData = useJson<{ bots: Bot[] }>('/api/admin/chat/bots');

  const conversations = conversationsData?.conversations ?? [];
  const agents = agentsData?.agents ?? [];
  const bots = botsData?.bots ?? [];

  const filteredConversations = conversations.filter(c =>
    (statusFilter === 'all'  || c.status  === statusFilter) &&
    (channelFilter === 'all' || c.channel === channelFilter)
  );

  const channelCounts = REAL_CHANNELS.map(ch => ({
    ...ch,
    count: conversations.filter(c => c.channel === ch.channel).length,
  }));

  const kpis = overview ? [
    { label: 'Open Conversations',   value: String(overview.openConversations),   color: 'text-amber-600'  },
    { label: 'Pending (Unassigned)', value: String(overview.pendingUnassigned),    color: 'text-red-600'    },
    { label: 'Resolved',             value: String(overview.resolvedConversations),color: 'text-green-600' },
    { label: 'Snoozed',              value: String(overview.snoozedConversations), color: 'text-blue-600'  },
    { label: 'Agents Online',        value: `${overview.agentsOnline} / ${overview.totalAgents}`, color: 'text-teal-600' },
    { label: 'Bots Active',          value: `${overview.botsActive} / ${overview.totalBots}`,     color: 'text-purple-600' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real chat_conversation/chat_agent/chat_bot data -- Chatwoot · Open WebUI · LangGraph · LlamaIndex · Qdrant · LiveKit · Novu
            </p>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {overview ? kpis.map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                </div>
              )) : <p className="text-sm text-gray-400 col-span-full">Loading…</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Conversations by Channel</h3>
              {conversations.length === 0
                ? <EmptyState message="No real conversations recorded yet -- this will populate once a customer message lands in chat_conversation." />
                : (
                  <div className="space-y-3">
                    {channelCounts.filter(c => c.count > 0).map(ch => (
                      <div key={ch.channel} className="flex items-center gap-3">
                        <span className="w-6">{ch.icon}</span>
                        <span className="text-sm text-gray-600 w-24">{ch.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${(ch.count / conversations.length) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-8 text-right">{ch.count}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Statuses</option>
                {['open','pending','resolved','snoozed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Channels</option>
                {REAL_CHANNELS.map(c => <option key={c.channel} value={c.channel}>{c.label}</option>)}
              </select>
            </div>

            {filteredConversations.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <EmptyState message="No conversations yet." />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{['ID','Customer','Channel','Status','Priority','Agent','Last message','Last activity'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredConversations.map(c => (
                      <tr key={c.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.customerId}</td>
                        <td className="px-4 py-3 text-gray-600">{c.channel}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[c.priority]}`}>{c.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.agent ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.lastMessage ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.lastActivityAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Agents ── */}
        {activeTab === 'agents' && (
          agents.length === 0 ? <div className="bg-white rounded-xl shadow-sm border border-gray-100"><EmptyState message="No agents configured yet." /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(ag => (
              <div key={ag.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{ag.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{ag.role}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ag.status]}`}>{ag.status}</span>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Chat load</span>
                    <span>{ag.currentLoad} / {ag.maxConcurrent}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-2 rounded-full transition-all ${ag.currentLoad >= ag.maxConcurrent ? 'bg-red-400' : ag.currentLoad >= ag.maxConcurrent * 0.8 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(100, (ag.currentLoad / ag.maxConcurrent) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">CSAT</span>
                  <span className="font-semibold text-amber-600">{ag.csat !== null ? `${ag.csat}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          )
        )}

        {/* ── AI Bots ── */}
        {activeTab === 'bots' && (
          bots.length === 0 ? <div className="bg-white rounded-xl shadow-sm border border-gray-100"><EmptyState message="No bots configured yet." /></div> : (
          <div className="space-y-4">
            {bots.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{bot.name}</p>
                    <p className="text-xs text-gray-500">Type: <span className="font-medium text-gray-700">{bot.type}</span> · Model: <span className="font-medium text-gray-700">{bot.model ?? '—'}</span></p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[bot.status]}`}>{bot.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div><p className="text-gray-500 text-xs">Max Turns</p><p className="font-semibold">{bot.maxTurns}</p></div>
                  <div><p className="text-gray-500 text-xs">Temperature</p><p className="font-semibold">{bot.temperature}</p></div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Handoff Triggers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bot.handoffTriggers.map(t => (
                      <span key={t} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">{t}</span>
                    ))}
                    {!bot.handoffTriggers.length && <span className="text-xs text-gray-400">None configured.</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )
        )}

        {/* ── Channels ── */}
        {activeTab === 'channels' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Channel','Real Conversations','Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {channelCounts.map(ch => (
                  <tr key={ch.channel} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="mr-2">{ch.icon}</span>{ch.label}</td>
                    <td className="px-4 py-3 font-medium">{ch.count}</td>
                    <td className="px-4 py-3 text-gray-500">{ch.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <EmptyState message="No chat-specific analytics pipeline exists yet (funnel/CSAT-distribution tracking needs real conversation volume first). Real per-message CSAT/NPS/CES tracking already exists for the broader business at /admin/cx-dashboard." />
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            {/* MCP Tools -- verified against the real src/domain/chat/ChatMcpRegistry.ts */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Open-Source Stack (planned)</h3>
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
                <h3 className="font-semibold text-gray-900 mb-3">Real DB Tables</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['chat_conversation','chat_message','chat_agent','chat_bot','chat_handoff','chat_knowledge_base','chat_notification','chat_audit'].map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">Real DB Views</h3>
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
