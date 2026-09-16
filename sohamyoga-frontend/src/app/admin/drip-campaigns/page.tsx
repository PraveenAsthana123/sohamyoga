'use client';

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DripSequence {
  id: string; name: string; description: string; status: string; created_at: string;
}

interface DripStep {
  id: string; sequence_id: string; step_order: number; delay_hours: number; subject: string; body: string;
}

interface DripEnrollment {
  id: string; sequence_id: string; lead_id: string; email: string | null;
  first_name: string | null; last_name: string | null;
  current_step: number; next_step_due_at: string; status: string; enrolled_at: string;
}

interface DripSendLog {
  id: string; enrollment_id: string; step_id: string; recipient_email: string;
  subject: string; status: string; queued_at: string;
}

interface DripData {
  sequences: DripSequence[];
  steps: DripStep[];
  enrollments: DripEnrollment[];
  sendLog: DripSendLog[];
}

type TabId = 'sequences' | 'enrollments' | 'send-log' | 'report' | 'dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TABS: { id: TabId; label: string }[] = [
  { id: 'sequences',   label: 'Sequences'   },
  { id: 'enrollments', label: 'Enrollments' },
  { id: 'send-log',    label: 'Send Log'    },
  { id: 'report',      label: 'Report'      },
  { id: 'dashboard',   label: 'Dashboard'   },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600',
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[color] ?? map.gray}`}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose:   'bg-rose-50 border-rose-200 text-rose-700',
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Sequences
// ---------------------------------------------------------------------------
function SequencesTab({ data, reload }: { data: DripData; reload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');

  const [addStepFor, setAddStepFor] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({ subject: '', body: '', delayHours: '24' });

  const createSequence = async () => {
    if (!name) { setMsg('Name required'); return; }
    const r = await fetch('/api/admin/drip-sequences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_sequence', name, description: desc }),
    });
    if (r.ok) { setMsg(''); setShowForm(false); setName(''); setDesc(''); reload(); }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'Create failed'); }
  };

  const activate = async (sequenceId: string) => {
    const r = await fetch('/api/admin/drip-sequences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate_sequence', sequenceId }),
    });
    if (r.ok) reload();
    else { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Activation failed'); }
  };

  const addStep = async (sequenceId: string) => {
    if (!stepForm.subject || !stepForm.body) { setMsg('Subject and body required'); return; }
    const r = await fetch('/api/admin/drip-sequences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_step', sequenceId,
        subject: stepForm.subject, body: stepForm.body,
        delayHours: Number(stepForm.delayHours),
      }),
    });
    if (r.ok) { setAddStepFor(null); setStepForm({ subject: '', body: '', delayHours: '24' }); reload(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Step add failed'); }
  };

  const statusColor = (s: string) => s === 'active' ? 'green' : s === 'archived' ? 'red' : 'amber';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Drip Sequences</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
          + New Sequence
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={createSequence} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Save</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      )}

      {data.sequences.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-gray-400 text-sm">
          No sequences yet. Create one above.
        </div>
      ) : data.sequences.map(seq => {
        const steps = data.steps.filter(s => s.sequence_id === seq.id).sort((a, b) => a.step_order - b.step_order);
        const enrollCount = data.enrollments.filter(e => e.sequence_id === seq.id).length;
        const activeEnrollCount = data.enrollments.filter(e => e.sequence_id === seq.id && e.status === 'active').length;
        return (
          <div key={seq.id} className="border rounded-lg p-5 bg-white space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{seq.name}</span>
                  <Badge color={statusColor(seq.status)}>{seq.status}</Badge>
                </div>
                {seq.description && <p className="text-sm text-gray-500 mt-0.5">{seq.description}</p>}
                <p className="text-xs text-gray-400 mt-1">{steps.length} step{steps.length !== 1 ? 's' : ''} · {activeEnrollCount} active / {enrollCount} total enrolled</p>
              </div>
              <div className="flex gap-2">
                {seq.status === 'draft' && (
                  <button onClick={() => activate(seq.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs">
                    Activate
                  </button>
                )}
                <button onClick={() => setAddStepFor(addStepFor === seq.id ? null : seq.id)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs">
                  + Step
                </button>
              </div>
            </div>

            {/* Steps timeline */}
            {steps.length > 0 && (
              <div className="border-t pt-3 space-y-1">
                {steps.map(step => (
                  <div key={step.id} className="flex items-center gap-3 text-sm py-1">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {step.step_order}
                    </span>
                    <span className="text-xs text-gray-400 w-20 shrink-0">+{step.delay_hours}h</span>
                    <span className="font-medium text-sm truncate">{step.subject}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Add step form */}
            {addStepFor === seq.id && (
              <div className="border-t pt-3 space-y-3 bg-blue-50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                    <input value={stepForm.subject} onChange={e => setStepForm(p => ({ ...p, subject: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Delay (hours after previous)</label>
                    <input type="number" min="0" value={stepForm.delayHours}
                      onChange={e => setStepForm(p => ({ ...p, delayHours: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Body</label>
                  <textarea value={stepForm.body} onChange={e => setStepForm(p => ({ ...p, body: e.target.value }))}
                    rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addStep(seq.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Add Step</button>
                  <button onClick={() => setAddStepFor(null)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Enrollments
// ---------------------------------------------------------------------------
function EnrollmentsTab({ data }: { data: DripData }) {
  const [seqFilter, setSeqFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = data.enrollments.filter(e => {
    if (seqFilter && e.sequence_id !== seqFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  const seqName = (id: string) => data.sequences.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…';

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={seqFilter} onChange={e => setSeqFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm">
          <option value="">All sequences</option>
          {data.sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {['active','completed','cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-500">{filtered.length} enrollment{filtered.length !== 1 ? 's' : ''}</p>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-xs text-gray-500">
              <th className="text-left py-2 px-4">Email</th>
              <th className="text-left py-2 px-4">Sequence</th>
              <th className="text-center py-2 px-4">Step</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Next Due</th>
              <th className="text-left py-2 px-4">Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No enrollments match the filter</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="py-2 px-4 font-medium">{e.email ?? '—'}</td>
                <td className="py-2 px-4 text-gray-600">{seqName(e.sequence_id)}</td>
                <td className="py-2 px-4 text-center font-mono">{e.current_step}</td>
                <td className="py-2 px-4">
                  <Badge color={e.status === 'active' ? 'green' : e.status === 'completed' ? 'blue' : 'red'}>{e.status}</Badge>
                </td>
                <td className="py-2 px-4 text-gray-400">{new Date(e.next_step_due_at).toLocaleString()}</td>
                <td className="py-2 px-4 text-gray-400">{new Date(e.enrolled_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Send Log
// ---------------------------------------------------------------------------
function SendLogTab({ data }: { data: DripData }) {
  const statusColor = (s: string) => s === 'sent' ? 'green' : s === 'failed' ? 'red' : 'gray';
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Send Log</h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Real email delivery requires SMTP — entries show as "queued" until SMTP is configured.
        </p>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-xs text-gray-500">
              <th className="text-left py-2 px-4">Recipient</th>
              <th className="text-left py-2 px-4">Subject</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Queued At</th>
            </tr>
          </thead>
          <tbody>
            {data.sendLog.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">No send log entries</td></tr>
            ) : data.sendLog.map(l => (
              <tr key={l.id} className="border-t hover:bg-gray-50">
                <td className="py-2 px-4 font-medium">{l.recipient_email}</td>
                <td className="py-2 px-4 text-gray-600 truncate max-w-xs">{l.subject}</td>
                <td className="py-2 px-4"><Badge color={statusColor(l.status)}>{l.status}</Badge></td>
                <td className="py-2 px-4 text-gray-400">{new Date(l.queued_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Report
// ---------------------------------------------------------------------------
function ReportTab({ data }: { data: DripData }) {
  // Per-sequence stats derived from enrollments and send log
  const sequenceStats = data.sequences.map(seq => {
    const seqEnrollments = data.enrollments.filter(e => e.sequence_id === seq.id);
    const enrolled = seqEnrollments.length;
    const completed = seqEnrollments.filter(e => e.status === 'completed').length;
    const cancelled = seqEnrollments.filter(e => e.status === 'cancelled').length;
    const active = seqEnrollments.filter(e => e.status === 'active').length;
    const dropOff = enrolled > 0 ? ((cancelled / enrolled) * 100).toFixed(1) : '0.0';

    const stepIds = data.steps.filter(s => s.sequence_id === seq.id).map(s => s.id);
    const seqSendLog = data.sendLog.filter(l => stepIds.includes(l.step_id));
    const totalQueued = seqSendLog.length;
    const totalSent = seqSendLog.filter(l => l.status === 'sent').length;

    // Avg days to complete — rough estimate from enrollment span
    const completedEnrollments = seqEnrollments.filter(e => e.status === 'completed');
    const stepCount = data.steps.filter(s => s.sequence_id === seq.id).length;
    const totalDelay = data.steps.filter(s => s.sequence_id === seq.id).reduce((sum, s) => sum + s.delay_hours, 0);
    const avgDaysToComplete = totalDelay > 0 ? (totalDelay / 24).toFixed(1) : '—';

    // Per-step funnel
    const steps = data.steps.filter(s => s.sequence_id === seq.id).sort((a, b) => a.step_order - b.step_order);
    const stepFunnel = steps.map(step => {
      const reached = data.enrollments.filter(e => e.sequence_id === seq.id && e.current_step >= step.step_order).length;
      const pct = enrolled > 0 ? ((reached / enrolled) * 100).toFixed(0) : '0';
      return { stepOrder: step.step_order, subject: step.subject, reached, pct };
    });

    return { seq, enrolled, completed, cancelled, active, dropOff, totalQueued, totalSent, avgDaysToComplete, stepFunnel, stepCount };
  });

  if (data.sequences.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-8 text-center text-gray-400 text-sm">
        No sequences yet. Create sequences in the Sequences tab.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
        Demo mode — email open/click rates require SMTP delivery. Send log shows "queued" status until SMTP is configured.
        Enrollment and step-funnel data is real.
      </p>

      {sequenceStats.map(({ seq, enrolled, completed, cancelled, active, dropOff, totalQueued, totalSent, avgDaysToComplete, stepFunnel, stepCount }) => (
        <div key={seq.id} className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{seq.name}</h3>
            <Badge color={seq.status === 'active' ? 'green' : 'amber'}>{seq.status}</Badge>
            <span className="text-xs text-gray-400">{stepCount} steps</span>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Enrolled"          value={enrolled}                     color="blue" />
            <KpiCard label="Completed"         value={completed}                    color="green" />
            <KpiCard label="Drop-off Rate"     value={`${dropOff}%`}               color="rose" sub={`${cancelled} cancelled`} />
            <KpiCard label="Avg Days (est.)"   value={avgDaysToComplete}            color="purple" sub="Based on step delays" />
          </div>

          {/* Step funnel */}
          {stepFunnel.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Step Funnel (reach rate)</h4>
              {stepFunnel.map((sf, i) => (
                <div key={sf.stepOrder} className="flex items-center gap-3 mb-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                    {sf.stepOrder}
                  </span>
                  <span className="text-xs text-gray-600 w-48 truncate" title={sf.subject}>{sf.subject}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded">
                    <div className="h-3 bg-blue-400 rounded transition-all" style={{ width: `${sf.pct}%` }} />
                  </div>
                  <span className="text-xs font-mono w-20 text-right">{sf.reached} ({sf.pct}%)</span>
                  {i < stepFunnel.length - 1 && stepFunnel[i + 1] && (
                    <span className="text-xs text-red-500 w-16 text-right">
                      -{(Number(sf.pct) - Number(stepFunnel[i + 1].pct)).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Send log summary */}
          <div className="text-xs text-gray-500">
            Total sends queued: {totalQueued} · Sent (SMTP required): {totalSent}
            {totalSent === 0 && totalQueued > 0 && ' — configure SMTP to deliver queued emails'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Dashboard
// ---------------------------------------------------------------------------
function DashboardTab({ data }: { data: DripData }) {
  const activeSeqs = data.sequences.filter(s => s.status === 'active').length;
  const totalEnrolled = data.enrollments.length;
  const activeEnrolled = data.enrollments.filter(e => e.status === 'active').length;
  const completedEnrolled = data.enrollments.filter(e => e.status === 'completed').length;
  const completionRate = totalEnrolled > 0 ? ((completedEnrolled / totalEnrolled) * 100).toFixed(1) : '0.0';

  // Best-performing sequence by completion rate
  const seqStats = data.sequences.map(seq => {
    const seqEnrollments = data.enrollments.filter(e => e.sequence_id === seq.id);
    const enrolled = seqEnrollments.length;
    const completed = seqEnrollments.filter(e => e.status === 'completed').length;
    const rate = enrolled > 0 ? ((completed / enrolled) * 100).toFixed(1) : '0.0';
    return { seq, enrolled, completed, rate: Number(rate) };
  }).sort((a, b) => b.rate - a.rate);

  const bestSeq = seqStats[0];

  // Upcoming queue — enrollments with status=active that have next_step_due_at in the future
  const upcoming = data.enrollments
    .filter(e => e.status === 'active')
    .sort((a, b) => new Date(a.next_step_due_at).getTime() - new Date(b.next_step_due_at).getTime())
    .slice(0, 10);

  const seqName = (id: string) => data.sequences.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…';

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Active Sequences"   value={activeSeqs}                color="green" />
        <KpiCard label="Total Enrolled"     value={totalEnrolled}             color="blue" />
        <KpiCard label="Active in Drip"     value={activeEnrolled}            color="purple" sub="Currently receiving steps" />
        <KpiCard label="Completed"          value={completedEnrolled}         color="teal" sub="Finished all steps" />
        <KpiCard label="Avg Completion Rate" value={`${completionRate}%`}     color="green" sub="Across all sequences" />
        <KpiCard label="Send Log Entries"   value={data.sendLog.length}       color="amber" sub="Queued / sent records" />
      </div>

      {/* Best-performing */}
      {bestSeq && bestSeq.enrolled > 0 && (
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Best-Performing Sequence</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{bestSeq.seq.name}</div>
              <div className="text-sm text-gray-500">{bestSeq.completed} completed of {bestSeq.enrolled} enrolled</div>
            </div>
            <div className="text-3xl font-bold text-green-600">{bestSeq.rate}%</div>
          </div>
        </div>
      )}

      {/* Sequence overview */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">All Sequences Overview</h3>
        {data.sequences.length === 0 ? (
          <p className="text-sm text-gray-400">No sequences created yet.</p>
        ) : (
          <div className="space-y-2">
            {seqStats.map(({ seq, enrolled, completed, rate }) => (
              <div key={seq.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-gray-700 font-medium" title={seq.name}>{seq.name}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-green-400 rounded" style={{ width: `${rate}%` }} />
                </div>
                <span className="text-xs font-mono w-20 text-right text-gray-500">{completed}/{enrolled} ({rate}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming queue */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Upcoming Sends (next scheduled steps)
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">No active enrollments awaiting next step.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left py-1.5 pr-4">Recipient</th>
                  <th className="text-left py-1.5 pr-4">Sequence</th>
                  <th className="text-center py-1.5 pr-4">Next Step</th>
                  <th className="text-left py-1.5">Due At</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="py-1.5 pr-4">{e.email ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-gray-500">{seqName(e.sequence_id)}</td>
                    <td className="py-1.5 pr-4 text-center font-mono">{e.current_step + 1}</td>
                    <td className="py-1.5 text-gray-400">{new Date(e.next_step_due_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {upcoming.length > 0 && (
          <p className="text-xs text-amber-700 mt-2">
            Delivery requires SMTP — steps are queued and will send once SMTP is configured.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function DripCampaignsPage() {
  const [tab, setTab] = useState<TabId>('sequences');
  const [data, setData] = useState<DripData>({ sequences: [], steps: [], enrollments: [], sendLog: [] });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const d = await fetchJson<DripData>('/api/admin/drip-sequences');
    setData(d ?? { sequences: [], steps: [], enrollments: [], sendLog: [] });
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Drip Campaigns</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Multi-step email sequences with delayed delivery, enrollment tracking, and funnel analytics
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {tab === 'sequences'   && <SequencesTab data={data} reload={reload} />}
            {tab === 'enrollments' && <EnrollmentsTab data={data} />}
            {tab === 'send-log'    && <SendLogTab data={data} />}
            {tab === 'report'      && <ReportTab data={data} />}
            {tab === 'dashboard'   && <DashboardTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}
