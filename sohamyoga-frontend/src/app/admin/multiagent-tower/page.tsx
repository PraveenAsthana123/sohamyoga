'use client';

import { useState, useEffect, useCallback } from 'react';

interface Swarm {
  swarm_id: string; name: string; goal: string; agents_count: number;
  status: string; coordinator_agent: string; progress_pct: number; started_at: string;
}
interface Message {
  id: number; msg_id: string; from_agent: string; to_agent: string;
  message_type: string; payload_preview: string; created_at: string;
}
interface Consensus {
  decision_id: string; swarm_id: string; question: string;
  votes_for: number; votes_against: number; result: string; decided_at: string;
}
interface Strategy {
  strategy_id: string; name: string; description: string;
  is_default: boolean; agent_count: number;
}
interface Stats { activeSwarms: number; agentsOnline: number; msgPerMin: number; consensusRate: number; }

type Tab = 'swarms' | 'messages' | 'consensus' | 'topology' | 'coordination';

const SWARM_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700', error: 'bg-red-100 text-red-600',
};
const MSG_TYPE_COLOR: Record<string, string> = {
  task: 'bg-blue-100 text-blue-700', result: 'bg-green-100 text-green-700',
  query: 'bg-purple-100 text-purple-700', vote: 'bg-amber-100 text-amber-700',
  heartbeat: 'bg-gray-100 text-gray-600',
};

function KpiCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}{unit && <span className="text-lg ml-1 font-normal text-gray-500">{unit}</span>}</p>
    </div>
  );
}

// Build topology from messages
function buildTopology(messages: Message[]): Record<string, Set<string>> {
  const topo: Record<string, Set<string>> = {};
  for (const m of messages) {
    if (m.to_agent === 'BROADCAST') continue;
    if (!topo[m.from_agent]) topo[m.from_agent] = new Set();
    topo[m.from_agent].add(m.to_agent);
  }
  return topo;
}

export default function MultiagentTowerPage() {
  const [tab, setTab] = useState<Tab>('swarms');
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [consensus, setConsensus] = useState<Consensus[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [stats, setStats] = useState<Stats>({ activeSwarms: 0, agentsOnline: 0, msgPerMin: 0, consensusRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingDefault, setTogglingDefault] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/multiagent-tower', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setStats(d.stats); setSwarms(d.swarms); setMessages(d.messages);
      setConsensus(d.consensus); setStrategies(d.strategies);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateSwarmStatus = async (swarm_id: string, status: string) => {
    try {
      await fetch('/api/admin/multiagent-tower', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swarm_id, status }),
      });
      await load();
    } catch { /* ignore */ }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'swarms', label: 'Swarms' },
    { key: 'messages', label: 'Message Bus' },
    { key: 'consensus', label: 'Consensus Log' },
    { key: 'topology', label: 'Topology' },
    { key: 'coordination', label: 'Coordination' },
  ];

  const topology = buildTopology(messages);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Multi-Agent Control Tower</h1>
        <p className="text-gray-500 text-sm mt-1">Manage swarms, monitor inter-agent messaging, consensus decisions and coordination strategies</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Swarms" value={loading ? '...' : stats.activeSwarms} color="text-indigo-600" />
        <KpiCard label="Agents Online" value={loading ? '...' : stats.agentsOnline} color="text-green-600" />
        <KpiCard label="Messages/min" value={loading ? '...' : stats.msgPerMin} />
        <KpiCard label="Consensus Rate" value={loading ? '...' : stats.consensusRate} unit="%" color="text-blue-600" />
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Swarms */}
      {tab === 'swarms' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Swarm', 'Goal', 'Agents', 'Status', 'Coordinator', 'Progress', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {swarms.map(s => (
                <tr key={s.swarm_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{s.goal}</td>
                  <td className="px-4 py-3 text-center text-gray-700 font-semibold">{s.agents_count}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SWARM_STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{s.coordinator_agent}</td>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.progress_pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{s.progress_pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'active' && (
                      <button onClick={() => updateSwarmStatus(s.swarm_id, 'paused')}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium mr-2">Pause</button>
                    )}
                    {s.status === 'paused' && (
                      <button onClick={() => updateSwarmStatus(s.swarm_id, 'active')}
                        className="text-xs text-green-600 hover:text-green-700 font-medium mr-2">Resume</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Message Bus */}
      {tab === 'messages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Live Message Feed (last 15)</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {messages.map(m => (
              <div key={m.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">{m.msg_id}</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${MSG_TYPE_COLOR[m.message_type] ?? 'bg-gray-100 text-gray-600'}`}>{m.message_type}</span>
                  <span className="text-xs text-gray-500"><span className="font-medium text-gray-700">{m.from_agent}</span> → <span className="font-medium text-gray-700">{m.to_agent}</span></span>
                  <span className="text-xs text-gray-400 ml-auto">{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-gray-600 truncate">{m.payload_preview}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consensus Log */}
      {tab === 'consensus' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Decision', 'Swarm', 'Question', 'For', 'Against', 'Result', 'Decided'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consensus.map(d => (
                <tr key={d.decision_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.decision_id}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{d.swarm_id}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs text-xs">{d.question}</td>
                  <td className="px-4 py-3 text-green-600 font-semibold">{d.votes_for}</td>
                  <td className="px-4 py-3 text-red-500 font-semibold">{d.votes_against}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${d.result === 'approved' ? 'bg-green-100 text-green-700' : d.result.includes('tie') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{d.result}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(d.decided_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Topology */}
      {tab === 'topology' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Agent Adjacency List</h3>
          <div className="space-y-3">
            {Object.entries(topology).map(([agent, connections]) => (
              <div key={agent} className="flex items-start gap-3">
                <span className="font-mono text-sm font-semibold text-indigo-700 w-40 flex-shrink-0">{agent}</span>
                <span className="text-gray-500 flex-shrink-0">→</span>
                <div className="flex gap-2 flex-wrap">
                  {Array.from(connections).map(c => (
                    <span key={c} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">{c}</span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(topology).length === 0 && (
              <p className="text-gray-400 text-sm">No direct agent connections recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Coordination */}
      {tab === 'coordination' && (
        <div className="space-y-4">
          {strategies.map(s => (
            <div key={s.strategy_id} className={`bg-white rounded-xl border p-5 shadow-sm ${s.is_default ? 'border-indigo-300' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-800">{s.name}</h4>
                    {s.is_default && <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">Default</span>}
                  </div>
                  <p className="text-sm text-gray-600">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-2">Agent count: {s.agent_count}</p>
                </div>
                <button
                  onClick={async () => {
                    setTogglingDefault(s.strategy_id);
                    try {
                      await fetch('/api/admin/multiagent-tower', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ swarm_id: s.strategy_id, status: 'default' }),
                      });
                    } catch { /* ignore */ }
                    finally { setTogglingDefault(null); }
                  }}
                  disabled={s.is_default || togglingDefault === s.strategy_id}
                  className={`ml-4 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${s.is_default ? 'bg-indigo-100 text-indigo-600 cursor-default' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} disabled:opacity-50`}>
                  {s.is_default ? 'Active' : 'Set Default'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
