'use client';

import { useState, useEffect, useCallback } from 'react';

interface Channel {
  channel_id: string; name: string; channel_type: string; protocol: string;
  status: string; msg_rate_min: number; subscribers: number;
}
interface Message {
  id: number; msg_id: string; channel_name: string; from_agent: string;
  to_agent: string; message_type: string; delivery_status: string;
  latency_ms: number; created_at: string;
}
interface Protocol {
  protocol_id: string; name: string; transport: string; serialization: string;
  auth_required: boolean; encryption: boolean; max_msg_size_kb: number;
}
interface RoutingRule {
  rule_id: string; pattern: string; target_channel: string;
  priority: number; is_active: boolean;
}
interface DLQEntry {
  id: number; msg_id: string; channel_name: string; from_agent: string;
  to_agent: string; failure_reason: string; failed_at: string;
  requeue_count: number; status: string;
}
interface Stats { channels: number; messagesToday: number; avgDeliveryMs: number; failedDeliveries: number; }

type Tab = 'channels' | 'messages' | 'protocols' | 'routing' | 'dlq';

const CHANNEL_TYPE_COLOR: Record<string, string> = {
  pub_sub:   'bg-purple-100 text-purple-700',
  queue:     'bg-blue-100 text-blue-700',
  rpc:       'bg-green-100 text-green-700',
  broadcast: 'bg-orange-100 text-orange-700',
  stream:    'bg-indigo-100 text-indigo-700',
};
const DELIVERY_COLOR: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-600',
  pending:   'bg-gray-100 text-gray-600',
};
const MSG_TYPE_COLOR: Record<string, string> = {
  task:      'bg-blue-100 text-blue-700',
  result:    'bg-green-100 text-green-700',
  query:     'bg-purple-100 text-purple-700',
  vote:      'bg-amber-100 text-amber-700',
  heartbeat: 'bg-gray-100 text-gray-600',
  event:     'bg-indigo-100 text-indigo-700',
};

export default function AgentCommunicationPage() {
  const [tab, setTab] = useState<Tab>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [dlq, setDlq] = useState<DLQEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ channels: 0, messagesToday: 0, avgDeliveryMs: 0, failedDeliveries: 0 });
  const [loading, setLoading] = useState(true);
  const [requeueing, setRequeueing] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-communication');
      if (!res.ok) return;
      const d = await res.json();
      setChannels(d.channels || []);
      setMessages(d.messages || []);
      setProtocols(d.protocols || []);
      setRoutingRules(d.routingRules || []);
      setDlq(d.dlq || []);
      setStats(d.stats || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const requeue = async (id: number) => {
    setRequeueing(id);
    await fetch('/api/admin/agent-communication', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'requeue', id }),
    });
    await fetchData();
    setRequeueing(null);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'channels', label: 'Channels' },
    { key: 'messages', label: 'Message Log' },
    { key: 'protocols', label: 'Protocols' },
    { key: 'routing', label: 'Routing Rules' },
    { key: 'dlq', label: 'Dead Letter Queue' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Communication</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor channels, message flows, protocols and dead-letter queue</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Channels', value: stats.channels, color: 'text-indigo-600' },
          { label: 'Messages Today', value: stats.messagesToday, color: 'text-green-600' },
          { label: 'Avg Delivery (ms)', value: stats.avgDeliveryMs, color: 'text-blue-600' },
          { label: 'Failed Deliveries', value: stats.failedDeliveries, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
            {t.key === 'dlq' && dlq.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white rounded-full text-xs">{dlq.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Channels */}
      {tab === 'channels' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Communication Channels</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Channel','Type','Protocol','Status','Msg Rate/min','Subscribers'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map(ch => (
                <tr key={ch.channel_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{ch.name}</div>
                    <div className="text-xs text-gray-400">{ch.channel_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_TYPE_COLOR[ch.channel_type] || 'bg-gray-100 text-gray-600'}`}>
                      {ch.channel_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{ch.protocol}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ch.msg_rate_min}/min</td>
                  <td className="px-4 py-3 text-gray-700">{ch.subscribers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Message Log */}
      {tab === 'messages' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Message Log</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Msg ID','Channel','From','To','Type','Status','Latency','Timestamp'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.msg_id}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{m.channel_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{m.from_agent}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{m.to_agent}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${MSG_TYPE_COLOR[m.message_type] || 'bg-gray-100 text-gray-600'}`}>
                      {m.message_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${DELIVERY_COLOR[m.delivery_status] || 'bg-gray-100 text-gray-600'}`}>
                      {m.delivery_status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs ${m.latency_ms > 500 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {m.latency_ms}ms
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(m.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Protocols */}
      {tab === 'protocols' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Communication Protocols</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Protocol','Transport','Serialization','Auth Required','Encryption','Max Msg Size'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {protocols.map(p => (
                <tr key={p.protocol_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.transport}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.serialization}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.auth_required ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.encryption ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.max_msg_size_kb} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Routing Rules */}
      {tab === 'routing' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Routing Rules</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Rule ID','Pattern','Target Channel','Priority','Active'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {routingRules.map(r => (
                <tr key={r.rule_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.rule_id}</td>
                  <td className="px-4 py-3 font-mono text-sm text-indigo-700">{r.pattern}</td>
                  <td className="px-4 py-3 text-gray-700">{r.target_channel}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.priority >= 9 ? 'bg-red-100 text-red-700' : r.priority >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      P{r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dead Letter Queue */}
      {tab === 'dlq' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Dead Letter Queue</h2>
          </div>
          {dlq.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">Dead letter queue is empty.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Msg ID','Channel','From','To','Failure Reason','Failed At','Retries',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dlq.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.msg_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.channel_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{d.from_agent}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{d.to_agent}</td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-xs">{d.failure_reason}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(d.failed_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{d.requeue_count}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => requeue(d.id)} disabled={requeueing === d.id}
                        className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50">
                        {requeueing === d.id ? '...' : 'Requeue'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
