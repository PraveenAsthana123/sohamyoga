'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: number; first_name: string; last_name: string; email: string; phone: string;
  company: string; job_title: string; lead_source: string; lead_stage: string;
  lead_score: number; assigned_to: string; notes: string; tags: string;
  utm_source: string; utm_medium: string; utm_campaign: string;
  deal_value: number; last_contact_at: string | null; created_at: string;
}

interface LeadActivity {
  id: number; lead_id: number; activity_type: string; description: string;
  outcome: string; created_by: string; created_at: string;
}

interface LeadForm {
  id: number; form_name: string; source_page: string; submissions: number;
  conversions: number; is_active: boolean; created_at: string;
}

interface QualifyResult {
  qualification_score?: number; qualification_level?: string;
  next_best_action?: string; email_draft?: string;
  subject?: string; body?: string; result?: {
    qualification_score?: number; qualification_level?: string;
    next_best_action?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

function stageBg(s: string) {
  const m: Record<string, string> = {
    new: 'bg-gray-100', contacted: 'bg-blue-50', qualified: 'bg-indigo-50',
    proposal: 'bg-purple-50', negotiation: 'bg-yellow-50',
    won: 'bg-green-50', lost: 'bg-red-50',
  };
  return m[s] ?? 'bg-gray-100';
}

function stageBadge(s: string) {
  const m: Record<string, string> = {
    new: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-100 text-blue-700',
    qualified: 'bg-indigo-100 text-indigo-700', proposal: 'bg-purple-100 text-purple-700',
    negotiation: 'bg-yellow-100 text-yellow-700', won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

function scoreColor(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    fetch('/api/admin/leads-mgmt/seed', { method: 'POST' }).catch(() => {});
  }, []);

  const tabs = [
    'Pipeline', 'All Leads', 'Lead Detail', 'Lead Scoring',
    'Lead Forms', 'Analytics', 'AI Qualification', 'Import/Export',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Lead Generation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full-funnel lead management with AI qualification and pipeline visibility</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 0 && <TabPipeline />}
        {tab === 1 && <TabAllLeads onDetail={() => setTab(2)} />}
        {tab === 2 && <TabLeadDetail />}
        {tab === 3 && <TabLeadScoring />}
        {tab === 4 && <TabLeadForms />}
        {tab === 5 && <TabAnalytics />}
        {tab === 6 && <TabAIQualification />}
        {tab === 7 && <TabImportExport />}
      </div>
    </div>
  );
}

// ── Tab 1: Pipeline (Kanban) ──────────────────────────────────────────────────

function TabPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/leads-mgmt?resource=leads')
      .then(r => r.json())
      .then((d: { leads?: Lead[] }) => setLeads(d.leads ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMoveStage = async (id: number, stage: string) => {
    await fetch(`/api/admin/leads-mgmt?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_stage: stage }),
    });
    load();
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading pipeline…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Lead Pipeline</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.lead_stage === stage);
          return (
            <div key={stage} className={`flex-shrink-0 w-56 rounded-xl border border-gray-200 ${stageBg(stage)} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageBadge(stage)}`}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </span>
                <span className="text-xs text-gray-500">{stageLeads.length}</span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stageLeads.map(l => (
                  <div key={l.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm space-y-2">
                    <div className="font-medium text-gray-900 text-xs">{l.first_name} {l.last_name}</div>
                    <div className="text-xs text-gray-500 truncate">{l.company}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${scoreColor(l.lead_score)}`} style={{ width: `${l.lead_score}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{l.lead_score}</span>
                    </div>
                    {l.deal_value && <div className="text-xs text-green-600 font-medium">${Number(l.deal_value).toLocaleString()}</div>}
                    <select value={stage} onChange={e => handleMoveStage(l.id, e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 bg-white">
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 2: All Leads ──────────────────────────────────────────────────────────

function TabAllLeads({ onDetail }: { onDetail: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editStage, setEditStage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ resource: 'leads', ...(stageFilter ? { stage: stageFilter } : {}), ...(sourceFilter ? { source: sourceFilter } : {}) });
    fetch(`/api/admin/leads-mgmt?${params}`)
      .then(r => r.json())
      .then((d: { leads?: Lead[] }) => setLeads(d.leads ?? []))
      .finally(() => setLoading(false));
  }, [stageFilter, sourceFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter(l =>
    !search || `${l.first_name} ${l.last_name} ${l.email} ${l.company}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lead?')) return;
    await fetch(`/api/admin/leads-mgmt?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleEditStage = async (id: number) => {
    await fetch(`/api/admin/leads-mgmt?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_stage: editStage }),
    });
    setEditId(null); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
          className="border border-gray-300 rounded px-3 py-2 text-sm w-48" />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">All Sources</option>
          {['website', 'referral', 'event', 'linkedin', 'partner', 'campaign', 'social'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{filtered.length} leads</span>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Company', 'Email', 'Stage', 'Score', 'Source', 'Deal Value', 'Last Contact', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-xs font-medium text-gray-900">{l.first_name} {l.last_name}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{l.company}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{l.email}</td>
                  <td className="px-3 py-3">
                    {editId === l.id ? (
                      <div className="flex gap-1">
                        <select value={editStage} onChange={e => setEditStage(e.target.value)} className="text-xs border rounded px-1 py-0.5">
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => handleEditStage(l.id)} className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs px-1 py-0.5 bg-gray-100 rounded">✕</button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stageBadge(l.lead_stage)}`}>{l.lead_stage}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${scoreColor(l.lead_score)}`} style={{ width: `${l.lead_score}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{l.lead_score}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{l.lead_source}</td>
                  <td className="px-3 py-3 text-xs text-green-600">{l.deal_value ? `$${Number(l.deal_value).toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{l.last_contact_at ? new Date(l.last_contact_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(l.id); setEditStage(l.lead_stage); onDetail(); }}
                        className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">Edit</button>
                      <button onClick={() => { setEditId(l.id); setEditStage(l.lead_stage); }}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Stage</button>
                      <button onClick={() => handleDelete(l.id)}
                        className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No leads found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Lead Detail ────────────────────────────────────────────────────────

function TabLeadDetail() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [actForm, setActForm] = useState({ activity_type: 'call', description: '', outcome: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/leads-mgmt?resource=leads').then(r => r.json())
      .then((d: { leads?: Lead[] }) => { setLeads(d.leads ?? []); if (d.leads?.[0]) setSelectedId(d.leads[0].id); });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/admin/leads-mgmt?resource=activities&lead_id=${selectedId}`)
      .then(r => r.json())
      .then((d: { activities?: LeadActivity[] }) => setActivities(d.activities ?? []));
  }, [selectedId]);

  const selected = leads.find(l => l.id === selectedId);

  const handleAddActivity = async () => {
    if (!actForm.description.trim() || !selectedId) return;
    setSaving(true);
    await fetch('/api/admin/leads-mgmt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'activity', lead_id: selectedId, ...actForm }),
    }).catch(() => {});
    setActForm({ activity_type: 'call', description: '', outcome: '' });
    const d = await fetch(`/api/admin/leads-mgmt?resource=activities&lead_id=${selectedId}`).then(r => r.json()) as { activities?: LeadActivity[] };
    setActivities(d.activities ?? []);
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lead list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden self-start">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase">Select Lead</div>
        <div className="max-h-96 overflow-y-auto">
          {leads.map(l => (
            <button key={l.id} onClick={() => setSelectedId(l.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-indigo-50 transition-colors ${selectedId === l.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}>
              <div className="font-medium text-gray-900 text-sm">{l.first_name} {l.last_name}</div>
              <div className="text-xs text-gray-400">{l.company} · {l.lead_stage}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected && (
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.first_name} {selected.last_name}</h2>
                <p className="text-sm text-gray-500">{selected.job_title}{selected.job_title && selected.company ? ' at ' : ''}{selected.company}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stageBadge(selected.lead_stage)}`}>{selected.lead_stage}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                { label: 'Email', value: selected.email },
                { label: 'Phone', value: selected.phone },
                { label: 'Source', value: selected.lead_source },
                { label: 'Score', value: selected.lead_score },
                { label: 'Deal Value', value: selected.deal_value ? `$${Number(selected.deal_value).toLocaleString()}` : '—' },
                { label: 'Assigned To', value: selected.assigned_to },
              ].map(f => (
                <div key={f.label}>
                  <div className="text-xs text-gray-500">{f.label}</div>
                  <div className="font-medium text-gray-900">{f.value || '—'}</div>
                </div>
              ))}
            </div>
            {selected.notes && <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">{selected.notes}</div>}
            {(selected.utm_source || selected.utm_campaign) && (
              <div className="text-xs text-gray-400">UTM: {[selected.utm_source, selected.utm_medium, selected.utm_campaign].filter(Boolean).join(' / ')}</div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {activities.length === 0 && <div className="text-xs text-gray-400">No activities yet.</div>}
              {activities.map(a => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="text-xs text-gray-400 w-16 flex-shrink-0">{new Date(a.created_at).toLocaleDateString()}</div>
                  <div>
                    <span className="text-xs font-medium text-indigo-600">{a.activity_type}</span>
                    <span className="text-xs text-gray-600 ml-2">{a.description}</span>
                    {a.outcome && <span className="text-xs text-gray-400 ml-2">→ {a.outcome}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <h4 className="text-xs font-medium text-gray-700">Add Activity</h4>
              <div className="grid grid-cols-3 gap-2">
                <select value={actForm.activity_type} onChange={e => setActForm(f => ({ ...f, activity_type: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs">
                  {['call', 'email', 'meeting', 'demo', 'proposal', 'note'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input value={actForm.description} onChange={e => setActForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description *" className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <input value={actForm.outcome} onChange={e => setActForm(f => ({ ...f, outcome: e.target.value }))}
                  placeholder="Outcome" className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <button onClick={handleAddActivity} disabled={saving}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Lead Scoring ───────────────────────────────────────────────────────

const WEIGHT_DEFAULTS = { source: 20, recency: 20, engagement: 30, deal_value: 20, stage: 10 };

function TabLeadScoring() {
  const [weights, setWeights] = useState(WEIGHT_DEFAULTS);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState('');

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleRecalculate = async () => {
    setRecalculating(true); setMsg('');
    try {
      const r = await fetch('/api/admin/leads-mgmt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate-scores' }),
      });
      const d = await r.json() as { recalculated?: number };
      setMsg(`Recalculated scores for ${d.recalculated ?? 0} leads.`);
    } catch { setMsg('Error recalculating.'); } finally { setRecalculating(false); }
  };

  const DIMS = [
    { key: 'source', label: 'Source Weight', desc: 'Score based on lead origin (referral > organic > cold)', max: 20 },
    { key: 'recency', label: 'Recency Weight', desc: 'Score based on time since last contact', max: 20 },
    { key: 'engagement', label: 'Engagement Weight', desc: 'Score based on interaction depth and frequency', max: 30 },
    { key: 'deal_value', label: 'Deal Value Weight', desc: 'Score based on expected revenue potential', max: 20 },
    { key: 'stage', label: 'Stage Weight', desc: 'Score based on current pipeline stage', max: 10 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Lead Scoring Model</h2>
        <div className={`text-sm font-medium ${total === 100 ? 'text-green-600' : 'text-red-500'}`}>
          Total weight: {total}/100
        </div>
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        {DIMS.map(d => (
          <div key={d.key} className="grid grid-cols-3 gap-4 items-center">
            <div>
              <div className="text-sm font-medium text-gray-900">{d.label}</div>
              <div className="text-xs text-gray-400">{d.desc}</div>
            </div>
            <input type="number" min={0} max={d.max} value={weights[d.key]}
              onChange={e => setWeights(w => ({ ...w, [d.key]: Math.max(0, Math.min(d.max, Number(e.target.value))) }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm text-center" />
            <div className="text-xs text-gray-400">max {d.max}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <strong>Score Formula:</strong> (Source × {weights.source/100}) + (Recency × {weights.recency/100}) + (Engagement × {weights.engagement/100}) + (Deal Value × {weights.deal_value/100}) + (Stage × {weights.stage/100}) = 0–100
      </div>

      <button onClick={handleRecalculate} disabled={recalculating || total !== 100}
        className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {recalculating ? 'Recalculating…' : 'Recalculate All Scores'}
      </button>
    </div>
  );
}

// ── Tab 5: Lead Forms ─────────────────────────────────────────────────────────

interface FormField { type: string; label: string; required: boolean }

function TabLeadForms() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<FormField[]>([
    { type: 'text', label: 'First Name', required: true },
    { type: 'email', label: 'Email', required: true },
    { type: 'phone', label: 'Phone', required: false },
  ]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/leads-mgmt?resource=forms')
      .then(r => r.json())
      .then((d: { forms?: LeadForm[] }) => setForms(d.forms ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addField = () => setFields(f => [...f, { type: 'text', label: 'New Field', required: false }]);
  const removeField = (i: number) => setFields(f => f.filter((_, j) => j !== i));

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const r = await fetch('/api/admin/leads-mgmt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-form', form_name: formName, fields }),
    }).catch(() => null);
    if (r?.ok) { setFormName(''); load(); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Lead Forms</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Form Builder</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Form Name *</label>
            <input value={formName} onChange={e => setFormName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Contact Lead Form" />
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={f.type} onChange={e => setFields(fs => fs.map((fi, j) => j === i ? { ...fi, type: e.target.value } : fi))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs">
                  {['text', 'email', 'phone', 'select', 'textarea'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={f.label} onChange={e => setFields(fs => fs.map((fi, j) => j === i ? { ...fi, label: e.target.value } : fi))}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input type="checkbox" checked={f.required} onChange={e => setFields(fs => fs.map((fi, j) => j === i ? { ...fi, required: e.target.checked } : fi))} />
                  Req
                </label>
                <button onClick={() => removeField(i)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
            <button onClick={addField} className="text-xs text-indigo-600 hover:text-indigo-700">+ Add Field</button>
          </div>
          <button onClick={handleCreate} disabled={saving || !formName.trim()}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Form'}
          </button>
        </div>

        {/* Forms list */}
        <div className="space-y-3">
          {loading ? <div className="text-gray-400 text-sm">Loading…</div> : forms.map(f => (
            <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="font-medium text-gray-900 text-sm">{f.form_name}</div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{f.submissions} submissions</span>
                <span>{f.conversions} conversions</span>
                <span className={f.is_active ? 'text-green-600' : 'text-gray-400'}>{f.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono text-gray-600 break-all">
                {`<iframe src="/api/leads/form/${f.id}" width="100%" height="400" />`}
              </div>
            </div>
          ))}
          {!loading && forms.length === 0 && <div className="text-gray-400 text-sm">No forms yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Tab 6: Analytics ──────────────────────────────────────────────────────────

function TabAnalytics() {
  const [data, setData] = useState<{
    bySource: Array<{ lead_source: string; count: number; won: number }>;
    monthly: Array<{ month: string; count: number }>;
    avgDeal: Array<{ lead_source: string; avg_deal: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/leads-mgmt?resource=analytics')
      .then(r => r.json())
      .then((d: typeof data) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;
  if (!data) return <div className="text-gray-400 text-sm">No analytics data.</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Lead Analytics</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By source */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Leads by Source</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b">
              <th className="text-left pb-2">Source</th><th className="pb-2">Leads</th><th className="pb-2">Won</th><th className="pb-2">Conversion</th>
            </tr></thead>
            <tbody>
              {(data.bySource ?? []).map(s => (
                <tr key={s.lead_source} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-600">{s.lead_source}</td>
                  <td className="py-2 text-xs">{s.count}</td>
                  <td className="py-2 text-xs text-green-600">{s.won}</td>
                  <td className="py-2 text-xs">{s.count > 0 ? Math.round((s.won / s.count) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Monthly */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Monthly Lead Volume (Last 6 Months)</h3>
          <div className="space-y-2">
            {(data.monthly ?? []).map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-24">{m.month}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4">
                  <div className="h-4 bg-indigo-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(4, Math.min(100, m.count * 5))}%` }}>
                    <span className="text-white text-xs">{m.count}</span>
                  </div>
                </div>
              </div>
            ))}
            {(data.monthly ?? []).length === 0 && <div className="text-xs text-gray-400">No data yet.</div>}
          </div>
        </div>

        {/* Avg deal by source */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Average Deal Value by Source</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left pb-2">Source</th><th className="pb-2">Avg Deal Value</th></tr></thead>
            <tbody>
              {(data.avgDeal ?? []).map(s => (
                <tr key={s.lead_source} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-600">{s.lead_source}</td>
                  <td className="py-2 text-xs font-medium text-green-600">${Number(s.avg_deal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 7: AI Qualification ───────────────────────────────────────────────────

function TabAIQualification() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [qualifying, setQualifying] = useState(false);
  const [result, setResult] = useState<QualifyResult | null>(null);

  useEffect(() => {
    fetch('/api/admin/leads-mgmt?resource=leads').then(r => r.json())
      .then((d: { leads?: Lead[] }) => setLeads(d.leads ?? []));
  }, []);

  const selected = leads.find(l => String(l.id) === selectedId);

  const handleQualify = async () => {
    if (!selectedId) return;
    setQualifying(true); setResult(null);
    try {
      const r = await fetch('/api/admin/leads-mgmt/qualify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: Number(selectedId) }),
      });
      const d = await r.json() as QualifyResult;
      setResult(d);
    } catch { /* ignore */ } finally { setQualifying(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">AI Lead Qualification</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Lead</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">Choose a lead…</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.first_name} {l.last_name} — {l.company}</option>)}
            </select>
          </div>

          {selected && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm space-y-2">
              <div className="font-semibold text-gray-900">{selected.first_name} {selected.last_name}</div>
              {[
                { label: 'Company', value: selected.company },
                { label: 'Title', value: selected.job_title },
                { label: 'Source', value: selected.lead_source },
                { label: 'Stage', value: selected.lead_stage },
                { label: 'Score', value: String(selected.lead_score) },
                { label: 'Deal Value', value: selected.deal_value ? `$${Number(selected.deal_value).toLocaleString()}` : '—' },
              ].map(f => (
                <div key={f.label} className="flex gap-2 text-xs">
                  <span className="text-gray-500 w-20">{f.label}:</span>
                  <span className="text-gray-900">{f.value || '—'}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleQualify} disabled={qualifying || !selectedId}
            className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {qualifying ? 'Qualifying with AI…' : 'Qualify with AI'}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            {(result.result?.qualification_score ?? result.qualification_score) !== undefined && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Qualification Result</h3>
                  <div className={`text-2xl font-bold ${(result.result?.qualification_score ?? result.qualification_score ?? 0) >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {result.result?.qualification_score ?? result.qualification_score}/100
                  </div>
                </div>
                {(result.result?.qualification_level ?? result.qualification_level) && (
                  <div className="text-sm text-gray-600">
                    Level: <span className="font-medium">{result.result?.qualification_level ?? result.qualification_level}</span>
                  </div>
                )}
                {(result.result?.next_best_action ?? result.next_best_action) && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Next Best Action</div>
                    <div className="text-sm text-gray-600 bg-indigo-50 rounded p-3">{result.result?.next_best_action ?? result.next_best_action}</div>
                  </div>
                )}
              </div>
            )}
            {(result.subject ?? result.body) && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">Draft Email</h3>
                <div className="text-xs font-medium text-gray-700">Subject: {result.subject}</div>
                <textarea value={result.body ?? ''} readOnly rows={8}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs bg-gray-50" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 8: Import/Export ──────────────────────────────────────────────────────

const CSV_HEADERS = 'first_name,last_name,email,company,lead_source,deal_value';

function TabImportExport() {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');

  const downloadTemplate = () => {
    const blob = new Blob([CSV_HEADERS + '\nJane,Doe,jane@example.com,Acme Corp,website,5000'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    const r = await fetch('/api/admin/leads-mgmt?resource=leads');
    const d = await r.json() as { leads?: Lead[] };
    const leads = d.leads ?? [];
    const csv = [CSV_HEADERS, ...leads.map(l => `${l.first_name},${l.last_name},${l.email},${l.company},${l.lead_source},${l.deal_value ?? ''}`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'leads-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseCSV = () => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) { setPreview([]); return; }
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',');
      return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i]?.trim() ?? '' }), {} as Record<string, string>);
    });
    setPreview(rows);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true); setMsg('');
    let imported = 0;
    for (const row of preview) {
      try {
        await fetch('/api/admin/leads-mgmt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...row, deal_value: parseFloat(row.deal_value) || undefined }),
        });
        imported++;
      } catch { /* skip */ }
    }
    setMsg(`Imported ${imported} of ${preview.length} leads.`);
    setImporting(false); setCsvText(''); setPreview([]);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Import / Export</h2>
      <div className="flex gap-3">
        <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200">
          Download CSV Template
        </button>
        <button onClick={handleExport} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">
          Export All Leads as CSV
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Import Leads from CSV</h3>
        <div className="text-xs text-gray-500">Headers: <span className="font-mono">{CSV_HEADERS}</span></div>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
          className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono"
          placeholder={`${CSV_HEADERS}\nJane,Doe,jane@example.com,Acme Corp,website,5000`} />
        <div className="flex gap-3">
          <button onClick={handleParseCSV} disabled={!csvText.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 disabled:opacity-50">
            Parse & Preview
          </button>
          {preview.length > 0 && (
            <button onClick={handleImport} disabled={importing}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
              {importing ? `Importing ${preview.length}…` : `Import ${preview.length} Leads`}
            </button>
          )}
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        {preview.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>
                {Object.keys(preview[0]).map(h => <th key={h} className="text-left px-2 py-1 text-gray-500">{h}</th>)}
              </tr></thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 text-gray-600">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <div className="text-xs text-gray-400 mt-1">…and {preview.length - 5} more rows</div>}
          </div>
        )}
      </div>
    </div>
  );
}
