'use client';

import { useState, useEffect, useCallback } from 'react';

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'engagements' | 'findings' | 'schedule' | 'heatmap' | 'remediation';

interface Engagement {
  id: number;
  title: string;
  audit_type: string;
  scope: string | null;
  auditor_name: string | null;
  auditor_firm: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  findings_count: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  overall_rating: string | null;
  report_url: string | null;
  actual_critical: number;
  actual_high: number;
  actual_medium: number;
  actual_low: number;
}

interface Finding {
  id: number;
  engagement_id: number;
  engagement_title: string;
  finding_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  status: string;
  remediation_plan: string | null;
  owner: string | null;
  due_date: string | null;
  resolved_at: string | null;
  days_overdue: number | null;
}

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', informational: 'ℹ️',
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500/30 text-red-200',
  high: 'bg-orange-500/30 text-orange-200',
  medium: 'bg-amber-500/30 text-amber-200',
  low: 'bg-green-500/30 text-green-200',
  informational: 'bg-blue-500/30 text-blue-200',
};
const STATUS_COLOR: Record<string, string> = {
  planned: 'bg-gray-500/30 text-gray-200',
  in_progress: 'bg-blue-500/30 text-blue-200',
  completed: 'bg-green-500/30 text-green-200',
  cancelled: 'bg-red-500/30 text-red-200',
  follow_up: 'bg-purple-500/30 text-purple-200',
  open: 'bg-red-500/30 text-red-200',
  in_remediation: 'bg-amber-500/30 text-amber-200',
  resolved: 'bg-green-500/30 text-green-200',
  accepted_risk: 'bg-purple-500/30 text-purple-200',
  closed: 'bg-gray-500/30 text-gray-200',
};
const RATING_COLOR: Record<string, string> = {
  satisfactory: 'bg-green-500/30 text-green-200',
  needs_improvement: 'bg-amber-500/30 text-amber-200',
  unsatisfactory: 'bg-orange-500/30 text-orange-200',
  critical: 'bg-red-500/30 text-red-200',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// Map severity to heatmap cell [impact, likelihood] (0=low,1=med,2=high)
function severityToCell(sev: string): [number, number] {
  switch (sev) {
    case 'critical': return [2, 2];
    case 'high': return [2, 1];
    case 'medium': return [1, 1];
    case 'low': return [0, 0];
    default: return [0, 0];
  }
}

const HEATMAP_COLORS: string[][] = [
  ['bg-green-500/40', 'bg-amber-400/40', 'bg-amber-500/40'],
  ['bg-amber-400/40', 'bg-amber-500/40', 'bg-orange-600/40'],
  ['bg-amber-500/40', 'bg-orange-600/40', 'bg-red-600/50'],
];

export default function BusinessAuditPage() {
  const [tab, setTab] = useState<Tab>('engagements');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updateFinding, setUpdateFinding] = useState<{ id: number; status: string; remediation_plan: string; owner: string } | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    title: '', audit_type: 'internal', scope: '', auditor_name: '', auditor_firm: '', start_date: '', end_date: '',
  });
  const [addFindingForm, setAddFindingForm] = useState({
    engagement_id: '', finding_id: '', title: '', description: '', severity: 'medium', category: '', owner: '', due_date: '',
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadEngagements = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/business-audit');
      if (r.ok) { const d = await r.json(); setEngagements(d.engagements || []); }
    } finally { setLoading(false); }
  }, []);

  const loadFindings = useCallback(async () => {
    const params = new URLSearchParams();
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);
    const r = await fetch(`/api/admin/business-audit/findings?${params}`);
    if (r.ok) { const d = await r.json(); setFindings(d.findings || []); }
  }, [severityFilter, statusFilter]);

  useEffect(() => { loadEngagements(); }, [loadEngagements]);
  useEffect(() => { loadFindings(); }, [loadFindings]);

  const scheduleAudit = async () => {
    if (!scheduleForm.title) return showToast('Title required');
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/business-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm),
      });
      if (r.ok) { showToast('Audit scheduled'); loadEngagements(); setScheduleForm({ title: '', audit_type: 'internal', scope: '', auditor_name: '', auditor_firm: '', start_date: '', end_date: '' }); }
    } finally { setSubmitting(false); }
  };

  const submitFinding = async () => {
    if (!addFindingForm.engagement_id || !addFindingForm.title) return showToast('Engagement and title required');
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/business-audit/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addFindingForm, engagement_id: Number(addFindingForm.engagement_id) }),
      });
      if (r.ok) { showToast('Finding added'); loadFindings(); loadEngagements(); setAddFindingForm({ engagement_id: '', finding_id: '', title: '', description: '', severity: 'medium', category: '', owner: '', due_date: '' }); }
    } finally { setSubmitting(false); }
  };

  const patchFinding = async () => {
    if (!updateFinding) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/business-audit/findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateFinding),
      });
      if (r.ok) { showToast('Finding updated'); setUpdateFinding(null); loadFindings(); }
    } finally { setSubmitting(false); }
  };

  const openFindings = findings.filter(f => ['open', 'in_remediation'].includes(f.status));
  const overdue = openFindings.filter(f => f.days_overdue && f.days_overdue > 0);
  const resolvedLast30 = findings.filter(f => {
    if (!f.resolved_at) return false;
    return (Date.now() - new Date(f.resolved_at).getTime()) < 30 * 86400000;
  });

  // Heatmap grid [impact][likelihood] = findings[]
  const heatmapGrid: Finding[][][] = [[[], [], []], [[], [], []], [[], [], []]];
  openFindings.forEach(f => {
    const [imp, lik] = severityToCell(f.severity);
    heatmapGrid[imp][lik].push(f);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Update Finding Modal */}
      {updateFinding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className={`${glass} w-full max-w-md`}>
            <h3 className="text-white font-bold mb-4">Update Finding</h3>
            <div className="space-y-3">
              <select value={updateFinding.status}
                onChange={e => setUpdateFinding(p => p ? { ...p, status: e.target.value } : null)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['open','in_remediation','resolved','accepted_risk','closed'].map(s =>
                  <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
              <input placeholder="Owner" value={updateFinding.owner}
                onChange={e => setUpdateFinding(p => p ? { ...p, owner: e.target.value } : null)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <textarea placeholder="Remediation plan" value={updateFinding.remediation_plan} rows={3}
                onChange={e => setUpdateFinding(p => p ? { ...p, remediation_plan: e.target.value } : null)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={patchFinding} disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setUpdateFinding(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className={glass}>
          <h1 className="text-2xl font-bold text-white">🔎 Business Audit</h1>
          <p className="text-white/60 text-sm mt-1">Audit engagements · Finding register · Risk heatmap · Remediation tracker</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['engagements','findings','schedule','heatmap','remediation'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
              {t === 'engagements' ? '📋 Engagements' : t === 'findings' ? '🔍 Findings' : t === 'schedule' ? '📅 Schedule Audit' : t === 'heatmap' ? '🌡 Risk Heatmap' : '🔧 Remediation'}
            </button>
          ))}
        </div>

        {/* Audit Engagements */}
        {tab === 'engagements' && (
          <div className={glass}>
            <h2 className="text-white font-bold text-lg mb-4">Audit Engagements</h2>
            {loading ? (
              <p className="text-white/40">Loading…</p>
            ) : engagements.length === 0 ? (
              <p className="text-white/40">No engagements yet. Schedule one in the Schedule Audit tab.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 border-b border-white/10 text-left">
                      <th className="pb-2 pr-3">Title</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Firm</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Dates</th>
                      <th className="pb-2 pr-3">Findings</th>
                      <th className="pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagements.map(e => (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 text-white font-medium">{e.title}</td>
                        <td className="py-2 pr-3"><Badge label={e.audit_type} colorClass="bg-white/10 text-white/70" /></td>
                        <td className="py-2 pr-3 text-white/60 text-xs">{e.auditor_firm ?? '—'}</td>
                        <td className="py-2 pr-3"><Badge label={e.status.replace('_',' ')} colorClass={STATUS_COLOR[e.status] ?? 'bg-gray-500/30 text-gray-200'} /></td>
                        <td className="py-2 pr-3 text-white/50 text-xs">
                          {e.start_date ? new Date(e.start_date).toLocaleDateString() : '—'} — {e.end_date ? new Date(e.end_date).toLocaleDateString() : 'ongoing'}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-xs space-x-1">
                            {e.actual_critical > 0 && <span>🔴{e.actual_critical}</span>}
                            {e.actual_high > 0 && <span>🟠{e.actual_high}</span>}
                            {e.actual_medium > 0 && <span>🟡{e.actual_medium}</span>}
                            {e.actual_low > 0 && <span>🟢{e.actual_low}</span>}
                            {e.actual_critical === 0 && e.actual_high === 0 && e.actual_medium === 0 && e.actual_low === 0 && <span className="text-white/30">none</span>}
                          </span>
                        </td>
                        <td className="py-2">
                          {e.overall_rating
                            ? <Badge label={e.overall_rating.replace('_',' ')} colorClass={RATING_COLOR[e.overall_rating] ?? 'bg-gray-500/30 text-gray-200'} />
                            : <span className="text-white/30 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Findings Register */}
        {tab === 'findings' && (
          <div className="space-y-4">
            <div className={glass}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-white font-bold text-lg flex-1">Findings Register</h2>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">All Severities</option>
                  {['critical','high','medium','low','informational'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">All Statuses</option>
                  {['open','in_remediation','resolved','accepted_risk','closed'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 border-b border-white/10 text-left">
                      <th className="pb-2 pr-3">ID</th>
                      <th className="pb-2 pr-3">Title</th>
                      <th className="pb-2 pr-3">Sev</th>
                      <th className="pb-2 pr-3">Category</th>
                      <th className="pb-2 pr-3">Engagement</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Owner</th>
                      <th className="pb-2 pr-3">Due</th>
                      <th className="pb-2">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map(f => (
                      <tr key={f.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 font-mono text-xs text-blue-300">{f.finding_id ?? `F-${f.id}`}</td>
                        <td className="py-2 pr-3 text-white max-w-xs truncate">{f.title}</td>
                        <td className="py-2 pr-3">
                          <span className="text-base">{SEVERITY_ICON[f.severity] ?? '⚪'}</span>
                          <Badge label={f.severity} colorClass={`ml-1 ${SEVERITY_COLOR[f.severity] ?? 'bg-gray-500/30 text-gray-200'}`} />
                        </td>
                        <td className="py-2 pr-3 text-white/60 text-xs">{f.category ?? '—'}</td>
                        <td className="py-2 pr-3 text-white/60 text-xs truncate max-w-[120px]">{f.engagement_title}</td>
                        <td className="py-2 pr-3"><Badge label={f.status.replace('_',' ')} colorClass={STATUS_COLOR[f.status] ?? 'bg-gray-500/30 text-gray-200'} /></td>
                        <td className="py-2 pr-3 text-white/60 text-xs">{f.owner ?? '—'}</td>
                        <td className="py-2 pr-3 text-white/60 text-xs">{f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}</td>
                        <td className="py-2 pr-3">
                          {f.days_overdue && f.days_overdue > 0
                            ? <span className="text-red-300 text-xs font-semibold">{f.days_overdue}d</span>
                            : <span className="text-white/30 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {findings.length === 0 && <p className="text-center text-white/40 py-8">No findings match filters</p>}
              </div>
            </div>

            {/* Add Finding inline */}
            <div className={glass}>
              <h3 className="text-white font-semibold mb-3">Add Finding</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <select value={addFindingForm.engagement_id}
                  onChange={e => setAddFindingForm(p => ({ ...p, engagement_id: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Select engagement…</option>
                  {engagements.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                <input placeholder="Finding ID (e.g. F-2024-001)" value={addFindingForm.finding_id}
                  onChange={e => setAddFindingForm(p => ({ ...p, finding_id: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
                <input placeholder="Title" value={addFindingForm.title}
                  onChange={e => setAddFindingForm(p => ({ ...p, title: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 col-span-2" />
                <select value={addFindingForm.severity}
                  onChange={e => setAddFindingForm(p => ({ ...p, severity: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['critical','high','medium','low','informational'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input placeholder="Category" value={addFindingForm.category}
                  onChange={e => setAddFindingForm(p => ({ ...p, category: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
                <input placeholder="Owner" value={addFindingForm.owner}
                  onChange={e => setAddFindingForm(p => ({ ...p, owner: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
                <input type="date" placeholder="Due date" value={addFindingForm.due_date}
                  onChange={e => setAddFindingForm(p => ({ ...p, due_date: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <textarea placeholder="Description" value={addFindingForm.description} rows={2}
                onChange={e => setAddFindingForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 mb-3" />
              <button onClick={submitFinding} disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Add Finding
              </button>
            </div>
          </div>
        )}

        {/* Schedule Audit */}
        {tab === 'schedule' && (
          <div className={glass}>
            <h2 className="text-white font-bold text-lg mb-4">Schedule Audit</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Audit title" value={scheduleForm.title}
                onChange={e => setScheduleForm(p => ({ ...p, title: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <select value={scheduleForm.audit_type}
                onChange={e => setScheduleForm(p => ({ ...p, audit_type: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['internal','external','regulatory','iso_certification','penetration','financial'].map(t =>
                  <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
              <input placeholder="Auditor name" value={scheduleForm.auditor_name}
                onChange={e => setScheduleForm(p => ({ ...p, auditor_name: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <input placeholder="Auditor firm" value={scheduleForm.auditor_firm}
                onChange={e => setScheduleForm(p => ({ ...p, auditor_firm: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <div>
                <label className="text-white/50 text-xs mb-1 block">Start date</label>
                <input type="date" value={scheduleForm.start_date}
                  onChange={e => setScheduleForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">End date</label>
                <input type="date" value={scheduleForm.end_date}
                  onChange={e => setScheduleForm(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <textarea placeholder="Scope description" value={scheduleForm.scope} rows={3}
                onChange={e => setScheduleForm(p => ({ ...p, scope: e.target.value }))}
                className="col-span-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
            </div>
            <button onClick={scheduleAudit} disabled={submitting}
              className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              Schedule Audit
            </button>
          </div>
        )}

        {/* Risk Heatmap */}
        {tab === 'heatmap' && (
          <div className={glass}>
            <h2 className="text-white font-bold text-lg mb-2">Risk Heatmap</h2>
            <p className="text-white/50 text-sm mb-6">Open findings plotted by impact (Y) × likelihood (X)</p>
            <div className="flex gap-4">
              <div className="flex flex-col justify-center gap-1 text-white/50 text-xs text-right w-16">
                <span>High</span>
                <span>Med</span>
                <span>Low</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-rows-3 gap-1">
                  {[2, 1, 0].map(imp => (
                    <div key={imp} className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map(lik => {
                        const cellFindings = heatmapGrid[imp][lik];
                        return (
                          <div key={lik} className={`${HEATMAP_COLORS[imp][lik]} rounded-xl p-3 min-h-[80px] flex flex-col items-center justify-center`}>
                            {cellFindings.length > 0 ? (
                              <>
                                <span className="text-2xl font-bold text-white">{cellFindings.length}</span>
                                <span className="text-xs text-white/70 mt-1">{cellFindings.length === 1 ? 'finding' : 'findings'}</span>
                                <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                                  {cellFindings.slice(0, 3).map(f => (
                                    <span key={f.id} className="text-xs text-white/60 truncate max-w-[60px]" title={f.title}>●</span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <span className="text-white/20 text-xs">empty</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {['Low', 'Med', 'High'].map(l => (
                    <div key={l} className="text-center text-white/50 text-xs">{l}</div>
                  ))}
                </div>
                <p className="text-center text-white/30 text-xs mt-1">Likelihood →</p>
              </div>
            </div>
          </div>
        )}

        {/* Remediation Tracker */}
        {tab === 'remediation' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Open', value: openFindings.length, color: 'border-l-4 border-red-500 bg-red-500/10' },
                { label: 'Overdue', value: overdue.length, color: 'border-l-4 border-orange-500 bg-orange-500/10' },
                { label: 'In Remediation', value: openFindings.filter(f => f.status === 'in_remediation').length, color: 'border-l-4 border-amber-500 bg-amber-500/10' },
                { label: 'Resolved (30d)', value: resolvedLast30.length, color: 'border-l-4 border-green-500 bg-green-500/10' },
              ].map(kpi => (
                <div key={kpi.label} className={`${glass} ${kpi.color}`}>
                  <p className="text-white/60 text-sm">{kpi.label}</p>
                  <p className="text-3xl font-bold text-white mt-1">{kpi.value}</p>
                </div>
              ))}
            </div>

            {findings.length > 0 && (
              <div className={glass}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-white font-semibold flex-1">Overall Progress</h3>
                  <span className="text-white/60 text-sm">{resolvedLast30.length}/{findings.length} resolved</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.round((resolvedLast30.length / findings.length) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-4">Open Findings — Remediation Queue</h2>
              {openFindings.length === 0 ? (
                <p className="text-white/40">No open findings. Excellent.</p>
              ) : (
                <div className="space-y-2">
                  {openFindings.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).map(f => {
                    const daysLeft = f.due_date ? Math.ceil((new Date(f.due_date).getTime() - Date.now()) / 86400000) : null;
                    return (
                      <div key={f.id} className="bg-white/5 rounded-xl p-4 flex items-start gap-4">
                        <span className="text-xl">{SEVERITY_ICON[f.severity] ?? '⚪'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-blue-300">{f.finding_id ?? `F-${f.id}`}</span>
                            <Badge label={f.status.replace('_',' ')} colorClass={STATUS_COLOR[f.status] ?? 'bg-gray-500/30 text-gray-200'} />
                            {daysLeft !== null && (
                              <span className={`text-xs font-semibold ${daysLeft < 0 ? 'text-red-300' : daysLeft < 7 ? 'text-amber-300' : 'text-white/50'}`}>
                                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                              </span>
                            )}
                          </div>
                          <p className="text-white text-sm font-medium">{f.title}</p>
                          {f.remediation_plan && <p className="text-white/50 text-xs mt-1 truncate">{f.remediation_plan}</p>}
                          {f.owner && <p className="text-white/40 text-xs mt-1">👤 {f.owner}</p>}
                        </div>
                        <button
                          onClick={() => setUpdateFinding({ id: f.id, status: f.status, remediation_plan: f.remediation_plan ?? '', owner: f.owner ?? '' })}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">
                          Update
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
