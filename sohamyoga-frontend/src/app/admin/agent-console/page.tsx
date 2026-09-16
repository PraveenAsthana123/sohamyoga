'use client';

import { useEffect, useState, useCallback } from 'react';

interface Agent {
  id: string; user_id: string; display_name: string; role: string; status: string;
  max_concurrent_chats: number; skill_tags: string[]; avg_response_time_secs: number | null;
  satisfaction_score: number | null; shift_start: string | null; shift_end: string | null;
  created_at: string;
}
interface Conversation {
  id: string; customer_id: string; channel: string; status: string; priority: string;
  subject: string | null; message_count: number; last_activity_at: string; opened_at: string;
  assigned_agent_id: string | null; assigned_bot_id: string | null;
}
interface Bot {
  id: string; name: string; bot_type: string; status: string; model: string | null;
  max_turns: number; temperature: string; confidence_threshold: string;
  response_timeout_ms: number; created_at: string; updated_at: string;
}
interface Summary {
  activeAgents: number; totalConversations: number; openConversations: number; botsConfigured: number;
}

type Tab = 'overview' | 'agents' | 'conversations' | 'bots' | 'configuration';

const AGENT_STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-100 text-green-700', busy: 'bg-amber-100 text-amber-700',
  away: 'bg-yellow-100 text-yellow-700', offline: 'bg-gray-100 text-gray-500',
};
const BOT_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500',
  maintenance: 'bg-amber-100 text-amber-700',
};
const CONV_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', open: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700', snoozed: 'bg-yellow-100 text-yellow-700',
};
const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-600', high: 'text-amber-600', normal: 'text-gray-600', low: 'text-gray-400',
};

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AgentConsolePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [summary, setSummary] = useState<Summary>({ activeAgents: 0, totalConversations: 0, openConversations: 0, botsConfigured: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/agent-console', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setAgents(d.agents ?? []);
      setConversations(d.conversations ?? []);
      setBots(d.bots ?? []);
      setSummary(d.summary ?? { activeAgents: 0, totalConversations: 0, openConversations: 0, botsConfigured: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agent console data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleAgentStatus(id: string, currentStatus: string) {
    const next = currentStatus === 'online' ? 'offline' : 'online';
    setToggling(id);
    await fetch('/api/admin/agent-console', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'agent', id, status: next }),
    });
    setToggling(null);
    load();
  }

  async function toggleBotStatus(id: string, currentStatus: string) {
    const next = currentStatus === 'active' ? 'inactive' : 'active';
    setToggling(id);
    await fetch('/api/admin/agent-console', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bot', id, status: next }),
    });
    setToggling(null);
    load();
  }

  const openConvs = conversations.filter(c => ['pending', 'open', 'snoozed'].includes(c.status));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'agents', label: `Agents (${agents.length})` },
    { key: 'conversations', label: `Conversations (${conversations.length})` },
    { key: 'bots', label: `Bots (${bots.length})` },
    { key: 'configuration', label: 'Configuration' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agent Console</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage human agents, AI bots, and live conversations</p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Active Agents" value={summary.activeAgents} color="text-green-700" sub="currently online" />
          <KpiCard label="Total Conversations" value={summary.totalConversations.toLocaleString()} />
          <KpiCard label="Open Conversations" value={summary.openConversations} color={summary.openConversations > 0 ? 'text-amber-600' : 'text-gray-900'} />
          <KpiCard label="Active Bots" value={summary.botsConfigured} sub="configured and running" />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-gray-400">Loading agent console…</p>}

        {!loading && tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">Agent Status Breakdown</h2>
                <div className="space-y-2">
                  {(['online', 'busy', 'away', 'offline'] as const).map(status => {
                    const count = agents.filter(a => a.status === status).length;
                    return (
                      <div key={status} className="flex justify-between items-center py-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_STATUS_COLOR[status]}`}>{status}</span>
                        <span className="text-sm font-semibold text-gray-800">{count} agent{count !== 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">Open Conversations</h2>
                {openConvs.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                    <div>
                      <span className={`text-xs font-medium ${PRIORITY_COLOR[c.priority] ?? 'text-gray-600'}`}>{c.priority}</span>
                      <span className="ml-2 text-xs text-gray-500">{c.channel}</span>
                      {c.subject && <span className="ml-2 text-xs text-gray-600">{c.subject}</span>}
                    </div>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${CONV_STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                  </div>
                ))}
                {!openConvs.length && <p className="text-sm text-gray-400">No open conversations.</p>}
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'agents' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Max Chats</th>
                  <th className="px-4 py-3">Avg Response</th>
                  <th className="px-4 py-3">CSAT</th>
                  <th className="px-4 py-3">Skills</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{a.display_name}</p>
                      <p className="text-xs text-gray-400">{a.user_id}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{a.role}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.max_concurrent_chats}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.avg_response_time_secs !== null ? `${a.avg_response_time_secs}s` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {a.satisfaction_score !== null ? (
                        <span className={`font-medium ${a.satisfaction_score >= 80 ? 'text-green-600' : a.satisfaction_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {a.satisfaction_score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.skill_tags.map(tag => (
                          <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                        {!a.skill_tags.length && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAgentStatus(a.id, a.status)} disabled={toggling === a.id}
                        className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                        {a.status === 'online' ? 'Set offline' : 'Set online'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!agents.length && <p className="text-center text-sm text-gray-400 py-8">No agents configured.</p>}
          </div>
        )}

        {!loading && tab === 'conversations' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Recent Conversations (last 50)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3">Subject / Customer</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Messages</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.subject ?? '(no subject)'}</p>
                        <p className="text-xs text-gray-400">{c.customer_id}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{c.channel.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONV_STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium capitalize ${PRIORITY_COLOR[c.priority] ?? 'text-gray-600'}`}>{c.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.message_count}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.last_activity_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.assigned_agent_id ? 'Agent' : c.assigned_bot_id ? 'Bot' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!conversations.length && <p className="text-center text-sm text-gray-400 py-8">No conversations found.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'bots' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bots.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{b.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.bot_type} · {b.model ?? 'no model'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BOT_STATUS_COLOR[b.status] ?? 'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="font-semibold text-gray-800">{b.max_turns}</p>
                    <p className="text-gray-500">Max turns</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="font-semibold text-gray-800">{b.temperature}</p>
                    <p className="text-gray-500">Temperature</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="font-semibold text-gray-800">{b.response_timeout_ms}ms</p>
                    <p className="text-gray-500">Timeout</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">Confidence threshold: {b.confidence_threshold}</p>
                  <button onClick={() => toggleBotStatus(b.id, b.status)} disabled={toggling === b.id}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                    {b.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
            {!bots.length && <p className="text-sm text-gray-400 text-center py-8 col-span-2">No bots configured.</p>}
          </div>
        )}

        {!loading && tab === 'configuration' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">System Configuration Summary</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Agent Capacity</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Agents</span>
                      <span className="font-medium">{agents.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Online Agents</span>
                      <span className="font-medium text-green-600">{agents.filter(a => a.status === 'online').length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Max Total Chats</span>
                      <span className="font-medium">{agents.filter(a => a.status === 'online').reduce((s, a) => s + a.max_concurrent_chats, 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Avg CSAT</span>
                      <span className="font-medium">
                        {agents.filter(a => a.satisfaction_score !== null).length > 0
                          ? `${Math.round(agents.filter(a => a.satisfaction_score !== null).reduce((s, a) => s + (a.satisfaction_score ?? 0), 0) / agents.filter(a => a.satisfaction_score !== null).length)}%`
                          : '—'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Bot Configuration</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Bots</span>
                      <span className="font-medium">{bots.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Active Bots</span>
                      <span className="font-medium text-green-600">{bots.filter(b => b.status === 'active').length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Inactive</span>
                      <span className="font-medium text-gray-500">{bots.filter(b => b.status === 'inactive').length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">In Maintenance</span>
                      <span className="font-medium text-amber-600">{bots.filter(b => b.status === 'maintenance').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Conversation Channels</h2>
              <div className="flex flex-wrap gap-3">
                {[...new Set(conversations.map(c => c.channel))].map(ch => {
                  const count = conversations.filter(c => c.channel === ch).length;
                  return (
                    <div key={ch} className="bg-gray-50 rounded-lg px-4 py-3 text-center min-w-[80px]">
                      <p className="text-xl font-bold text-gray-800">{count}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{ch.replace('_', ' ')}</p>
                    </div>
                  );
                })}
                {!conversations.length && <p className="text-sm text-gray-400">No conversation data.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
