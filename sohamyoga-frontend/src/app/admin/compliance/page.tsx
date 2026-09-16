'use client';

import { useState, useEffect, useCallback } from 'react';

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'frameworks' | 'iso42001' | 'controls' | 'evidence' | 'calendar' | 'readiness';

interface Framework {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string;
  version: string;
  status: string;
  compliance_score: number;
  computed_score: number;
  total_controls: number;
  implemented_controls: number;
  last_assessed_at: string | null;
  next_review_date: string | null;
  certification_date: string | null;
  certifying_body: string | null;
  notes: string | null;
}

interface Control {
  id: number;
  framework_id: number;
  framework_code: string;
  framework_name: string;
  control_id: string;
  control_name: string;
  description: string;
  category: string;
  status: string;
  evidence_url: string | null;
  evidence_notes: string | null;
  owner: string | null;
  due_date: string | null;
  last_updated_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  ai: 'bg-purple-500/30 text-purple-200',
  security: 'bg-blue-500/30 text-blue-200',
  privacy: 'bg-green-500/30 text-green-200',
  financial: 'bg-amber-500/30 text-amber-200',
  healthcare: 'bg-pink-500/30 text-pink-200',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-500/30 text-gray-200',
  in_progress: 'bg-blue-500/30 text-blue-200',
  compliant: 'bg-green-500/30 text-green-200',
  certified: 'bg-emerald-500/30 text-emerald-200',
  non_compliant: 'bg-red-500/30 text-red-200',
  implemented: 'bg-green-500/30 text-green-200',
  not_applicable: 'bg-gray-400/30 text-gray-300',
  failed: 'bg-red-500/30 text-red-200',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function daysBadgeColor(days: number | null): string {
  if (days === null) return 'text-white/40';
  if (days < 7) return 'text-red-300';
  if (days < 30) return 'text-amber-300';
  return 'text-green-300';
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('frameworks');
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedFwId, setSelectedFwId] = useState<number | null>(null);
  const [controlFilter, setControlFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({});
  const [evidenceForm, setEvidenceForm] = useState<{ controlId: number | null; url: string; notes: string }>({ controlId: null, url: '', notes: '' });
  const [newFwForm, setNewFwForm] = useState({ code: '', name: '', category: 'ai', description: '', version: '', total_controls: '' });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadFrameworks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/compliance');
      if (r.ok) { const d = await r.json(); setFrameworks(d.frameworks || []); }
    } finally { setLoading(false); }
  }, []);

  const loadControls = useCallback(async (fwId?: number) => {
    const url = fwId ? `/api/admin/compliance/controls?framework_id=${fwId}` : '/api/admin/compliance/controls';
    const r = await fetch(url);
    if (r.ok) { const d = await r.json(); setControls(d.controls || []); }
  }, []);

  useEffect(() => { loadFrameworks(); loadControls(); }, [loadFrameworks, loadControls]);

  const updateControlStatus = async (id: number, status: string, owner?: string) => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/compliance/controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, owner }),
      });
      if (r.ok) { showToast('Control updated'); loadControls(selectedFwId ?? undefined); }
    } finally { setSubmitting(false); }
  };

  const addEvidence = async () => {
    if (!evidenceForm.controlId) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/compliance/controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evidenceForm.controlId, evidence_url: evidenceForm.url, evidence_notes: evidenceForm.notes }),
      });
      if (r.ok) { showToast('Evidence saved'); setEvidenceForm({ controlId: null, url: '', notes: '' }); loadControls(); }
    } finally { setSubmitting(false); }
  };

  const createFramework = async () => {
    if (!newFwForm.code || !newFwForm.name) return showToast('Code and name required');
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newFwForm, total_controls: Number(newFwForm.total_controls) || 0 }),
      });
      if (r.ok) { showToast('Framework created'); loadFrameworks(); setNewFwForm({ code: '', name: '', category: 'ai', description: '', version: '', total_controls: '' }); }
    } finally { setSubmitting(false); }
  };

  const downloadReport = () => {
    const lines: string[] = ['COMPLIANCE REPORT', `Generated: ${new Date().toLocaleString()}`, '='.repeat(60), ''];
    frameworks.forEach(fw => {
      const score = fw.computed_score ?? fw.compliance_score;
      lines.push(`${fw.code} — ${fw.name}`);
      lines.push(`  Category: ${fw.category} | Status: ${fw.status}`);
      lines.push(`  Score: ${score}% (${fw.implemented_controls}/${fw.total_controls} controls)`);
      if (fw.next_review_date) lines.push(`  Next Review: ${fw.next_review_date}`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const iso42001Controls = controls.filter(c => c.framework_code === 'ISO_42001');
  const filteredControls = controls.filter(c =>
    (!selectedFwId || c.framework_id === selectedFwId) &&
    (!controlFilter || c.status === controlFilter)
  );
  const evidenceControls = controls.filter(c => c.evidence_url || c.evidence_notes);

  const thisMonthDue = controls.filter(c => {
    if (!c.due_date) return false;
    const d = new Date(c.due_date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

  const fwDueDates = frameworks.filter(f => f.next_review_date).sort((a, b) =>
    (a.next_review_date ?? '').localeCompare(b.next_review_date ?? ''));

  // Readiness stats per framework
  const fwReadiness = frameworks.map(fw => {
    const fwControls = controls.filter(c => c.framework_id === fw.id);
    const total = fwControls.length || 1;
    const implemented = fwControls.filter(c => c.status === 'implemented').length;
    const withEvidence = fwControls.filter(c => c.evidence_url || c.evidence_notes).length;
    const withOwner = fwControls.filter(c => c.owner).length;
    const pastDue = fwControls.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'implemented').length;
    return {
      fw,
      implPct: Math.round((implemented / total) * 100),
      evidPct: Math.round((withEvidence / total) * 100),
      ownerPct: Math.round((withOwner / total) * 100),
      pastDuePct: Math.round((pastDue / total) * 100),
    };
  });

  const totalControls = controls.length || 1;
  const overallScore = Math.round(
    (controls.filter(c => c.status === 'implemented').length / totalControls) * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className={glass}>
          <h1 className="text-2xl font-bold text-white">📋 Compliance Management</h1>
          <p className="text-white/60 text-sm mt-1">ISO 42001 · ISO 27001 · GDPR · SOC2 · CCPA · NIST AI RMF · PCI DSS</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['frameworks','iso42001','controls','evidence','calendar','readiness'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
              {t === 'frameworks' ? '🏛 Frameworks' : t === 'iso42001' ? '🤖 ISO 42001' : t === 'controls' ? '🎛 Controls' : t === 'evidence' ? '📁 Evidence' : t === 'calendar' ? '📅 Calendar' : '✅ Readiness'}
            </button>
          ))}
        </div>

        {/* Framework Overview */}
        {tab === 'frameworks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {loading ? (
                <div className={`${glass} col-span-3 text-center text-white/60`}>Loading frameworks…</div>
              ) : frameworks.map(fw => {
                const score = fw.computed_score ?? fw.compliance_score;
                return (
                  <div key={fw.id} className={`${glass} cursor-pointer hover:bg-white/15 transition-all`}
                    onClick={() => { setSelectedFwId(fw.id); setTab('controls'); loadControls(fw.id); }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-xs bg-white/20 text-white px-2 py-0.5 rounded">{fw.code}</span>
                        <Badge label={fw.category} colorClass={`ml-2 ${CATEGORY_COLORS[fw.category] ?? 'bg-gray-500/30 text-gray-200'}`} />
                      </div>
                      <Badge label={fw.status.replace('_', ' ')} colorClass={STATUS_COLORS[fw.status] ?? 'bg-gray-500/30 text-gray-200'} />
                    </div>
                    <h3 className="text-white font-semibold text-sm leading-tight mb-3">{fw.name}</h3>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-white/60 mb-1">
                        <span>{fw.implemented_controls}/{fw.total_controls} controls</span>
                        <span>{score}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${scoreColor(score)} transition-all`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    {fw.next_review_date && (
                      <p className="text-xs text-white/40 mt-2">Next review: {new Date(fw.next_review_date).toLocaleDateString()}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add new framework */}
            <div className={glass}>
              <h2 className="text-white font-semibold mb-4">Add Framework</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(['code','name','version','total_controls'] as const).map(field => (
                  <input key={field} placeholder={field.replace('_',' ')} value={newFwForm[field]}
                    onChange={e => setNewFwForm(p => ({ ...p, [field]: e.target.value }))}
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
                ))}
                <select value={newFwForm.category} onChange={e => setNewFwForm(p => ({ ...p, category: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['ai','security','privacy','financial','healthcare'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input placeholder="description" value={newFwForm.description}
                  onChange={e => setNewFwForm(p => ({ ...p, description: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              </div>
              <button onClick={createFramework} disabled={submitting}
                className="mt-3 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Create Framework
              </button>
            </div>
          </div>
        )}

        {/* ISO 42001 Deep Dive */}
        {tab === 'iso42001' && (
          <div className="space-y-4">
            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-1">ISO/IEC 42001:2023 — AI Management System</h2>
              <p className="text-white/60 text-sm">International standard for responsible AI governance. 10 core control domains.</p>
            </div>
            {iso42001Controls.length === 0 ? (
              <div className={`${glass} text-center text-white/40`}>No ISO 42001 controls loaded. Visit Frameworks tab to trigger seeding.</div>
            ) : (
              Object.entries(
                iso42001Controls.reduce<Record<string, Control[]>>((acc, c) => {
                  const cat = c.category || 'General';
                  return { ...acc, [cat]: [...(acc[cat] || []), c] };
                }, {})
              ).map(([cat, catControls]) => (
                <div key={cat} className={glass}>
                  <h3 className="text-purple-300 font-semibold text-sm mb-3">{cat}</h3>
                  <div className="space-y-3">
                    {catControls.map(c => (
                      <div key={c.id} className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono text-xs text-purple-300">{c.control_id}</span>
                            <span className="text-white font-medium text-sm ml-2">{c.control_name}</span>
                          </div>
                          <Badge label={c.status.replace('_',' ')} colorClass={STATUS_COLORS[c.status] ?? 'bg-gray-500/30 text-gray-200'} />
                        </div>
                        {c.description && <p className="text-white/50 text-xs mb-2">{c.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          {c.owner && <span className="text-xs text-white/40">👤 {c.owner}</span>}
                          {c.evidence_notes && <span className="text-xs text-white/40">📎 Evidence attached</span>}
                          {c.due_date && <span className="text-xs text-white/40">📅 {new Date(c.due_date).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {['not_started','in_progress','implemented','not_applicable'].map(s => (
                            <button key={s} onClick={() => updateControlStatus(c.id, s)}
                              className={`text-xs px-2 py-1 rounded-lg ${c.status === s ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                              {s.replace('_',' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Controls Tracker */}
        {tab === 'controls' && (
          <div className={glass}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-white font-bold text-lg flex-1">Controls Tracker</h2>
              <select
                value={selectedFwId ?? ''}
                onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setSelectedFwId(v); loadControls(v ?? undefined); }}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">All Frameworks</option>
                {frameworks.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}
              </select>
              <select value={controlFilter} onChange={e => setControlFilter(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">All Statuses</option>
                {['not_started','in_progress','implemented','not_applicable','failed'].map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50 border-b border-white/10 text-left">
                    <th className="pb-2 pr-3">ID</th>
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Category</th>
                    <th className="pb-2 pr-3">Framework</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Owner</th>
                    <th className="pb-2 pr-3">Due Date</th>
                    <th className="pb-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControls.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3 font-mono text-xs text-purple-300">{c.control_id}</td>
                      <td className="py-2 pr-3 text-white">{c.control_name}</td>
                      <td className="py-2 pr-3 text-white/60 text-xs">{c.category}</td>
                      <td className="py-2 pr-3"><Badge label={c.framework_code} colorClass="bg-white/10 text-white/70" /></td>
                      <td className="py-2 pr-3"><Badge label={c.status.replace('_',' ')} colorClass={STATUS_COLORS[c.status] ?? 'bg-gray-500/30 text-gray-200'} /></td>
                      <td className="py-2 pr-3 text-white/60 text-xs">{c.owner ?? '—'}</td>
                      <td className="py-2 pr-3 text-white/60 text-xs">{c.due_date ? new Date(c.due_date).toLocaleDateString() : '—'}</td>
                      <td className="py-2">{(c.evidence_url || c.evidence_notes) ? '📎' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredControls.length === 0 && (
                <p className="text-center text-white/40 py-8">No controls match filters</p>
              )}
            </div>
          </div>
        )}

        {/* Evidence Vault */}
        {tab === 'evidence' && (
          <div className="space-y-4">
            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-4">Evidence Vault</h2>
              {evidenceControls.length === 0 ? (
                <p className="text-white/40 text-sm">No evidence attached to any controls yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 border-b border-white/10 text-left">
                      <th className="pb-2 pr-3">Control</th>
                      <th className="pb-2 pr-3">Framework</th>
                      <th className="pb-2 pr-3">Evidence URL</th>
                      <th className="pb-2 pr-3">Notes</th>
                      <th className="pb-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceControls.map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 font-mono text-xs text-purple-300">{c.control_id}</td>
                        <td className="py-2 pr-3"><Badge label={c.framework_code} colorClass="bg-white/10 text-white/70" /></td>
                        <td className="py-2 pr-3">
                          {c.evidence_url
                            ? <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline text-xs truncate block max-w-xs">{c.evidence_url}</a>
                            : <span className="text-white/30 text-xs">—</span>}
                        </td>
                        <td className="py-2 pr-3 text-white/60 text-xs max-w-xs truncate">{c.evidence_notes ?? '—'}</td>
                        <td className="py-2 text-white/40 text-xs">{new Date(c.last_updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={glass}>
              <h2 className="text-white font-semibold mb-4">Add Evidence</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={evidenceForm.controlId ?? ''}
                  onChange={e => setEvidenceForm(p => ({ ...p, controlId: e.target.value ? Number(e.target.value) : null }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Select control…</option>
                  {controls.map(c => <option key={c.id} value={c.id}>{c.control_id} — {c.control_name}</option>)}
                </select>
                <input placeholder="Evidence URL" value={evidenceForm.url}
                  onChange={e => setEvidenceForm(p => ({ ...p, url: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
                <input placeholder="Notes" value={evidenceForm.notes}
                  onChange={e => setEvidenceForm(p => ({ ...p, notes: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              </div>
              <button onClick={addEvidence} disabled={submitting || !evidenceForm.controlId}
                className="mt-3 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Save Evidence
              </button>
            </div>
          </div>
        )}

        {/* Compliance Calendar */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-4">Controls Due This Month</h2>
              {thisMonthDue.length === 0 ? (
                <p className="text-white/40 text-sm">No controls due this month.</p>
              ) : (
                <div className="space-y-2">
                  {thisMonthDue.map(c => {
                    const days = daysUntil(c.due_date);
                    return (
                      <div key={c.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                        <span className={`text-xs font-semibold w-16 ${daysBadgeColor(days)}`}>
                          {days !== null ? (days < 0 ? `${Math.abs(days)}d over` : `${days}d`) : '—'}
                        </span>
                        <span className="font-mono text-xs text-purple-300 w-24">{c.control_id}</span>
                        <span className="text-white text-sm flex-1">{c.control_name}</span>
                        <Badge label={c.framework_code} colorClass="bg-white/10 text-white/70" />
                        <Badge label={c.status.replace('_',' ')} colorClass={STATUS_COLORS[c.status] ?? 'bg-gray-500/30 text-gray-200'} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-4">Framework Review Dates</h2>
              <div className="space-y-2">
                {fwDueDates.map(fw => {
                  const days = daysUntil(fw.next_review_date);
                  return (
                    <div key={fw.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                      <span className={`text-xs font-semibold w-16 ${daysBadgeColor(days)}`}>
                        {days !== null ? (days < 0 ? `${Math.abs(days)}d over` : `${days}d`) : '—'}
                      </span>
                      <span className="text-white text-sm flex-1">{fw.name}</span>
                      <Badge label={fw.category} colorClass={CATEGORY_COLORS[fw.category] ?? 'bg-gray-500/30 text-gray-200'} />
                      <Badge label={fw.status.replace('_',' ')} colorClass={STATUS_COLORS[fw.status] ?? 'bg-gray-500/30 text-gray-200'} />
                    </div>
                  );
                })}
                {fwDueDates.length === 0 && <p className="text-white/40 text-sm">No review dates set.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Audit Readiness */}
        {tab === 'readiness' && (
          <div className="space-y-4">
            <div className={`${glass} flex items-center justify-between`}>
              <div>
                <h2 className="text-white font-bold text-lg">Audit Readiness</h2>
                <p className="text-white/50 text-sm mt-1">Overall readiness: <span className={`font-bold ${overallScore >= 80 ? 'text-green-300' : overallScore >= 50 ? 'text-amber-300' : 'text-red-300'}`}>{overallScore}%</span></p>
              </div>
              <button onClick={downloadReport}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Download Report
              </button>
            </div>

            {fwReadiness.map(({ fw, implPct, evidPct, ownerPct, pastDuePct }) => (
              <div key={fw.id} className={glass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{fw.code} — {fw.name}</h3>
                  <Badge label={fw.category} colorClass={CATEGORY_COLORS[fw.category] ?? 'bg-gray-500/30 text-gray-200'} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Implemented', pct: implPct, color: 'bg-green-500' },
                    { label: 'With Evidence', pct: evidPct, color: 'bg-blue-500' },
                    { label: 'Owner Assigned', pct: ownerPct, color: 'bg-purple-500' },
                    { label: 'Past Due', pct: pastDuePct, color: 'bg-red-500' },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-white/60 mb-1">
                        <span>{label}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {fwReadiness.length === 0 && <div className={`${glass} text-center text-white/40`}>Loading readiness data…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
