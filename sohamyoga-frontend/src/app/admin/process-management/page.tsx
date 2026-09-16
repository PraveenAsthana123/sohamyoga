'use client';

import { useEffect, useState, useCallback } from 'react';

const TABS = ['Process Map', 'All Processes', 'Process Detail', 'Add Process', 'Add Steps', 'Analytics'] as const;
type Tab = typeof TABS[number];

const DEPARTMENTS = ['marketing', 'sales', 'operations', 'finance', 'hr', 'tech', 'content', 'customer_success'];
const DEPT_LABELS: Record<string, string> = {
  marketing: 'Marketing', sales: 'Sales', operations: 'Operations',
  finance: 'Finance', hr: 'HR', tech: 'Technology', content: 'Content',
  customer_success: 'Customer Success',
};
const MATURITY_LEVELS = ['initial', 'repeatable', 'defined', 'managed', 'optimizing'];
const AUTOMATION_LEVELS = ['manual', 'partial', 'mostly_automated', 'fully_automated'];
const PROCESS_TYPES = ['main', 'sub', 'support', 'management'];
const FREQUENCIES = ['ad_hoc', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'triggered'];
const STATUSES = ['active', 'inactive', 'under_review', 'deprecated'];

interface Process {
  id: number;
  name: string;
  process_code: string;
  process_type: string;
  parent_id: number | null;
  department: string;
  owner: string;
  description: string;
  objective: string;
  inputs: string[] | null;
  outputs: string[] | null;
  tools: string[] | null;
  status: string;
  maturity_level: string;
  automation_level: string;
  frequency: string;
  avg_duration_minutes: number | null;
  priority: string;
  risk_level: string;
  compliance_required: boolean;
  sop_url: string | null;
  created_at: string;
  sub_process_count: number;
}

interface Step {
  id: number;
  process_id: number;
  step_order: number;
  step_name: string;
  description: string;
  responsible_role: string;
  tool: string;
  estimated_minutes: number;
  is_automated: boolean;
  decision_point: boolean;
}

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const glassCard = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg';

function MaturityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    initial: 'bg-red-500/20 text-red-300 border-red-400/30',
    repeatable: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    defined: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    managed: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    optimizing: 'bg-green-500/20 text-green-300 border-green-400/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
      {level}
    </span>
  );
}

function AutomationBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    manual: 'bg-gray-500/20 text-gray-300 border-gray-400/30',
    partial: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    mostly_automated: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    fully_automated: 'bg-green-500/20 text-green-300 border-green-400/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
      {level.replace(/_/g, ' ')}
    </span>
  );
}

function DeptBadge({ dept }: { dept: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-medium">
      {DEPT_LABELS[dept] ?? dept}
    </span>
  );
}

function ProcessMapTab({ processes }: { processes: Process[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(DEPARTMENTS));

  const toggle = (dept: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {DEPARTMENTS.map(dept => {
        const mainProcs = processes.filter(p => p.department === dept && p.process_type === 'main');
        const subProcs = processes.filter(p => p.department === dept && p.process_type !== 'main');
        const isOpen = expanded.has(dept);
        return (
          <div key={dept} className={glassCard}>
            <button
              onClick={() => toggle(dept)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">{DEPT_LABELS[dept]}</span>
                <span className="text-white/50 text-xs">{mainProcs.length} main · {subProcs.length} sub</span>
              </div>
              <span className="text-white/60">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="mt-4 space-y-3">
                {mainProcs.length === 0 && (
                  <p className="text-white/40 text-sm">No main processes in this department</p>
                )}
                {mainProcs.map(proc => {
                  const children = processes.filter(p => p.parent_id === proc.id);
                  return (
                    <div key={proc.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-start gap-3 flex-wrap">
                        <span className="text-white/60 text-xs font-mono">{proc.process_code}</span>
                        <span className="text-white font-medium">{proc.name}</span>
                        <MaturityBadge level={proc.maturity_level} />
                        <AutomationBadge level={proc.automation_level} />
                        {proc.owner && <span className="text-white/50 text-xs">👤 {proc.owner}</span>}
                      </div>
                      {children.length > 0 && (
                        <div className="mt-2 ml-4 space-y-1">
                          {children.map(child => (
                            <div key={child.id} className="flex items-center gap-2 flex-wrap text-sm">
                              <span className="text-white/30">└</span>
                              <span className="text-white/50 text-xs font-mono">{child.process_code}</span>
                              <span className="text-white/80">{child.name}</span>
                              <MaturityBadge level={child.maturity_level} />
                              <AutomationBadge level={child.automation_level} />
                              {child.owner && <span className="text-white/40 text-xs">👤 {child.owner}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Show unattached subs by department if no parent match */}
                    </div>
                  );
                })}
                {/* Sub-processes without a matching parent in this dept */}
                {subProcs.filter(p => !p.parent_id || !mainProcs.find(m => m.id === p.parent_id)).map(proc => (
                  <div key={proc.id} className="bg-white/5 rounded-xl p-3 border border-white/10 ml-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="text-white/60 text-xs font-mono">{proc.process_code}</span>
                      <span className="text-white/80 font-medium">{proc.name}</span>
                      <MaturityBadge level={proc.maturity_level} />
                      <AutomationBadge level={proc.automation_level} />
                      <span className="text-white/40 text-xs">{proc.process_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AllProcessesTab({ processes, onRefresh }: { processes: Process[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = processes.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.process_code ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDept && p.department !== filterDept) return false;
    if (filterType && p.process_type !== filterType) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  const handleDeprecate = async (id: number) => {
    if (!confirm('Deprecate this process?')) return;
    setDeleting(id);
    await fetch(`/api/admin/processes?id=${id}`, { method: 'DELETE' }).catch(() => null);
    setDeleting(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          className="flex-1 min-w-48 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 text-sm"
          placeholder="Search by name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
        </select>
        <select className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-white/80">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              {['Code', 'Name', 'Department', 'Type', 'Owner', 'Maturity', 'Automation', 'Frequency', 'Avg Mins', 'Sub-procs', 'Action'].map(h => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-white/5">
                <td className="px-3 py-2 font-mono text-xs text-white/60">{p.process_code}</td>
                <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                <td className="px-3 py-2"><DeptBadge dept={p.department} /></td>
                <td className="px-3 py-2 text-white/60">{p.process_type}</td>
                <td className="px-3 py-2 text-white/60">{p.owner || '—'}</td>
                <td className="px-3 py-2"><MaturityBadge level={p.maturity_level} /></td>
                <td className="px-3 py-2"><AutomationBadge level={p.automation_level} /></td>
                <td className="px-3 py-2 text-white/60">{p.frequency}</td>
                <td className="px-3 py-2 text-white/60">{p.avg_duration_minutes ?? '—'}</td>
                <td className="px-3 py-2 text-white/60">{p.sub_process_count}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDeprecate(p.id)}
                    disabled={deleting === p.id || p.status === 'deprecated'}
                    className="text-xs text-red-300 hover:text-red-200 disabled:opacity-40"
                  >
                    {deleting === p.id ? '…' : 'Deprecate'}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-white/30">No processes match filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProcessDetailTab({ processes }: { processes: Process[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = processes.find(p => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/admin/processes/${selectedId}/steps`)
      .then(r => r.json())
      .then(d => setSteps(d.steps ?? []))
      .catch(() => setSteps([]))
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-white/70 text-sm mb-2">Select Process</label>
        <select
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Choose a process —</option>
          {processes.map(p => (
            <option key={p.id} value={p.id}>{p.process_code} — {p.name}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className={glassCard}>
          <div className="flex flex-wrap gap-3 items-start mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">{selected.name}</h3>
              <p className="text-white/50 text-sm font-mono">{selected.process_code}</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <DeptBadge dept={selected.department} />
              <MaturityBadge level={selected.maturity_level} />
              <AutomationBadge level={selected.automation_level} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
            {[
              ['Owner', selected.owner || '—'],
              ['Type', selected.process_type],
              ['Frequency', selected.frequency],
              ['Avg Duration', selected.avg_duration_minutes ? `${selected.avg_duration_minutes} min` : '—'],
              ['Priority', selected.priority],
              ['Risk Level', selected.risk_level],
              ['Status', selected.status],
              ['Compliance Required', selected.compliance_required ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-white/40 text-xs">{label}</span>
                <p className="text-white/80">{value}</p>
              </div>
            ))}
          </div>

          {selected.description && (
            <div className="mb-3">
              <span className="text-white/40 text-xs">Description</span>
              <p className="text-white/80 text-sm">{selected.description}</p>
            </div>
          )}
          {selected.objective && (
            <div className="mb-3">
              <span className="text-white/40 text-xs">Objective</span>
              <p className="text-white/80 text-sm">{selected.objective}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
            {[['Inputs', selected.inputs], ['Outputs', selected.outputs], ['Tools', selected.tools]].map(([label, arr]) => (
              <div key={String(label)}>
                <span className="text-white/40 text-xs">{String(label)}</span>
                {arr && (arr as string[]).length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {(arr as string[]).map(item => (
                      <li key={item} className="text-white/70 text-xs bg-white/5 rounded px-2 py-0.5">{item}</li>
                    ))}
                  </ul>
                ) : <p className="text-white/30 text-xs">None</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <div>
          <h3 className="text-white font-semibold mb-3">Process Steps</h3>
          {loading && <p className="text-white/40 text-sm">Loading steps…</p>}
          {!loading && steps.length === 0 && (
            <p className="text-white/30 text-sm">No steps added yet. Use the &quot;Add Steps&quot; tab to add them.</p>
          )}
          {!loading && steps.length > 0 && (
            <ol className="space-y-3">
              {steps.map(step => (
                <li key={step.id} className={`${glassCard} flex gap-4`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                    {step.step_order}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{step.step_name}</span>
                      {step.decision_point && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 rounded px-2 py-0.5">◆ Decision Point</span>
                      )}
                      {step.is_automated && (
                        <span className="text-xs bg-green-500/20 text-green-300 border border-green-400/30 rounded px-2 py-0.5">🤖 Automated</span>
                      )}
                    </div>
                    {step.description && <p className="text-white/60 text-sm mt-1">{step.description}</p>}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-white/50">
                      {step.responsible_role && <span>👤 {step.responsible_role}</span>}
                      {step.tool && <span>🔧 {step.tool}</span>}
                      {step.estimated_minutes && <span>⏱ {step.estimated_minutes} min</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function AddProcessTab({ processes, onRefresh }: { processes: Process[]; onRefresh: () => void }) {
  const [form, setForm] = useState({
    name: '', process_code: '', process_type: 'main', parent_id: '',
    department: 'marketing', owner: '', description: '', objective: '',
    inputs: '', outputs: '', tools: '', frequency: 'daily',
    avg_duration_minutes: '', maturity_level: 'defined', automation_level: 'manual',
    priority: 'medium', risk_level: 'low', compliance_required: false, sop_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        avg_duration_minutes: form.avg_duration_minutes ? Number(form.avg_duration_minutes) : null,
        inputs: form.inputs ? form.inputs.split(',').map(s => s.trim()).filter(Boolean) : null,
        outputs: form.outputs ? form.outputs.split(',').map(s => s.trim()).filter(Boolean) : null,
        tools: form.tools ? form.tools.split(',').map(s => s.trim()).filter(Boolean) : null,
      };
      const r = await fetch('/api/admin/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg('Process created successfully!');
        setForm({ name: '', process_code: '', process_type: 'main', parent_id: '',
          department: 'marketing', owner: '', description: '', objective: '',
          inputs: '', outputs: '', tools: '', frequency: 'daily',
          avg_duration_minutes: '', maturity_level: 'defined', automation_level: 'manual',
          priority: 'medium', risk_level: 'low', compliance_required: false, sop_url: '' });
        onRefresh();
      } else {
        setMsg(d.error ?? 'Failed to create process');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30';
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = 'block text-white/60 text-xs mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {msg && (
        <div className={`rounded-xl p-3 text-sm ${msg.includes('success') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
          {msg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Process Name *</label>
          <input required className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lead Qualification" />
        </div>
        <div>
          <label className={labelCls}>Process Code</label>
          <input className={inputCls} value={form.process_code} onChange={e => set('process_code', e.target.value)} placeholder="e.g. MKT-006" />
        </div>
        <div>
          <label className={labelCls}>Process Type</label>
          <select className={selectCls} value={form.process_type} onChange={e => set('process_type', e.target.value)}>
            {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Parent Process (optional)</label>
          <select className={selectCls} value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
            <option value="">None</option>
            {processes.filter(p => p.process_type === 'main').map(p => (
              <option key={p.id} value={p.id}>{p.process_code} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Department *</label>
          <select required className={selectCls} value={form.department} onChange={e => set('department', e.target.value)}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Owner</label>
          <input className={inputCls} value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="e.g. Marketing Ops" />
        </div>
        <div>
          <label className={labelCls}>Frequency</label>
          <select className={selectCls} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Avg Duration (minutes)</label>
          <input type="number" className={inputCls} value={form.avg_duration_minutes} onChange={e => set('avg_duration_minutes', e.target.value)} placeholder="e.g. 30" />
        </div>
        <div>
          <label className={labelCls}>Maturity Level</label>
          <select className={selectCls} value={form.maturity_level} onChange={e => set('maturity_level', e.target.value)}>
            {MATURITY_LEVELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Automation Level</label>
          <select className={selectCls} value={form.automation_level} onChange={e => set('automation_level', e.target.value)}>
            {AUTOMATION_LEVELS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select className={selectCls} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Risk Level</label>
          <select className={selectCls} value={form.risk_level} onChange={e => set('risk_level', e.target.value)}>
            {['low', 'medium', 'high'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea rows={2} className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of the process" />
      </div>
      <div>
        <label className={labelCls}>Objective</label>
        <textarea rows={2} className={inputCls} value={form.objective} onChange={e => set('objective', e.target.value)} placeholder="What is the goal of this process?" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Inputs (comma-separated)</label>
          <input className={inputCls} value={form.inputs} onChange={e => set('inputs', e.target.value)} placeholder="e.g. Lead data, Email list" />
        </div>
        <div>
          <label className={labelCls}>Outputs (comma-separated)</label>
          <input className={inputCls} value={form.outputs} onChange={e => set('outputs', e.target.value)} placeholder="e.g. Published post, Report" />
        </div>
        <div>
          <label className={labelCls}>Tools (comma-separated)</label>
          <input className={inputCls} value={form.tools} onChange={e => set('tools', e.target.value)} placeholder="e.g. Postiz, HubSpot" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>SOP URL</label>
          <input className={inputCls} value={form.sop_url} onChange={e => set('sop_url', e.target.value)} placeholder="https://…" />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <input type="checkbox" id="comp_req" checked={form.compliance_required} onChange={e => set('compliance_required', e.target.checked)} className="w-4 h-4" />
          <label htmlFor="comp_req" className="text-white/70 text-sm">Compliance Required</label>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
      >
        {saving ? 'Creating…' : 'Create Process'}
      </button>
    </form>
  );
}

function AddStepsTab({ processes }: { processes: Process[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [form, setForm] = useState({
    step_order: '1', step_name: '', description: '', responsible_role: '',
    tool: '', estimated_minutes: '', is_automated: false, decision_point: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchSteps = useCallback((id: number) => {
    setLoadingSteps(true);
    fetch(`/api/admin/processes/${id}/steps`)
      .then(r => r.json())
      .then(d => setSteps(d.steps ?? []))
      .catch(() => setSteps([]))
      .finally(() => setLoadingSteps(false));
  }, []);

  const handleSelectProcess = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : null;
    setSelectedId(id);
    if (id) {
      fetchSteps(id);
      setForm(f => ({ ...f, step_order: String((steps.length || 0) + 1) }));
    }
  };

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setMsg('Select a process first'); return; }
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch(`/api/admin/processes/${selectedId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          step_order: Number(form.step_order),
          estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg('Step added!');
        setForm(f => ({ ...f, step_order: String(Number(f.step_order) + 1), step_name: '', description: '', responsible_role: '', tool: '', estimated_minutes: '', is_automated: false, decision_point: false }));
        fetchSteps(selectedId);
      } else {
        setMsg(d.error ?? 'Failed to add step');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30';
  const labelCls = 'block text-white/60 text-xs mb-1';

  return (
    <div className="space-y-6">
      <div>
        <label className={labelCls}>Select Process</label>
        <select className={inputCls} value={selectedId ?? ''} onChange={handleSelectProcess}>
          <option value="">— Choose a process —</option>
          {processes.map(p => (
            <option key={p.id} value={p.id}>{p.process_code} — {p.name}</option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          <div>
            <h3 className="text-white font-semibold mb-3">Existing Steps ({steps.length})</h3>
            {loadingSteps && <p className="text-white/40 text-sm">Loading…</p>}
            {!loadingSteps && steps.length === 0 && <p className="text-white/30 text-sm">No steps yet.</p>}
            {!loadingSteps && steps.length > 0 && (
              <ol className="space-y-2">
                {steps.map(s => (
                  <li key={s.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{s.step_order}</span>
                    <span className="text-white">{s.step_name}</span>
                    {s.decision_point && <span className="text-yellow-300 text-xs">◆</span>}
                    {s.is_automated && <span className="text-green-300 text-xs">🤖</span>}
                    <span className="ml-auto text-white/40 text-xs">{s.responsible_role || ''} {s.estimated_minutes ? `· ${s.estimated_minutes}m` : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-white font-semibold">Add New Step</h3>
            {msg && (
              <div className={`rounded-xl p-3 text-sm ${msg.includes('added') || msg.includes('!') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {msg}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Step Order *</label>
                <input required type="number" className={inputCls} value={form.step_order} onChange={e => set('step_order', e.target.value)} min="1" />
              </div>
              <div className="col-span-3">
                <label className={labelCls}>Step Name *</label>
                <input required className={inputCls} value={form.step_name} onChange={e => set('step_name', e.target.value)} placeholder="e.g. Review incoming lead data" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Responsible Role</label>
                <input className={inputCls} value={form.responsible_role} onChange={e => set('responsible_role', e.target.value)} placeholder="e.g. Marketing Ops" />
              </div>
              <div>
                <label className={labelCls}>Tool</label>
                <input className={inputCls} value={form.tool} onChange={e => set('tool', e.target.value)} placeholder="e.g. HubSpot" />
              </div>
              <div>
                <label className={labelCls}>Est. Minutes</label>
                <input type="number" className={inputCls} value={form.estimated_minutes} onChange={e => set('estimated_minutes', e.target.value)} min="1" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={2} className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What happens in this step?" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_automated} onChange={e => set('is_automated', e.target.checked)} className="w-4 h-4" />
                Automated Step
              </label>
              <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                <input type="checkbox" checked={form.decision_point} onChange={e => set('decision_point', e.target.checked)} className="w-4 h-4" />
                Decision Point ◆
              </label>
            </div>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors">
              {saving ? 'Adding…' : 'Add Step'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function AnalyticsTab({ processes }: { processes: Process[] }) {
  const maturityScore: Record<string, number> = { initial: 1, repeatable: 2, defined: 3, managed: 4, optimizing: 5 };

  const deptStats = DEPARTMENTS.map(dept => {
    const deptProcs = processes.filter(p => p.department === dept);
    const total = deptProcs.length;
    if (total === 0) return { dept, total: 0, avgMaturity: 0, automationRate: 0, highRisk: 0 };
    const avgMaturity = deptProcs.reduce((sum, p) => sum + (maturityScore[p.maturity_level] ?? 3), 0) / total;
    const automationRate = deptProcs.filter(p => p.automation_level === 'fully_automated').length / total * 100;
    const highRisk = deptProcs.filter(p => p.risk_level === 'high').length;
    return { dept, total, avgMaturity, automationRate, highRisk };
  });

  const riskDist = ['low', 'medium', 'high'].map(r => ({
    risk: r,
    count: processes.filter(p => p.risk_level === r).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={glassCard}>
          <p className="text-white/50 text-xs">Total Processes</p>
          <p className="text-3xl font-bold text-white mt-1">{processes.length}</p>
        </div>
        <div className={glassCard}>
          <p className="text-white/50 text-xs">Fully Automated</p>
          <p className="text-3xl font-bold text-green-300 mt-1">
            {processes.filter(p => p.automation_level === 'fully_automated').length}
          </p>
        </div>
        <div className={glassCard}>
          <p className="text-white/50 text-xs">Compliance Required</p>
          <p className="text-3xl font-bold text-yellow-300 mt-1">
            {processes.filter(p => p.compliance_required).length}
          </p>
        </div>
        <div className={glassCard}>
          <p className="text-white/50 text-xs">High Risk</p>
          <p className="text-3xl font-bold text-red-300 mt-1">
            {processes.filter(p => p.risk_level === 'high').length}
          </p>
        </div>
      </div>

      <h3 className="text-white font-semibold">Department Health Scorecards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deptStats.map(ds => (
          <div key={ds.dept} className={glassCard}>
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-white font-medium">{DEPT_LABELS[ds.dept]}</h4>
              <span className="text-white/50 text-xs">{ds.total} processes</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Avg Maturity</span>
                  <span>{ds.avgMaturity.toFixed(1)} / 5.0</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full">
                  <div className="h-2 bg-blue-400 rounded-full" style={{ width: `${(ds.avgMaturity / 5) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Automation Rate</span>
                  <span>{ds.automationRate.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full">
                  <div className="h-2 bg-green-400 rounded-full" style={{ width: `${ds.automationRate}%` }} />
                </div>
              </div>
              {ds.highRisk > 0 && (
                <p className="text-red-300 text-xs mt-1">⚠ {ds.highRisk} high-risk process{ds.highRisk > 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={glassCard}>
        <h4 className="text-white font-medium mb-3">Risk Distribution</h4>
        <div className="space-y-2">
          {riskDist.map(({ risk, count }) => {
            const colors = { low: 'bg-green-400', medium: 'bg-yellow-400', high: 'bg-red-400' };
            const pct = processes.length ? (count / processes.length) * 100 : 0;
            return (
              <div key={risk}>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span className="capitalize">{risk} Risk</span>
                  <span>{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full">
                  <div className={`h-2 rounded-full ${colors[risk as keyof typeof colors]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProcessManagementPage() {
  const [tab, setTab] = useState<Tab>('Process Map');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProcesses = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/processes')
      .then(r => r.json())
      .then(d => setProcesses(d.processes ?? []))
      .catch(() => setError('Failed to load processes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className={`${glass} mb-6`}>
        <h1 className="text-2xl font-bold text-white">Process Management 🗂️</h1>
        <p className="text-white/60 text-sm mt-1">Document, map, and optimize business processes across all departments</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={glass}>
        {loading && <p className="text-white/40 text-sm">Loading processes…</p>}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {!loading && !error && (
          <>
            {tab === 'Process Map' && <ProcessMapTab processes={processes} />}
            {tab === 'All Processes' && <AllProcessesTab processes={processes} onRefresh={fetchProcesses} />}
            {tab === 'Process Detail' && <ProcessDetailTab processes={processes} />}
            {tab === 'Add Process' && <AddProcessTab processes={processes} onRefresh={fetchProcesses} />}
            {tab === 'Add Steps' && <AddStepsTab processes={processes} />}
            {tab === 'Analytics' && <AnalyticsTab processes={processes} />}
          </>
        )}
      </div>
    </div>
  );
}
