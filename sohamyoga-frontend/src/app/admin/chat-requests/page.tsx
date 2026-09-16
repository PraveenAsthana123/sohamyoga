'use client';

import { useState, useEffect, useCallback } from 'react';

interface Conversation {
  id: string;
  customer_id: string;
  channel: string;
  status: string;
  priority: string;
  subject: string | null;
  message_count: number;
  last_activity_at: string;
  opened_at: string;
  resolved_at: string | null;
  agent_name: string | null;
}

interface Handoff {
  id: string;
  conversation_id: string;
  reason: string;
  confidence: number | null;
  created_at: string;
  agent_name: string | null;
}

interface Kpi {
  live: number;
  waiting: number;
  resolved_today: number;
  handoffs_today: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  resolved: 'bg-gray-100 text-gray-600',
  snoozed: 'bg-blue-100 text-blue-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-100 text-blue-700',
};

const TABS = ['Live', 'All Conversations', 'Handoffs', 'Analytics'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ChatRequestsPage() {
  const [tab, setTab] = useState<Tab>('Live');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/chat-requests', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setHandoffs(data.handoffs ?? []);
      setKpi(data.kpi ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch('/api/admin/chat-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update conversation');
    } finally {
      setUpdating(null);
    }
  }, [load]);

  const displayed = conversations.filter(c => {
    if (tab === 'Live') return c.status === 'open' || c.status === 'pending';
    return true;
  }).filter(c =>
    !search || c.customer_id.toLowerCase().includes(search.toLowerCase()) ||
    (c.subject ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Chat Requests</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time conversation tracking from chat_conversation + chat_handoff.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Live Sessions" value={kpi.live} sub="open or pending" />
          <KpiCard label="Waiting" value={kpi.waiting} sub="no agent yet" />
          <KpiCard label="Resolved Today" value={kpi.resolved_today} />
          <KpiCard label="Handoffs Today" value={kpi.handoffs_today} sub="bot-to-agent" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Handoffs' ? (
          <div className="overflow-x-auto">
            {handoffs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No handoffs recorded today.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Conversation</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {handoffs.map(h => (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{h.conversation_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{h.reason}</td>
                      <td className="px-4 py-3 text-gray-600">{h.agent_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {h.confidence != null ? (
                          <span className={`text-xs font-medium ${Number(h.confidence) < 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                            {(Number(h.confidence) * 100).toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(h.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : tab === 'Analytics' ? (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Conversation Status Breakdown</h3>
            {(() => {
              const counts: Record<string, number> = {};
              for (const c of conversations) counts[c.status] = (counts[c.status] ?? 0) + 1;
              const total = conversations.length;
              return Object.entries(counts).map(([s, n]) => (
                <div key={s} className="flex items-center gap-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm text-gray-700 w-8 text-right">{n}</span>
                </div>
              ));
            })()}
            {conversations.length === 0 && <p className="text-gray-400 text-sm">No conversation data yet.</p>}
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-50">
              <input
                type="text"
                placeholder="Search by customer ID or subject..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : displayed.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No conversations found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">Conversation</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Messages</th>
                      <th className="px-4 py-3 font-medium">Agent</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-xs font-mono">{c.id.slice(0, 8)}…</p>
                          <p className="text-xs text-gray-400">{c.subject ?? c.customer_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{c.channel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[c.priority] ?? 'bg-gray-100 text-gray-600'}`}>{c.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-center">{c.message_count}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{c.agent_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.opened_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {c.status !== 'resolved' ? (
                            <button
                              disabled={updating === c.id}
                              onClick={() => updateStatus(c.id, 'resolved')}
                              className="text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                            >
                              {updating === c.id ? '...' : 'Resolve'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
