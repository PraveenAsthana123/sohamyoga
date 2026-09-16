'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Command Center','Process Tracker','Stage Timeline','SLA Monitor','Process Analytics'] as const;
type Tab = typeof TABS[number];

interface ProcessInstance {
  id: number; process_type: string; reference_id: string; entity_name: string;
  current_stage: string; stages_completed: string[]; stages_remaining: string[];
  status: string; sla_hours: number; started_at: string; completed_at: string | null;
}
interface ProcessEvent {
  id: number; instance_id: number; stage: string; action: string; actor: string; notes: string; occurred_at: string;
}
interface SlaViolation {
  id: number; instance_id: number; process_type: string; stage: string;
  expected_by: string; actual: string; hours_overdue: number; entity_name: string; reference_id: string;
}
interface MetricRow {
  process_type: string; total: number; completed: number; active: number; avg_cycle_hours: number;
}

const PROCESS_COLORS: Record<string, string> = {
  'Procure-to-Pay': 'bg-blue-600',
  'Order-to-Cash': 'bg-green-600',
  'Record-to-Report': 'bg-purple-600',
  'Hire-to-Retire': 'bg-orange-500',
  'Lead-to-Cash': 'bg-teal-600',
  'Issue-to-Resolution': 'bg-red-600',
  'Idea-to-Product': 'bg-indigo-600',
  'Plan-to-Produce': 'bg-amber-600',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

export default function EnterpriseWorkflowsPage() {
  const [tab, setTab] = useState<Tab>('Command Center');
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [processTypes, setProcessTypes] = useState<string[]>([]);
  const [violations, setViolations] = useState<SlaViolation[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ProcessInstance | null>(null);
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const url = typeFilter ? `/api/admin/enterprise-workflows?process_type=${encodeURIComponent(typeFilter)}` : '/api/admin/enterprise-workflows';
    const [r, slaR, metR] = await Promise.all([
      fetch(url).catch(() => null),
      fetch('/api/admin/enterprise-workflows/sla').catch(() => null),
      fetch('/api/admin/enterprise-workflows/metrics').catch(() => null),
    ]);
    if (r?.ok) { const d = await r.json(); setInstances(d.instances || []); setProcessTypes(d.process_types || []); }
    if (slaR?.ok) { const d = await slaR.json(); setViolations(d.violations || []); }
    if (metR?.ok) { const d = await metR.json(); setMetrics(d.by_type || []); }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectInstance = async (inst: ProcessInstance) => {
    setSelectedInstance(inst);
    setTab('Stage Timeline');
    const r = await fetch(`/api/admin/enterprise-workflows/${inst.id}`).catch(() => null);
    if (r?.ok) { const d = await r.json(); setEvents(d.events || []); }
  };

  const runAnalysis = async () => {
    if (!analysisType) return;
    setAiLoading(true);
    setAnalysisResult('');
    const r = await fetch('/api/admin/enterprise-workflows/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process_type: analysisType }),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setAnalysisResult(d.analysis || ''); }
    setAiLoading(false);
  };

  const typeGroups = processTypes.reduce((acc, pt) => {
    const typeInstances = instances.filter(i => i.process_type === pt);
    acc[pt] = {
      active: typeInstances.filter(i => i.status === 'active').length,
      completed: typeInstances.filter(i => i.status === 'completed').length,
      total: typeInstances.length,
    };
    return acc;
  }, {} as Record<string, { active: number; completed: number; total: number }>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Enterprise Workflows</h1>
        <p className="text-slate-300 text-sm mt-0.5">P2P · O2C · R2R · H2R · L2C · I2R · I2P · P2P Production</p>
      </div>

      <div className="border-b bg-white px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {loading && <p className="text-gray-500 text-sm mb-4">Loading…</p>}

        {tab === 'Command Center' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Command Center — 8 Enterprise Processes</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="border-l-4 border-blue-500 bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Total Instances</p>
                <p className="text-2xl font-bold">{instances.length}</p>
              </div>
              <div className="border-l-4 border-green-500 bg-green-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-2xl font-bold">{instances.filter(i => i.status === 'active').length}</p>
              </div>
              <div className="border-l-4 border-teal-500 bg-teal-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{instances.filter(i => i.status === 'completed').length}</p>
              </div>
              <div className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">SLA Violations</p>
                <p className="text-2xl font-bold">{violations.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {processTypes.map(pt => {
                const g = typeGroups[pt] || { active: 0, completed: 0, total: 0 };
                const color = PROCESS_COLORS[pt] || 'bg-gray-600';
                return (
                  <div key={pt} className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => { setTypeFilter(pt); setTab('Process Tracker'); }}>
                    <div className={`px-4 py-2 ${color} text-white`}>
                      <h3 className="font-semibold text-sm">{pt}</h3>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Active</span>
                        <span className="font-semibold text-green-600">{g.active}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Completed</span>
                        <span className="font-semibold text-blue-600">{g.completed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold">{g.total}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'Process Tracker' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">Process Tracker</h2>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm ml-auto">
                <option value="">All Process Types</option>
                {processTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3">Reference</th>
                    <th className="text-left px-4 py-3">Entity</th>
                    <th className="text-left px-4 py-3">Process Type</th>
                    <th className="text-left px-4 py-3">Current Stage</th>
                    <th className="text-left px-4 py-3">Progress</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst, i) => {
                    const completed = safeArray(inst.stages_completed);
                    const remaining = safeArray(inst.stages_remaining);
                    const total = completed.length + 1 + remaining.length;
                    const progress = Math.round((completed.length / total) * 100);
                    return (
                      <tr key={inst.id} className={`cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        onClick={() => selectInstance(inst)}>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{inst.reference_id}</td>
                        <td className="px-4 py-3 font-medium">{inst.entity_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-white text-xs px-2 py-0.5 rounded ${PROCESS_COLORS[inst.process_type] || 'bg-gray-500'}`}>
                            {inst.process_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{inst.current_stage}</td>
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge label={inst.status} colorClass={STATUS_COLORS[inst.status] || 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(inst.started_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Stage Timeline' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Stage Timeline</h2>
            {!selectedInstance ? (
              <p className="text-gray-500 text-sm">Select an instance from Process Tracker.</p>
            ) : (
              <div>
                <div className="bg-white rounded-lg border p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-white text-xs px-2 py-0.5 rounded ${PROCESS_COLORS[selectedInstance.process_type] || 'bg-gray-500'}`}>
                      {selectedInstance.process_type}
                    </span>
                    <h3 className="font-semibold">{selectedInstance.entity_name || selectedInstance.reference_id}</h3>
                    <Badge label={selectedInstance.status} colorClass={STATUS_COLORS[selectedInstance.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {safeArray(selectedInstance.stages_completed).map(s => (
                      <span key={s} className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />{s}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-semibold">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />{selectedInstance.current_stage} (current)
                    </span>
                    {safeArray(selectedInstance.stages_remaining).map(s => (
                      <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />{s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-lg border">
                  <h3 className="font-semibold text-sm p-4 border-b">Event Log</h3>
                  {events.length === 0 ? (
                    <p className="p-4 text-gray-400 text-sm">No events recorded.</p>
                  ) : (
                    <div className="divide-y">
                      {events.map(ev => (
                        <div key={ev.id} className="px-4 py-3 flex gap-4">
                          <div className="text-xs text-gray-400 w-32 flex-shrink-0">{new Date(ev.occurred_at).toLocaleString()}</div>
                          <div>
                            <div className="text-sm font-medium">{ev.action}</div>
                            <div className="text-xs text-gray-500">Stage: {ev.stage} · Actor: {ev.actor || 'System'}</div>
                            {ev.notes && <div className="text-xs text-gray-400 mt-0.5">{ev.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'SLA Monitor' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">SLA Monitor</h2>
            {violations.length === 0 ? (
              <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">No SLA violations found.</div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3">Instance</th>
                      <th className="text-left px-4 py-3">Process Type</th>
                      <th className="text-left px-4 py-3">Stage</th>
                      <th className="text-left px-4 py-3">Expected By</th>
                      <th className="text-left px-4 py-3">Hours Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => (
                      <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50'}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{v.entity_name || v.reference_id || `#${v.instance_id}`}</div>
                          <div className="text-xs text-gray-400">{v.reference_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-white text-xs px-2 py-0.5 rounded ${PROCESS_COLORS[v.process_type] || 'bg-gray-500'}`}>
                            {v.process_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{v.stage}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(v.expected_by).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-red-600">{Number(v.hours_overdue).toFixed(1)}h</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'Process Analytics' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Process Analytics</h2>
            <div className="bg-white rounded-lg border overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3">Process Type</th>
                    <th className="text-left px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Active</th>
                    <th className="text-left px-4 py-3">Completed</th>
                    <th className="text-left px-4 py-3">Avg Cycle (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m, i) => (
                    <tr key={m.process_type} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <span className={`text-white text-xs px-2 py-0.5 rounded ${PROCESS_COLORS[m.process_type] || 'bg-gray-500'}`}>
                          {m.process_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{m.total}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{m.active}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{m.completed}</td>
                      <td className="px-4 py-3 text-gray-600">{m.avg_cycle_hours || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">AI Process Analysis</h3>
              <div className="flex gap-3 mb-3">
                <select value={analysisType} onChange={e => setAnalysisType(e.target.value)} className="border rounded px-3 py-2 text-sm flex-1">
                  <option value="">Select process type…</option>
                  {processTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
                <button onClick={runAnalysis} disabled={aiLoading || !analysisType}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {aiLoading ? 'Analyzing…' : 'Run Analysis'}
                </button>
              </div>
              {analysisResult ? (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{analysisResult}</pre>
              ) : (
                <p className="text-gray-400 text-sm">Select a process type and click Run Analysis for Ollama-powered insights.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
