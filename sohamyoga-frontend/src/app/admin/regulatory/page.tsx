'use client';

import { useState, useEffect, useCallback } from 'react';

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'radar' | 'euaiact' | 'actions' | 'manage' | 'calendar';

interface Regulation {
  id: number;
  name: string;
  jurisdiction: string | null;
  category: string;
  effective_date: string | null;
  compliance_deadline: string | null;
  status: string;
  impact_level: string;
  description: string | null;
  key_requirements: string[] | null;
  penalty_max: string | null;
  our_exposure: string | null;
  action_items: string[] | null;
  owner: string | null;
  last_reviewed_at: string | null;
  source_url: string | null;
}

const IMPACT_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
const IMPACT_COLOR: Record<string, string> = {
  critical: 'bg-red-500/30 text-red-200 border border-red-500/40',
  high: 'bg-orange-500/30 text-orange-200 border border-orange-500/40',
  medium: 'bg-amber-500/30 text-amber-200 border border-amber-500/40',
  low: 'bg-green-500/30 text-green-200 border border-green-500/40',
};
const STATUS_COLOR: Record<string, string> = {
  action_required: 'bg-red-500/30 text-red-200',
  monitoring: 'bg-blue-500/30 text-blue-200',
  compliant: 'bg-green-500/30 text-green-200',
  non_compliant: 'bg-red-600/40 text-red-100',
  exempt: 'bg-gray-500/30 text-gray-300',
  in_progress: 'bg-amber-500/30 text-amber-200',
};
const JURISDICTION_COLOR: Record<string, string> = {
  EU: 'bg-blue-600/40 text-blue-200',
  US: 'bg-red-600/30 text-red-200',
  'US-CA': 'bg-orange-600/30 text-orange-200',
  UK: 'bg-indigo-600/30 text-indigo-200',
  CA: 'bg-red-700/30 text-red-300',
  IN: 'bg-green-600/30 text-green-200',
  Global: 'bg-purple-600/30 text-purple-200',
  Multi: 'bg-teal-600/30 text-teal-200',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const EU_AI_ACT_TIMELINE = [
  { date: 'Aug 2024', label: 'EU AI Act in force', done: true },
  { date: 'Feb 2025', label: 'Prohibited practices apply', done: true },
  { date: 'Aug 2025', label: 'GPAI model obligations', done: false },
  { date: 'Aug 2026', label: 'Full application', done: false },
];

const EU_AI_ACT_CHECKLIST = [
  'Identify all AI systems and classify by risk tier',
  'Implement transparency for limited-risk AI (chatbots, deepfakes)',
  'Register high-risk AI systems in EU database',
  'Establish human oversight mechanisms for high-risk AI',
  'Maintain technical documentation for high-risk systems',
  'Conduct conformity assessments before deployment',
  'Implement post-market monitoring for high-risk AI',
  'Establish incident reporting procedures',
  'Ensure prohibited AI practices are not implemented',
  'Appoint EU authorized representative if needed',
];

export default function RegulatoryPage() {
  const [tab, setTab] = useState<Tab>('radar');
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const [addForm, setAddForm] = useState({
    name: '', jurisdiction: '', category: 'ai', effective_date: '', compliance_deadline: '',
    impact_level: 'medium', description: '', penalty_max: '', our_exposure: '', status: 'monitoring',
  });
  const [updateForm, setUpdateForm] = useState<{ id: number | null; status: string; impact_level: string; our_exposure: string; owner: string; compliance_deadline: string }>({
    id: null, status: '', impact_level: '', our_exposure: '', owner: '', compliance_deadline: '',
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadRegulations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/regulatory');
      if (r.ok) { const d = await r.json(); setRegulations(d.regulations || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRegulations(); }, [loadRegulations]);

  const createRegulation = async () => {
    if (!addForm.name) return showToast('Name required');
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/regulatory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (r.ok) {
        showToast('Regulation added');
        loadRegulations();
        setAddForm({ name: '', jurisdiction: '', category: 'ai', effective_date: '', compliance_deadline: '', impact_level: 'medium', description: '', penalty_max: '', our_exposure: '', status: 'monitoring' });
      }
    } finally { setSubmitting(false); }
  };

  const updateRegulation = async () => {
    if (!updateForm.id) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/regulatory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (r.ok) { showToast('Updated'); loadRegulations(); setUpdateForm({ id: null, status: '', impact_level: '', our_exposure: '', owner: '', compliance_deadline: '' }); }
    } finally { setSubmitting(false); }
  };

  const grouped = ['critical', 'high', 'medium', 'low'].reduce<Record<string, Regulation[]>>((acc, level) => {
    acc[level] = regulations.filter(r => r.impact_level === level);
    return acc;
  }, {});

  const euAiAct = regulations.find(r => r.name === 'EU AI Act');

  const actionItems = regulations
    .filter(r => ['action_required', 'monitoring'].includes(r.status) && r.action_items && r.action_items.length > 0)
    .flatMap(r => (r.action_items ?? []).map(a => ({ regulation: r, action: a })));

  const sortedByDeadline = [...regulations].sort((a, b) => {
    if (!a.compliance_deadline && !b.compliance_deadline) return 0;
    if (!a.compliance_deadline) return 1;
    if (!b.compliance_deadline) return -1;
    return a.compliance_deadline.localeCompare(b.compliance_deadline);
  });

  const deadlineSoon = sortedByDeadline.filter(r => {
    const days = daysUntil(r.compliance_deadline);
    return days !== null && days <= 90;
  });
  const futureDeadlines = sortedByDeadline.filter(r => {
    const days = daysUntil(r.compliance_deadline);
    return days !== null && days > 90;
  });
  const noDeadline = sortedByDeadline.filter(r => !r.compliance_deadline);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Update Modal */}
      {updateForm.id && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className={`${glass} w-full max-w-md`}>
            <h3 className="text-white font-bold mb-4">Update Regulation</h3>
            <div className="space-y-3">
              <select value={updateForm.status} onChange={e => setUpdateForm(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['monitoring','action_required','compliant','non_compliant','exempt','in_progress'].map(s =>
                  <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
              <select value={updateForm.impact_level} onChange={e => setUpdateForm(p => ({ ...p, impact_level: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['low','medium','high','critical'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input placeholder="Owner" value={updateForm.owner} onChange={e => setUpdateForm(p => ({ ...p, owner: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <input type="date" value={updateForm.compliance_deadline} onChange={e => setUpdateForm(p => ({ ...p, compliance_deadline: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              <textarea placeholder="Our exposure / notes" value={updateForm.our_exposure} rows={3}
                onChange={e => setUpdateForm(p => ({ ...p, our_exposure: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={updateRegulation} disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setUpdateForm({ id: null, status: '', impact_level: '', our_exposure: '', owner: '', compliance_deadline: '' })}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className={glass}>
          <h1 className="text-2xl font-bold text-white">⚖️ Regulatory Tracker</h1>
          <p className="text-white/60 text-sm mt-1">EU AI Act · GDPR · CCPA · NIST AI RMF · Digital Markets Act · CAN-SPAM</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['radar','euaiact','actions','manage','calendar'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
              {t === 'radar' ? '📡 Regulatory Radar' : t === 'euaiact' ? '🇪🇺 EU AI Act' : t === 'actions' ? '✅ Action Items' : t === 'manage' ? '➕ Add / Update' : '📅 Calendar'}
            </button>
          ))}
        </div>

        {/* Regulatory Radar */}
        {tab === 'radar' && (
          <div className="space-y-6">
            {loading ? (
              <div className={`${glass} text-center text-white/40`}>Loading regulations…</div>
            ) : (['critical','high','medium','low'] as const).map(level => (
              grouped[level]?.length > 0 && (
                <div key={level}>
                  <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wider mb-3">
                    {level === 'critical' ? '🔴' : level === 'high' ? '🟠' : level === 'medium' ? '🟡' : '🟢'} {level} Impact
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {grouped[level].map(reg => (
                      <div key={reg.id} className={`${glass} ${level === 'critical' ? 'ring-1 ring-red-500/30' : ''}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex flex-wrap gap-1">
                            {reg.jurisdiction && (
                              <Badge label={reg.jurisdiction} colorClass={JURISDICTION_COLOR[reg.jurisdiction] ?? 'bg-gray-500/30 text-gray-200'} />
                            )}
                            <Badge label={reg.category} colorClass="bg-white/10 text-white/70" />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${reg.status === 'action_required' ? 'animate-pulse bg-red-500/40 text-red-200' : STATUS_COLOR[reg.status] ?? 'bg-gray-500/30 text-gray-200'}`}>
                            {reg.status.replace('_',' ')}
                          </span>
                        </div>
                        <h3 className="text-white font-semibold text-sm mb-3">{reg.name}</h3>
                        {reg.key_requirements && reg.key_requirements.length > 0 && (
                          <ul className="space-y-1">
                            {reg.key_requirements.slice(0, 3).map((req, i) => (
                              <li key={i} className="text-white/50 text-xs flex gap-2">
                                <span className="text-white/30 shrink-0">▸</span>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {reg.penalty_max && (
                          <p className="text-red-300 text-xs mt-3 font-medium">⚠️ Max penalty: {reg.penalty_max}</p>
                        )}
                        <button
                          onClick={() => setUpdateForm({ id: reg.id, status: reg.status, impact_level: reg.impact_level, our_exposure: reg.our_exposure ?? '', owner: reg.owner ?? '', compliance_deadline: reg.compliance_deadline ?? '' })}
                          className="mt-3 text-xs bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1 rounded-lg">
                          Update
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* EU AI Act Focus */}
        {tab === 'euaiact' && (
          <div className="space-y-4">
            <div className={glass}>
              <h2 className="text-white font-bold text-lg mb-4">🇪🇺 EU AI Act — Compliance Roadmap</h2>
              {euAiAct && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge label={`Status: ${euAiAct.status.replace('_',' ')}`} colorClass={`${STATUS_COLOR[euAiAct.status] ?? 'bg-gray-500/30 text-gray-200'} animate-pulse`} />
                  <Badge label={`Impact: ${euAiAct.impact_level}`} colorClass={IMPACT_COLOR[euAiAct.impact_level] ?? 'bg-gray-500/30 text-gray-200'} />
                  {euAiAct.penalty_max && <Badge label={`Max penalty: ${euAiAct.penalty_max}`} colorClass="bg-red-500/20 text-red-300" />}
                </div>
              )}

              {/* Timeline */}
              <h3 className="text-white/70 text-sm font-semibold mb-3 uppercase tracking-wider">Implementation Timeline</h3>
              <div className="flex flex-wrap gap-0 mb-6">
                {EU_AI_ACT_TIMELINE.map((item, i) => (
                  <div key={i} className="flex items-center gap-0">
                    <div className={`flex flex-col items-center ${i > 0 ? 'ml-0' : ''}`}>
                      <div className={`w-4 h-4 rounded-full border-2 ${item.done ? 'bg-green-500 border-green-400' : 'bg-white/20 border-white/40'}`} />
                      <div className="mt-2 text-center max-w-[90px]">
                        <p className={`text-xs font-semibold ${item.done ? 'text-green-300' : 'text-white/60'}`}>{item.date}</p>
                        <p className="text-xs text-white/40 leading-tight">{item.label}</p>
                      </div>
                    </div>
                    {i < EU_AI_ACT_TIMELINE.length - 1 && (
                      <div className={`h-0.5 w-16 md:w-24 mb-6 ${item.done ? 'bg-green-500/60' : 'bg-white/20'}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* AI Risk Classification */}
              <h3 className="text-white/70 text-sm font-semibold mb-3 uppercase tracking-wider">AI Risk Tiers</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { tier: 'Unacceptable', color: 'bg-red-500/30 border-red-500/40', desc: 'Prohibited. Social scoring, real-time biometric surveillance.' },
                  { tier: 'High Risk', color: 'bg-orange-500/30 border-orange-500/40', desc: 'Education, employment, critical infrastructure, law enforcement.' },
                  { tier: 'Limited Risk', color: 'bg-amber-500/30 border-amber-500/40', desc: 'Chatbots, emotion recognition. Transparency obligations.' },
                  { tier: 'Minimal Risk', color: 'bg-green-500/30 border-green-500/40', desc: 'Spam filters, AI-powered games. No mandatory requirements.' },
                ].map(({ tier, color, desc }) => (
                  <div key={tier} className={`border rounded-xl p-3 ${color}`}>
                    <p className="text-white font-semibold text-sm">{tier}</p>
                    <p className="text-white/50 text-xs mt-1">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Compliance Checklist */}
              <h3 className="text-white/70 text-sm font-semibold mb-3 uppercase tracking-wider">Our Compliance Checklist</h3>
              <div className="space-y-2">
                {EU_AI_ACT_CHECKLIST.map((item, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox"
                      checked={checkedItems.has(i)}
                      onChange={() => setCheckedItems(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                      className="mt-0.5 accent-emerald-400 w-4 h-4 rounded" />
                    <span className={`text-sm ${checkedItems.has(i) ? 'text-white/40 line-through' : 'text-white/80'}`}>{item}</span>
                  </label>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-3">
                {checkedItems.size}/{EU_AI_ACT_CHECKLIST.length} completed
              </p>
            </div>
          </div>
        )}

        {/* Action Items */}
        {tab === 'actions' && (
          <div className={glass}>
            <h2 className="text-white font-bold text-lg mb-4">Aggregated Action Items</h2>
            <p className="text-white/50 text-sm mb-4">From regulations with status: action_required or monitoring</p>
            {actionItems.length === 0 ? (
              <p className="text-white/40">No action items found. Add action_items to regulations via the manage tab.</p>
            ) : (
              <div className="space-y-2">
                {actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <Badge
                      label={item.regulation.impact_level}
                      colorClass={IMPACT_COLOR[item.regulation.impact_level] ?? 'bg-gray-500/30 text-gray-200'}
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm">{item.action}</p>
                      <p className="text-white/40 text-xs mt-1">{item.regulation.name}</p>
                    </div>
                    {item.regulation.compliance_deadline && (
                      <span className={`text-xs shrink-0 ${(() => { const d = daysUntil(item.regulation.compliance_deadline); return d !== null && d < 90 ? 'text-red-300' : 'text-white/40'; })()}`}>
                        due {new Date(item.regulation.compliance_deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add / Update */}
        {tab === 'manage' && (
          <div className={glass}>
            <h2 className="text-white font-bold text-lg mb-4">Add Regulation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Regulation name" value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <input placeholder="Jurisdiction (EU, US, CA, UK…)" value={addForm.jurisdiction}
                onChange={e => setAddForm(p => ({ ...p, jurisdiction: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <select value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['ai','privacy','security','financial','employment','marketing'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={addForm.impact_level} onChange={e => setAddForm(p => ({ ...p, impact_level: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['low','medium','high','critical'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={addForm.status} onChange={e => setAddForm(p => ({ ...p, status: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                {['monitoring','action_required','compliant','non_compliant','exempt','in_progress'].map(s =>
                  <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
              <input placeholder="Max penalty (e.g. €20M or 4%)" value={addForm.penalty_max}
                onChange={e => setAddForm(p => ({ ...p, penalty_max: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <div>
                <label className="text-white/50 text-xs mb-1 block">Effective date</label>
                <input type="date" value={addForm.effective_date}
                  onChange={e => setAddForm(p => ({ ...p, effective_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Compliance deadline</label>
                <input type="date" value={addForm.compliance_deadline}
                  onChange={e => setAddForm(p => ({ ...p, compliance_deadline: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <textarea placeholder="Description" value={addForm.description} rows={2}
                onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                className="col-span-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
              <textarea placeholder="Our exposure (how does this affect us?)" value={addForm.our_exposure} rows={2}
                onChange={e => setAddForm(p => ({ ...p, our_exposure: e.target.value }))}
                className="col-span-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40" />
            </div>
            <button onClick={createRegulation} disabled={submitting}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              Add Regulation
            </button>

            {/* Existing list for quick update */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-white/70 font-semibold text-sm mb-3">Existing Regulations — Quick Update</h3>
              <div className="space-y-2">
                {regulations.sort((a, b) => (IMPACT_ORDER[a.impact_level] ?? 9) - (IMPACT_ORDER[b.impact_level] ?? 9)).map(reg => (
                  <div key={reg.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2">
                    <span className="text-white text-sm flex-1 truncate">{reg.name}</span>
                    <Badge label={reg.status.replace('_',' ')} colorClass={STATUS_COLOR[reg.status] ?? 'bg-gray-500/30 text-gray-200'} />
                    <button
                      onClick={() => setUpdateForm({ id: reg.id, status: reg.status, impact_level: reg.impact_level, our_exposure: reg.our_exposure ?? '', owner: reg.owner ?? '', compliance_deadline: reg.compliance_deadline ?? '' })}
                      className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg">
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compliance Calendar */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            {deadlineSoon.length > 0 && (
              <div className={glass}>
                <h2 className="text-white font-bold text-lg mb-4 text-red-300">⚠️ Deadlines in Next 90 Days</h2>
                <div className="space-y-2">
                  {deadlineSoon.map(reg => {
                    const days = daysUntil(reg.compliance_deadline);
                    return (
                      <div key={reg.id} className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                        <span className={`text-xs font-bold w-20 ${days !== null && days < 30 ? 'text-red-300' : 'text-amber-300'}`}>
                          {days !== null ? (days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`) : '—'}
                        </span>
                        <span className="text-white font-medium text-sm flex-1">{reg.name}</span>
                        <span className="text-white/50 text-xs">{reg.compliance_deadline ? new Date(reg.compliance_deadline).toLocaleDateString() : '—'}</span>
                        <Badge label={reg.status.replace('_',' ')} colorClass={STATUS_COLOR[reg.status] ?? 'bg-gray-500/30 text-gray-200'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {futureDeadlines.length > 0 && (
              <div className={glass}>
                <h2 className="text-white font-bold text-lg mb-4">Future Deadlines</h2>
                <div className="space-y-2">
                  {futureDeadlines.map(reg => {
                    const days = daysUntil(reg.compliance_deadline);
                    return (
                      <div key={reg.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                        <span className="text-white/50 text-xs font-semibold w-20">{days !== null ? `${days}d` : '—'}</span>
                        <span className="text-white text-sm flex-1">{reg.name}</span>
                        <span className="text-white/40 text-xs">{reg.compliance_deadline ? new Date(reg.compliance_deadline).toLocaleDateString() : '—'}</span>
                        <Badge label={reg.status.replace('_',' ')} colorClass={STATUS_COLOR[reg.status] ?? 'bg-gray-500/30 text-gray-200'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {noDeadline.length > 0 && (
              <div className={glass}>
                <h2 className="text-white/70 font-semibold text-lg mb-4">No Deadline Set</h2>
                <div className="space-y-2">
                  {noDeadline.map(reg => (
                    <div key={reg.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                      <span className="text-white/30 text-xs w-20">ongoing</span>
                      <span className="text-white/70 text-sm flex-1">{reg.name}</span>
                      <Badge label={reg.status.replace('_',' ')} colorClass={STATUS_COLOR[reg.status] ?? 'bg-gray-500/30 text-gray-200'} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && deadlineSoon.length === 0 && futureDeadlines.length === 0 && noDeadline.length === 0 && (
              <div className={`${glass} text-center text-white/40`}>No regulations loaded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
