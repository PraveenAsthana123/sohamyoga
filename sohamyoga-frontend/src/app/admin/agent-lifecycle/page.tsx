'use client';

import { useState, useEffect, useCallback } from 'react';

interface Agent {
  agent_id: string; name: string; lifecycle_stage: string;
  days_in_stage: number; next_transition: string; owner: string;
}
interface Version {
  id: number; agent_id: string; version: string;
  release_date: string; changes_summary: string; status: string;
}
interface HealthCheck {
  id: number; agent_id: string; agent_name: string; check_type: string;
  last_run: string; result: string; next_scheduled: string;
}
interface Retirement {
  id: number; agent_id: string; agent_name: string; reason: string;
  flagged_by: string; flagged_at: string; retirement_date: string; status: string;
}
interface Changelog {
  id: number; agent_id: string; agent_name: string; change_type: string;
  description: string; author: string; changed_at: string;
}
interface Stats { active: number; deprecated: number; avgAgeDays: number; upgradesPending: number; }

type Tab = 'lifecycle' | 'versions' | 'health' | 'retirement' | 'changelog';

const STAGE_COLOR: Record<string, string> = {
  Prototype:   'bg-gray-100 text-gray-700',
  Testing:     'bg-yellow-100 text-yellow-700',
  Staging:     'bg-blue-100 text-blue-700',
  Production:  'bg-green-100 text-green-700',
  Maintenance: 'bg-orange-100 text-orange-700',
  Deprecated:  'bg-red-100 text-red-600',
  Retired:     'bg-gray-200 text-gray-500',
};
const HEALTH_COLOR: Record<string, string> = {
  pass:    'bg-green-100 text-green-700',
  fail:    'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-700',
};
const CHANGE_ICON: Record<string, string> = {
  upgrade: '⬆️', update: '✏️', created: '🆕', stage_move: '➡️',
  deprecated: '⚠️', health: '🩺', retirement: '🔔',
};

export default function AgentLifecyclePage() {
  const [tab, setTab] = useState<Tab>('lifecycle');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [retirement, setRetirement] = useState<Retirement[]>([]);
  const [changelog, setChangelog] = useState<Changelog[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, deprecated: 0, avgAgeDays: 0, upgradesPending: 0 });
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-lifecycle');
      if (!res.ok) return;
      const d = await res.json();
      setAgents(d.agents || []);
      setVersions(d.versions || []);
      setHealthChecks(d.healthChecks || []);
      setRetirement(d.retirement || []);
      setChangelog(d.changelog || []);
      setStats(d.stats || {});
      if (!selectedAgent && d.agents?.length) setSelectedAgent(d.agents[0].agent_id);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cancelRetirement = async (id: number) => {
    await fetch('/api/admin/agent-lifecycle', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cancel_retirement', id }),
    });
    fetchData();
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'lifecycle', label: 'Lifecycle Map' },
    { key: 'versions', label: 'Versions' },
    { key: 'health', label: 'Health Checks' },
    { key: 'retirement', label: 'Retirement Queue' },
    { key: 'changelog', label: 'Changelog' },
  ];

  const agentVersions = versions.filter(v => v.agent_id === selectedAgent);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Lifecycle</h1>
        <p className="text-gray-500 text-sm mt-1">Track stages, versions, health and retirement across all agents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Agents', value: stats.active, color: 'text-green-600' },
          { label: 'Deprecated', value: stats.deprecated, color: 'text-red-500' },
          { label: 'Avg Age (days)', value: stats.avgAgeDays, color: 'text-blue-600' },
          { label: 'Upgrades Pending', value: stats.upgradesPending, color: 'text-amber-600' },
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
          </button>
        ))}
      </div>

      {/* Lifecycle Map */}
      {tab === 'lifecycle' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Agent Lifecycle Map</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Agent','Stage','Days in Stage','Next Transition','Owner'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map(a => (
                <tr key={a.agent_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.agent_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLOR[a.lifecycle_stage] || 'bg-gray-100 text-gray-600'}`}>
                      {a.lifecycle_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.days_in_stage}d</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{a.next_transition || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Versions */}
      {tab === 'versions' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {agents.map(a => (
              <button key={a.agent_id} onClick={() => setSelectedAgent(a.agent_id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedAgent === a.agent_id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {a.name}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800">
                Versions: {agents.find(a => a.agent_id === selectedAgent)?.name || selectedAgent}
              </h2>
            </div>
            {agentVersions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">No version history recorded for this agent.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Version','Release Date','Changes','Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agentVersions.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{v.version}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(v.release_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-sm">{v.changes_summary}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Health Checks */}
      {tab === 'health' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Health Checks</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Agent','Check Type','Last Run','Result','Next Scheduled'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {healthChecks.map(hc => (
                <tr key={hc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{hc.agent_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{hc.check_type}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(hc.last_run).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${HEALTH_COLOR[hc.result] || 'bg-gray-100 text-gray-600'}`}>
                      {hc.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(hc.next_scheduled).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retirement Queue */}
      {tab === 'retirement' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Retirement Queue</h2>
          </div>
          {retirement.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No agents in retirement queue.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Agent','Reason','Flagged By','Flagged At','Retirement Date',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retirement.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.agent_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{r.reason}</td>
                    <td className="px-4 py-3 text-gray-600">{r.flagged_by}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.flagged_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-amber-700 font-medium">
                      {r.retirement_date ? new Date(r.retirement_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => cancelRetirement(r.id)}
                        className="text-xs px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors">
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Changelog */}
      {tab === 'changelog' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Changelog</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {changelog.map(c => (
              <div key={c.id} className="px-5 py-4 flex items-start gap-3">
                <span className="text-xl">{CHANGE_ICON[c.change_type] || '📝'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800 text-sm">{c.agent_name}</span>
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{c.change_type}</span>
                    <span className="text-xs text-gray-400">{c.author}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(c.changed_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
