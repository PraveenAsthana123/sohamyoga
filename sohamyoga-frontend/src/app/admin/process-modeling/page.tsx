'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Model Library', 'BPMN Editor', 'Swimlane Viewer', 'Decision Tables', 'Stakeholder Matrix'] as const;
type Tab = typeof TABS[number];
type ProcessType = 'BPMN' | 'Swimlane' | 'Decision' | 'all';

interface ProcessModel {
  id: number; name: string; type: string; department: string; version: string;
  description: string; xml_definition: string; swimlanes: unknown; status: string; created_at: string;
}
interface DecisionTable {
  id: number; process_id: number; name: string; conditions: unknown[]; rules: unknown[]; output_type: string; created_at: string;
}
interface Stakeholder {
  id: number; process_id: number; name: string; role: string; lane: string; responsibilities: string[]; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-600',
};
const TYPE_COLORS: Record<string, string> = {
  BPMN: 'bg-blue-100 text-blue-700',
  Swimlane: 'bg-purple-100 text-purple-700',
  Decision: 'bg-orange-100 text-orange-700',
};
const RACI_ROLES = ['Responsible','Accountable','Consulted','Informed'] as const;
const RACI_COLORS: Record<string, string> = {
  Responsible: 'bg-green-200 text-green-800',
  Accountable: 'bg-blue-200 text-blue-800',
  Consulted: 'bg-yellow-200 text-yellow-800',
  Informed: 'bg-gray-200 text-gray-700',
  Initiator: 'bg-purple-200 text-purple-800',
  Owner: 'bg-teal-200 text-teal-800',
  Reviewer: 'bg-orange-200 text-orange-800',
  Approver: 'bg-red-200 text-red-700',
  Coordinator: 'bg-indigo-200 text-indigo-800',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function KpiCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    orange: 'border-l-4 border-orange-500 bg-orange-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function ProcessModelingPage() {
  const [tab, setTab] = useState<Tab>('Model Library');
  const [models, setModels] = useState<ProcessModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ProcessModel | null>(null);
  const [decisions, setDecisions] = useState<DecisionTable[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [typeFilter, setTypeFilter] = useState<ProcessType>('all');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bpmnOutput, setBpmnOutput] = useState('');
  const [swimlaneData, setSwimlaneData] = useState<{ lanes: { name: string; department: string; tasks: string[]; handoffs: string[] }[] } | null>(null);
  const [aiDesc, setAiDesc] = useState('');

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const url = typeFilter !== 'all' ? `/api/admin/process-modeling?type=${typeFilter}` : '/api/admin/process-modeling';
    const r = await fetch(url).catch(() => null);
    if (r?.ok) { const d = await r.json(); setModels(d.models || []); }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const selectModel = async (m: ProcessModel) => {
    setSelectedModel(m);
    setBpmnOutput(m.xml_definition || '');
    if (m.swimlanes) setSwimlaneData(m.swimlanes as { lanes: { name: string; department: string; tasks: string[]; handoffs: string[] }[] });
    const r = await fetch(`/api/admin/process-modeling/${m.id}`).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setDecisions(d.decisions || []);
      setStakeholders(d.stakeholders || []);
    }
  };

  const generateBpmn = async () => {
    if (!selectedModel) return;
    setAiLoading(true);
    const r = await fetch(`/api/admin/process-modeling/${selectedModel.id}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: aiDesc }),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setBpmnOutput(d.bpmn || ''); }
    setAiLoading(false);
  };

  const generateSwimlane = async () => {
    if (!selectedModel) return;
    setAiLoading(true);
    const r = await fetch(`/api/admin/process-modeling/${selectedModel.id}/swimlane`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: aiDesc }),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setSwimlaneData(d.swimlanes); }
    setAiLoading(false);
  };

  const bpmnModels = models.filter(m => m.type === 'BPMN');
  const swimModels = models.filter(m => m.type === 'Swimlane');
  const decModels = models.filter(m => m.type === 'Decision');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Process Modeling</h1>
        <p className="text-slate-300 text-sm mt-0.5">BPMN Modeling · Swimlane Mapping · Decision Mapping</p>
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
        {tab === 'Model Library' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">Process Model Library</h2>
              <div className="ml-auto flex gap-2">
                {(['all','BPMN','Swimlane','Decision'] as ProcessType[]).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded text-sm ${typeFilter === t ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total Models" value={models.length} color="blue" />
              <KpiCard label="BPMN" value={bpmnModels.length} color="blue" />
              <KpiCard label="Swimlane" value={swimModels.length} color="purple" />
              <KpiCard label="Decision" value={decModels.length} color="orange" />
            </div>
            {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {models.map(m => (
                  <div key={m.id}
                    onClick={() => { selectModel(m); setTab('BPMN Editor'); }}
                    className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedModel?.id === m.id ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 text-sm">{m.name}</h3>
                      <Badge label={`v${m.version}`} colorClass="bg-gray-100 text-gray-600" />
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge label={m.type} colorClass={TYPE_COLORS[m.type] || 'bg-gray-100 text-gray-600'} />
                      <Badge label={m.status} colorClass={STATUS_COLORS[m.status] || STATUS_COLORS.draft} />
                    </div>
                    {m.department && <p className="text-xs text-gray-500 mb-1">{m.department}</p>}
                    {m.description && <p className="text-xs text-gray-400 line-clamp-2">{m.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'BPMN Editor' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">BPMN Editor</h2>
            {!selectedModel ? (
              <p className="text-gray-500 text-sm">Select a model from the Model Library to edit.</p>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-1 bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-sm mb-3">{selectedModel.name}</h3>
                  <div className="flex gap-2 mb-3">
                    <Badge label={selectedModel.type} colorClass={TYPE_COLORS[selectedModel.type] || 'bg-gray-100 text-gray-600'} />
                    <Badge label={selectedModel.status} colorClass={STATUS_COLORS[selectedModel.status] || STATUS_COLORS.draft} />
                  </div>
                  {selectedModel.department && <p className="text-xs text-gray-500 mb-2"><span className="font-medium">Dept:</span> {selectedModel.department}</p>}
                  {selectedModel.description && <p className="text-xs text-gray-400 mb-4">{selectedModel.description}</p>}
                  <label className="block text-xs font-medium text-gray-600 mb-1">AI Process Description</label>
                  <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)} rows={4}
                    placeholder="Describe the process in plain English for AI to generate BPMN…"
                    className="w-full text-xs border rounded px-2 py-1.5 mb-3 resize-none" />
                  <button onClick={generateBpmn} disabled={aiLoading}
                    className="w-full bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {aiLoading ? 'Generating…' : 'AI Generate BPMN'}
                  </button>
                </div>
                <div className="col-span-2 bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-sm mb-3">Process Flow</h3>
                  {bpmnOutput ? (
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border min-h-48">{bpmnOutput}</pre>
                  ) : (
                    <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm min-h-48 flex items-center justify-center">
                      No BPMN definition yet. Use AI Generate or select a model with existing content.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Swimlane Viewer' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Swimlane Viewer</h2>
            {!selectedModel ? (
              <p className="text-gray-500 text-sm">Select a model from the Model Library first.</p>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-semibold">{selectedModel.name}</h3>
                  <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)} rows={1}
                    placeholder="Describe process for swimlane generation…"
                    className="flex-1 text-xs border rounded px-2 py-1.5 resize-none" />
                  <button onClick={generateSwimlane} disabled={aiLoading}
                    className="bg-purple-600 text-white text-sm px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap">
                    {aiLoading ? 'Generating…' : 'AI Generate Swimlanes'}
                  </button>
                </div>
                {swimlaneData?.lanes ? (
                  <div className="space-y-3">
                    {swimlaneData.lanes.map((lane, i) => (
                      <div key={i} className="bg-white rounded-lg border overflow-hidden">
                        <div className={`px-4 py-2 font-semibold text-sm ${i % 2 === 0 ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                          {lane.name} — <span className="font-normal opacity-80">{lane.department}</span>
                        </div>
                        <div className="px-4 py-3 flex flex-wrap gap-2">
                          {lane.tasks?.map((task, j) => (
                            <span key={j} className="bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded border border-gray-200">{task}</span>
                          ))}
                        </div>
                        {lane.handoffs?.length > 0 && (
                          <div className="px-4 pb-2 text-xs text-gray-400">
                            {lane.handoffs.join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">
                    No swimlane data yet. Click AI Generate Swimlanes.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'Decision Tables' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Decision Tables</h2>
            {!selectedModel ? (
              <p className="text-gray-500 text-sm">Select a model from the Model Library first.</p>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-4">Decision tables for: <span className="font-medium">{selectedModel.name}</span></p>
                {decisions.length === 0 ? (
                  <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">No decision tables yet for this process.</div>
                ) : (
                  <div className="space-y-4">
                    {decisions.map(dt => (
                      <div key={dt.id} className="bg-white rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">{dt.name}</h3>
                          <Badge label={dt.output_type} colorClass="bg-gray-100 text-gray-600" />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="text-left px-3 py-2 border-b">Conditions</th>
                                <th className="text-left px-3 py-2 border-b">Rules</th>
                                <th className="text-left px-3 py-2 border-b">Output</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(dt.rules as { conditions: boolean[]; output: string }[]).map((rule, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-2 text-gray-600">
                                    {(dt.conditions as { field: string; operator: string; value: unknown }[]).map((c, j) => (
                                      <span key={j}>{c.field} {c.operator} {String(c.value)} </span>
                                    ))}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500">{JSON.stringify(rule.conditions)}</td>
                                  <td className="px-3 py-2 font-medium text-blue-700">{rule.output}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'Stakeholder Matrix' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Stakeholder Matrix (RACI)</h2>
            {!selectedModel ? (
              <p className="text-gray-500 text-sm">Select a model from the Model Library first.</p>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-4">Stakeholders for: <span className="font-medium">{selectedModel.name}</span></p>
                {stakeholders.length === 0 ? (
                  <div className="border-dashed border-2 border-gray-200 rounded p-8 text-center text-gray-400 text-sm">No stakeholders assigned yet.</div>
                ) : (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="text-left px-4 py-3">Role</th>
                          <th className="text-left px-4 py-3">Lane</th>
                          <th className="text-left px-4 py-3">Responsibilities</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stakeholders.map((s, i) => (
                          <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 font-medium">{s.name}</td>
                            <td className="px-4 py-3">
                              <Badge label={s.role} colorClass={RACI_COLORS[s.role] || 'bg-gray-100 text-gray-700'} />
                            </td>
                            <td className="px-4 py-3 text-gray-600">{s.lane || '—'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {s.responsibilities?.join(' · ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  {RACI_ROLES.map(r => (
                    <div key={r} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-3 h-3 rounded-sm ${RACI_COLORS[r]?.split(' ')[0]}`} />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
