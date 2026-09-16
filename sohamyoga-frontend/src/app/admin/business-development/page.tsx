'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Opportunity {
  id: number;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  opportunity_type: string;
  stage: string;
  deal_value: string;
  probability_pct: number;
  expected_close_date: string | null;
  source: string | null;
  industry: string | null;
  notes: string | null;
  assigned_to: string | null;
  last_activity_at: string | null;
  created_at: string;
  activity_count: string;
}

interface Activity {
  id: number;
  opportunity_id: number;
  activity_type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
  company_name: string;
}

interface StageCount {
  stage: string;
  count: string;
  total_value: string;
  weighted_value: string;
}

interface ApiData {
  opportunities: Opportunity[];
  stageCounts: StageCount[];
  recentActivities: Activity[];
  totalWeightedPipeline: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ['prospecting', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;
const OPPORTUNITY_TYPES = ['partnership', 'enterprise_sale', 'agency', 'reseller', 'integration', 'sponsorship'];
const SOURCES = ['referral', 'linkedin', 'conference', 'inbound', 'cold_outreach'];
const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'demo', 'proposal_sent', 'contract_sent'];

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'border-blue-400/40 bg-blue-500/10',
  discovery: 'border-purple-400/40 bg-purple-500/10',
  proposal: 'border-yellow-400/40 bg-yellow-500/10',
  negotiation: 'border-orange-400/40 bg-orange-500/10',
  closed_won: 'border-green-400/40 bg-green-500/20 shadow-green-500/20',
  closed_lost: 'border-red-400/40 bg-red-500/10',
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: '📞', email: '📧', meeting: '🤝', demo: '🎯',
  proposal_sent: '📄', contract_sent: '📋', note: '📝',
};

function fmtMoney(val: string | number | null | undefined) {
  const n = Number(val ?? 0);
  return isNaN(n) ? '$0' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function daysSince(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

const STAGE_BADGE: Record<string, string> = {
  prospecting: 'bg-blue-500/20 text-blue-200',
  discovery: 'bg-purple-500/20 text-purple-200',
  proposal: 'bg-yellow-500/20 text-yellow-200',
  negotiation: 'bg-orange-500/20 text-orange-200',
  closed_won: 'bg-green-500/20 text-green-200',
  closed_lost: 'bg-red-500/20 text-red-200',
  on_hold: 'bg-gray-500/20 text-gray-200',
};

const TYPE_BADGE: Record<string, string> = {
  partnership: 'bg-indigo-500/20 text-indigo-200',
  enterprise_sale: 'bg-blue-500/20 text-blue-200',
  agency: 'bg-teal-500/20 text-teal-200',
  reseller: 'bg-cyan-500/20 text-cyan-200',
  integration: 'bg-violet-500/20 text-violet-200',
  sponsorship: 'bg-pink-500/20 text-pink-200',
};

// ─── Pipeline Board Tab ───────────────────────────────────────────────────────

function PipelineBoard({ opportunities, stageCounts, onMoveStage }: {
  opportunities: Opportunity[];
  stageCounts: StageCount[];
  onMoveStage: (id: number, stage: string) => void;
}) {
  const stageMap = new Map(stageCounts.map(s => [s.stage, s]));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {STAGES.map(stage => {
          const opps = opportunities.filter(o => o.stage === stage);
          const sc = stageMap.get(stage);
          const isWon = stage === 'closed_won';
          const isLost = stage === 'closed_lost';

          return (
            <div key={stage} className="w-64 flex-shrink-0">
              <div className={` border rounded-2xl p-4 shadow-xl ${STAGE_COLORS[stage]} ${isWon ? 'shadow-green-500/30' : isLost ? 'shadow-red-500/20' : ''}`}>
                <div className="mb-3">
                  <h3 className="text-white font-semibold capitalize text-sm">
                    {stage.replace('_', ' ')}
                  </h3>
                  <p className="text-white/60 text-xs mt-0.5">
                    {fmtMoney(sc?.total_value ?? 0)} · {opps.length} deals
                  </p>
                </div>
                <div className="space-y-2">
                  {opps.map(opp => (
                    <div key={opp.id} className=" bg-white/5 border border-white/10 rounded-xl p-3 text-sm">
                      <p className="text-white font-medium truncate">{opp.company_name}</p>
                      {opp.contact_name && <p className="text-white/50 text-xs truncate">{opp.contact_name}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-green-300 font-semibold text-xs">{fmtMoney(opp.deal_value)}</span>
                        <span className="text-white/40 text-xs">{opp.probability_pct}%</span>
                      </div>
                      <p className="text-white/30 text-xs mt-1">{daysSince(opp.created_at)}d ago</p>
                      <select
                        value={opp.stage}
                        onChange={e => onMoveStage(opp.id, e.target.value)}
                        className="mt-2 w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70"
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  ))}
                  {opps.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-4">No deals</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── All Opportunities Tab ────────────────────────────────────────────────────

function AllOpportunities({ opportunities, onMoveStage, onAddActivity }: {
  opportunities: Opportunity[];
  onMoveStage: (id: number, stage: string) => void;
  onAddActivity: (opp: Opportunity) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = opportunities.filter(o =>
    o.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (o.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search company or contact..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/40 text-sm"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 text-xs border-b border-white/10">
              <th className="text-left py-2 px-3">Company</th>
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">Stage</th>
              <th className="text-right py-2 px-3">Value</th>
              <th className="text-right py-2 px-3">Prob.</th>
              <th className="text-left py-2 px-3">Close Date</th>
              <th className="text-left py-2 px-3">Assigned</th>
              <th className="text-right py-2 px-3">Acts.</th>
              <th className="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(opp => (
              <tr key={opp.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 px-3 text-white font-medium">{opp.company_name}</td>
                <td className="py-2 px-3">
                  <Badge label={opp.opportunity_type} color={TYPE_BADGE[opp.opportunity_type] ?? 'bg-gray-500/20 text-gray-200'} />
                </td>
                <td className="py-2 px-3">
                  <Badge label={opp.stage.replace('_', ' ')} color={STAGE_BADGE[opp.stage] ?? 'bg-gray-500/20 text-gray-200'} />
                </td>
                <td className="py-2 px-3 text-right text-green-300 font-mono">{fmtMoney(opp.deal_value)}</td>
                <td className="py-2 px-3 text-right text-white/70">{opp.probability_pct}%</td>
                <td className="py-2 px-3 text-white/60 text-xs">{opp.expected_close_date ?? '—'}</td>
                <td className="py-2 px-3 text-white/60 text-xs">{opp.assigned_to ?? '—'}</td>
                <td className="py-2 px-3 text-right text-white/50 text-xs">{opp.activity_count}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <select
                      value={opp.stage}
                      onChange={e => onMoveStage(opp.id, e.target.value)}
                      className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white/70"
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <button
                      onClick={() => onAddActivity(opp)}
                      className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-2 py-1 text-white/70"
                    >
                      + Activity
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-white/40 text-center py-8">No opportunities found.</p>}
      </div>
    </div>
  );
}

// ─── Add Opportunity Tab ──────────────────────────────────────────────────────

function AddOpportunity({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_email: '', contact_phone: '',
    opportunity_type: 'partnership', stage: 'prospecting', deal_value: '',
    probability_pct: 10, expected_close_date: '', source: '', industry: '',
    assigned_to: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/business-development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deal_value: Number(form.deal_value) }),
      });
      if (res.ok) { setMsg('Opportunity created!'); onCreated(); }
      else { const d = await res.json(); setMsg(d.error ?? 'Error'); }
    } finally { setSaving(false); }
  }

  return (
    <GlassCard>
      <h2 className="text-white font-semibold text-lg mb-6">New Opportunity</h2>
      {msg && <div className="mb-4 text-sm text-green-300">{msg}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Company Name *', key: 'company_name', type: 'text', required: true },
          { label: 'Contact Name', key: 'contact_name', type: 'text' },
          { label: 'Contact Email', key: 'contact_email', type: 'email' },
          { label: 'Contact Phone', key: 'contact_phone', type: 'tel' },
          { label: 'Deal Value ($)', key: 'deal_value', type: 'number' },
          { label: 'Expected Close Date', key: 'expected_close_date', type: 'date' },
          { label: 'Industry', key: 'industry', type: 'text' },
          { label: 'Assigned To', key: 'assigned_to', type: 'text' },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className="block text-white/60 text-xs mb-1">{label}</label>
            <input
              type={type}
              required={required}
              value={String(form[key as keyof typeof form])}
              onChange={e => set(key, e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30"
            />
          </div>
        ))}

        <div>
          <label className="block text-white/60 text-xs mb-1">Opportunity Type</label>
          <select value={form.opportunity_type} onChange={e => set('opportunity_type', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Stage</label>
          <select value={form.stage} onChange={e => set('stage', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Source</label>
          <select value={form.source} onChange={e => set('source', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            <option value="">Select source</option>
            {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Probability: {form.probability_pct}%</label>
          <input
            type="range" min={0} max={100} step={5}
            value={form.probability_pct}
            onChange={e => set('probability_pct', Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-white/60 text-xs mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-medium"
          >
            {saving ? 'Creating…' : 'Create Opportunity'}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────

function ActivityLog({ activities, opportunityId, opportunities, onCreated }: {
  activities: Activity[];
  opportunityId: number | null;
  opportunities: Opportunity[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ opportunity_id: opportunityId ?? '', activity_type: 'note', title: '', description: '', scheduled_at: '', outcome: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/business-development/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setMsg('Activity logged!'); onCreated(); }
      else { const d = await res.json(); setMsg(d.error ?? 'Error'); }
    } finally { setSaving(false); }
  }

  const displayActivities = opportunityId
    ? activities.filter(a => a.opportunity_id === opportunityId)
    : activities;

  return (
    <div className="space-y-6">
      {/* Add Activity Form */}
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Log Activity</h3>
        {msg && <div className="text-green-300 text-sm mb-3">{msg}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-white/60 text-xs mb-1">Opportunity</label>
            <select value={form.opportunity_id} onChange={e => set('opportunity_id', e.target.value)} required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
              <option value="">Select opportunity</option>
              {opportunities.map(o => <option key={o.id} value={o.id}>{o.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Activity Type</label>
            <select value={form.activity_type} onChange={e => set('activity_type', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Title *</label>
            <input type="text" required value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Scheduled At</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Outcome</label>
            <input type="text" value={form.outcome} onChange={e => set('outcome', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-medium">
              {saving ? 'Saving…' : 'Log Activity'}
            </button>
          </div>
        </form>
      </GlassCard>

      {/* Timeline */}
      <div className="space-y-3">
        {displayActivities.map(a => (
          <GlassCard key={a.id} className="flex gap-4 items-start">
            <span className="text-2xl flex-shrink-0">{ACTIVITY_ICONS[a.activity_type] ?? '📝'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-medium text-sm">{a.title}</span>
                <Badge label={a.company_name} color="bg-indigo-500/20 text-indigo-200" />
                <Badge label={a.activity_type.replace('_', ' ')} color="bg-white/10 text-white/60" />
              </div>
              {a.description && <p className="text-white/60 text-xs mt-1">{a.description}</p>}
              {a.outcome && <p className="text-green-300 text-xs mt-1">Outcome: {a.outcome}</p>}
              <p className="text-white/30 text-xs mt-1">
                {a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString() : new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
          </GlassCard>
        ))}
        {displayActivities.length === 0 && <p className="text-white/40 text-center py-8">No activities yet.</p>}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function Analytics({ opportunities, stageCounts, totalWeightedPipeline }: {
  opportunities: Opportunity[];
  stageCounts: StageCount[];
  totalWeightedPipeline: number;
}) {
  const wonOpps = opportunities.filter(o => o.stage === 'closed_won');
  const lostOpps = opportunities.filter(o => o.stage === 'closed_lost');
  const wonValue = wonOpps.reduce((s, o) => s + Number(o.deal_value), 0);
  const winRate = (wonOpps.length + lostOpps.length) > 0
    ? (wonOpps.length / (wonOpps.length + lostOpps.length)) * 100 : 0;

  const avgCycleDays = wonOpps.length > 0
    ? wonOpps.reduce((s, o) => s + daysSince(o.created_at), 0) / wonOpps.length : 0;

  const kpis = [
    { label: 'Weighted Pipeline', value: fmtMoney(totalWeightedPipeline), sub: 'deal_value × probability' },
    { label: 'Won Value (Total)', value: fmtMoney(wonValue), sub: `${wonOpps.length} deals` },
    { label: 'Avg Deal Cycle', value: `${avgCycleDays.toFixed(0)}d`, sub: 'from creation to won' },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${wonOpps.length} won / ${lostOpps.length} lost` },
  ];

  const totalDeals = opportunities.length || 1;
  const stageOrder = STAGES;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <GlassCard key={k.label}>
            <p className="text-white/50 text-xs uppercase tracking-wide">{k.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{k.value}</p>
            {k.sub && <p className="text-white/40 text-xs mt-1">{k.sub}</p>}
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Pipeline Funnel</h3>
        <div className="space-y-3">
          {stageOrder.map((stage, i) => {
            const sc = stageCounts.find(s => s.stage === stage);
            const count = Number(sc?.count ?? 0);
            const pct = Math.round((count / totalDeals) * 100);
            const nextStage = stageOrder[i + 1];
            const nextCount = nextStage ? Number(stageCounts.find(s => s.stage === nextStage)?.count ?? 0) : null;
            const convPct = count > 0 && nextCount !== null ? Math.round((nextCount / count) * 100) : null;

            return (
              <div key={stage} className="space-y-1">
                <div className="flex justify-between text-xs text-white/60">
                  <span className="capitalize">{stage.replace('_', ' ')}</span>
                  <span>{count} deals · {fmtMoney(sc?.total_value ?? 0)}</span>
                </div>
                <div className="h-6 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500/60 transition-all"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                {convPct !== null && (
                  <p className="text-white/30 text-xs text-right">↓ {convPct}% to next stage</p>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['Pipeline Board', 'All Opportunities', 'Add Opportunity', 'Activity Log', 'Analytics'] as const;
type Tab = typeof TABS[number];

export default function BusinessDevelopmentPage() {
  const [tab, setTab] = useState<Tab>('Pipeline Board');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityOpp, setActivityOpp] = useState<Opportunity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/business-development');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleMoveStage(id: number, stage: string) {
    await fetch('/api/admin/business-development', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    });
    void load();
  }

  function handleAddActivity(opp: Opportunity) {
    setActivityOpp(opp);
    setTab('Activity Log');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Business Development CRM 💼</h1>
            <p className="text-white/50 text-sm mt-1">Manage opportunities, pipeline, and BD activities</p>
          </div>
          {data && (
            <div className="bg-slate-800/70 border border-white/20 rounded-xl px-4 py-2">
              <p className="text-white/50 text-xs">Weighted Pipeline</p>
              <p className="text-white font-bold text-lg">{fmtMoney(data.totalWeightedPipeline)}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <TabButton key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-white/40 py-12 text-center">Loading…</div>
        ) : (
          <GlassCard>
            {tab === 'Pipeline Board' && data && (
              <PipelineBoard
                opportunities={data.opportunities}
                stageCounts={data.stageCounts}
                onMoveStage={handleMoveStage}
              />
            )}
            {tab === 'All Opportunities' && data && (
              <AllOpportunities
                opportunities={data.opportunities}
                onMoveStage={handleMoveStage}
                onAddActivity={handleAddActivity}
              />
            )}
            {tab === 'Add Opportunity' && (
              <AddOpportunity onCreated={() => { void load(); setTab('All Opportunities'); }} />
            )}
            {tab === 'Activity Log' && data && (
              <ActivityLog
                activities={data.recentActivities}
                opportunityId={activityOpp?.id ?? null}
                opportunities={data.opportunities}
                onCreated={() => { void load(); setActivityOpp(null); }}
              />
            )}
            {tab === 'Analytics' && data && (
              <Analytics
                opportunities={data.opportunities}
                stageCounts={data.stageCounts}
                totalWeightedPipeline={data.totalWeightedPipeline}
              />
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
