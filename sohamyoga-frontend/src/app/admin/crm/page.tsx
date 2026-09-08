'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Overview', 'Leads', 'Pipeline', 'Opportunities', 'Proposals', 'Contracts', 'Segmentation', 'CLV', 'Churn', 'Voice of Customer', 'Campaigns'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface OverviewData {
  totalContacts: number; activeLeads: number; conversionRatePct: number; avgClv: number; churnRatePct: number;
  leadSources: { source: string; count: number; pct: number }[];
}

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  useEffect(() => { fetchJson<OverviewData>('/api/crm/overview').then(setData); }, []);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Contacts"     value={(data?.totalContacts ?? 0).toLocaleString()} color="blue" />
        <KpiCard label="Active Leads"       value={(data?.activeLeads ?? 0).toLocaleString()}   color="green" />
        <KpiCard label="Conversion Rate"    value={`${data?.conversionRatePct ?? 0}%`} sub="Last 90 days" color="teal" />
        <KpiCard label="Avg CLV"            value={`$${(data?.avgClv ?? 0).toLocaleString()}`} color="purple" />
        <KpiCard label="Churn Risk"         value={`${data?.churnRatePct ?? 0}%`} sub="High/critical flagged" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Lead Sources (30 days)</h3>
        {!data?.leadSources.length ? <EmptyState message="No leads captured in the last 30 days." /> : data.leadSources.map(s => (
          <div key={s.source} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-28 text-gray-600 text-xs">{s.source}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-400 rounded" style={{ width: `${s.pct}%` }} /></div>
            <span className="w-8 text-right font-medium">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LeadRow { id: string; name: string; email: string; source: string; stage: string; score: number | null; temperature: string | null; scoreReason: string | null; added: string; duplicateOfLeadId: string | null }

const LEAD_FLOW = [
  { label: '1. Contact form', sub: 'POST /api/contact — real submission, no longer 404ing', color: 'bg-gray-50 border-gray-200 text-gray-800' },
  { label: '2. campaign_lead row', sub: "source_platform='website_form', funnel_stage='new'", color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { label: '3. LeadNurturingJob', sub: 'Weekly Fri 06:00 UTC — Ollama scores 0-100 + temperature', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { label: '4. Warm/hot leads', sub: 'Mautic drip segment triggered (if connected)', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { label: '5. Sales follow-up', sub: 'Visible here in the Leads table', color: 'bg-green-50 border-green-200 text-green-800' },
];

function ProcessFlow({ steps }: { steps: { label: string; sub: string; color: string }[] }) {
  return (
    <div className="border rounded-lg p-5 bg-white">
      <h3 className="font-semibold text-gray-800 mb-4 text-sm">Process Flow</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-center">
        {steps.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center gap-1">
            <div className={`w-full border rounded-xl p-3 ${n.color}`}>
              <p className="font-semibold text-xs">{n.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
            </div>
            {i < steps.length - 1 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Manual lead entry -- the "+ Add Lead" button previously had no onClick
// handler at all. Runs through the same real dedup as every other
// lead-creation entry point (contact form, event registration, forms).
function NewLeadForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null); setDuplicateNotice(null);
    const res = await fetch('/api/crm/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: phone || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create lead.'); return; }
    setOpen(false); setName(''); setEmail(''); setPhone('');
    if (body.duplicateOfLeadId) setDuplicateNotice('Flagged as a duplicate of an existing lead.');
    onCreated();
  }

  if (!open) return (
    <div className="flex items-center gap-2">
      {duplicateNotice && <span className="text-xs text-amber-600">{duplicateNotice}</span>}
      <button onClick={() => setOpen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Lead</button>
    </div>
  );
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-sm">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !name.trim() || !email.trim()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

interface SlaBreachRow { leadId: string; email: string | null; assignedTo: string | null; slaDeadline: string; hoursOverdue: number; funnelStage: string }
interface RoutingResultRow { leadId: string; assignedTo: string; assignedToEmail: string }

// Real Follow-Up Queue + Lead Routing Screen -- LeadRouting.ts
// (routeUnassignedLeads/checkSlaBreaches) and its two API routes were real
// and fully working, but zero UI anywhere ever called them -- confirmed via
// grep, an orphaned engine exactly like FunnelBuilder earlier this session.
function LeadOpsPanel({ onRouted }: { onRouted: () => void }) {
  const [breaches, setBreaches] = useState<SlaBreachRow[]>([]);
  const [routing, setRouting] = useState(false);
  const [routed, setRouted] = useState<RoutingResultRow[] | null>(null);

  const loadBreaches = useCallback(() => {
    fetchJson<{ breaches: SlaBreachRow[] }>('/api/admin/crm/leads/sla-breaches').then(d => setBreaches(d?.breaches ?? []));
  }, []);
  useEffect(() => { loadBreaches(); }, [loadBreaches]);

  async function runRouting() {
    setRouting(true);
    const res = await fetch('/api/admin/crm/leads/routing', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setRouting(false);
    setRouted(body.routed ?? []);
    onRouted();
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Follow-Up Queue — SLA Breaches</h3>
          <span className="text-xs text-gray-400">{breaches.length} overdue</span>
        </div>
        {breaches.length === 0 ? <EmptyState message="No SLA-overdue new leads." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Email', 'Overdue', 'Assigned'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {breaches.map(b => (
                <tr key={b.leadId}>
                  <td className="px-3 py-2 text-xs">{b.email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-red-600 font-medium">{b.hoursOverdue}h</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{b.assignedTo ?? 'unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Lead Routing</h3>
          <button onClick={runRouting} disabled={routing} className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50">
            {routing ? 'Routing…' : 'Route unassigned'}
          </button>
        </div>
        <div className="p-3 space-y-1">
          {routed === null ? (
            <p className="text-xs text-gray-400">Least-recently-assigned round-robin among active admins.</p>
          ) : routed.length === 0 ? (
            <p className="text-xs text-gray-400">No unassigned leads to route.</p>
          ) : routed.map(r => (
            <p key={r.leadId} className="text-xs text-gray-600">Lead {r.leadId.slice(0, 8)} → {r.assignedToEmail}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LeadDetail {
  id: string; name: string | null; email: string | null; phone: string | null; source: string | null;
  funnelStage: string; score: number | null; temperature: string | null; assignedTo: string | null;
  slaDeadline: string | null; serviceInterest: string | null; subject: string | null; message: string | null;
  createdAt: string; duplicateOfLeadId: string | null;
  opportunities: { id: string; title: string; estimated_value: string; currency: string; stage: string }[];
  proposals: { id: string; title: string; amount: string; currency: string; status: string }[];
  contracts: { id: string; status: string; created_at: string }[];
  dripEnrollments: { id: string; status: string; enrolled_at: string }[];
  eventRegistrations: { id: string; event_id: string; registered_at: string }[];
}

// Real Lead Detail Screen -- campaign_lead is referenced by opportunity/
// proposal/contract/drip_enrollment/event_registration, but the Leads tab
// only ever showed a flat table row with no click-through aggregation.
function LeadDetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);

  useEffect(() => {
    fetchJson<LeadDetail>(`/api/admin/crm/leads/${leadId}`).then(setDetail);
  }, [leadId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 rounded-xl bg-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Lead Detail</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {!detail ? <p className="text-sm text-gray-400">Loading…</p> : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-gray-500">Name:</span> {detail.name ?? '—'}</p>
              <p><span className="text-gray-500">Email:</span> {detail.email ?? '—'}</p>
              <p><span className="text-gray-500">Phone:</span> {detail.phone ?? '—'}</p>
              <p><span className="text-gray-500">Source:</span> {detail.source ?? '—'}</p>
              <p><span className="text-gray-500">Stage:</span> {detail.funnelStage}</p>
              <p><span className="text-gray-500">Score:</span> {detail.score ?? 'not scored'} {detail.temperature && `(${detail.temperature})`}</p>
              <p><span className="text-gray-500">Assigned to:</span> {detail.assignedTo ?? 'unassigned'}</p>
              <p><span className="text-gray-500">SLA deadline:</span> {detail.slaDeadline ? new Date(detail.slaDeadline).toLocaleString() : '—'}</p>
              <p><span className="text-gray-500">Service interest:</span> {detail.serviceInterest ?? '—'}</p>
              <p><span className="text-gray-500">Created:</span> {new Date(detail.createdAt).toLocaleDateString()}</p>
            </div>
            {detail.message && <p className="text-sm bg-gray-50 rounded p-2"><span className="text-gray-500">Message:</span> {detail.message}</p>}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Opportunities ({detail.opportunities.length})</p>
                {detail.opportunities.length === 0 ? <p className="text-xs text-gray-400">None</p> : detail.opportunities.map(o => (
                  <p key={o.id} className="text-xs">{o.title} — {o.currency} {o.estimated_value} <Badge color="purple">{o.stage}</Badge></p>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Proposals ({detail.proposals.length})</p>
                {detail.proposals.length === 0 ? <p className="text-xs text-gray-400">None</p> : detail.proposals.map(p => (
                  <p key={p.id} className="text-xs">{p.title} — {p.currency} {p.amount} <Badge color="blue">{p.status}</Badge></p>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Contracts ({detail.contracts.length})</p>
                {detail.contracts.length === 0 ? <p className="text-xs text-gray-400">None</p> : detail.contracts.map(c => (
                  <p key={c.id} className="text-xs"><Badge color="green">{c.status}</Badge> {new Date(c.created_at).toLocaleDateString()}</p>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Drip / Event ({detail.dripEnrollments.length + detail.eventRegistrations.length})</p>
                {detail.dripEnrollments.map(d => <p key={d.id} className="text-xs">Drip: <Badge color="gray">{d.status}</Badge></p>)}
                {detail.eventRegistrations.map(e => <p key={e.id} className="text-xs">Event registered {new Date(e.registered_at).toLocaleDateString()}</p>)}
                {detail.dripEnrollments.length === 0 && detail.eventRegistrations.length === 0 && <p className="text-xs text-gray-400">None</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const load = useCallback(() => { fetchJson<{ leads: LeadRow[] }>('/api/crm/leads').then(d => { setLeads(d?.leads ?? []); setLoading(false); }); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
    <ProcessFlow steps={LEAD_FLOW} />
    <LeadOpsPanel onRouted={load} />
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Active Leads ({leads.length})</h3>
        <NewLeadForm onCreated={load} />
      </div>
      {loading ? <EmptyState message="Loading…" /> : leads.length === 0 ? <EmptyState message="No active leads yet." /> : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name', 'Email', 'Source', 'Stage', 'Score', 'Added'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLeadId(l.id)}>
                <td className="px-3 py-2 font-medium">{l.name} {l.duplicateOfLeadId && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ml-1">duplicate</span>}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{l.email}</td>
                <td className="px-3 py-2"><Badge color="blue">{l.source}</Badge></td>
                <td className="px-3 py-2"><Badge color={l.stage === 'demo_scheduled' ? 'purple' : l.stage === 'trial' ? 'teal' : 'gray'}>{l.stage}</Badge></td>
                <td className="px-3 py-2">
                  {l.score === null ? <span className="text-xs text-gray-400">not scored</span> : (
                    <div className="flex items-center gap-1" title={l.scoreReason ?? ''}>
                      <div className="w-12 h-1.5 bg-gray-100 rounded"><div className={`h-1.5 ${l.score > 80 ? 'bg-green-500' : l.score > 60 ? 'bg-amber-400' : 'bg-gray-400'} rounded`} style={{ width: `${l.score}%` }} /></div>
                      <span className="text-xs font-medium">{l.score}</span>
                      {l.scoreReason && <span className="text-xs text-gray-400 truncate max-w-[160px]">· {l.scoreReason}</span>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{new Date(l.added).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    {selectedLeadId && <LeadDetailModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </div>
  );
}

interface PipelineData { total: number; converted: number; conversionRatePct: number; avgDealDays: number | null; stages: { name: string; count: number }[] }

function PipelineTab() {
  const [data, setData] = useState<PipelineData | null>(null);
  useEffect(() => { fetchJson<PipelineData>('/api/crm/pipeline').then(setData); }, []);
  const STAGE_COLOR: Record<string, string> = {
    new: 'bg-gray-100 border-gray-300', contacted: 'bg-blue-100 border-blue-300', trial: 'bg-purple-100 border-purple-300',
    demo_scheduled: 'bg-amber-100 border-amber-300', proposal: 'bg-teal-100 border-teal-300', converted: 'bg-green-100 border-green-300',
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total in Pipeline (90d)" value={String(data?.total ?? 0)} color="blue" />
        <KpiCard label="Converted" value={String(data?.converted ?? 0)} sub={`${data?.conversionRatePct ?? 0}% conversion`} color="green" />
        <KpiCard label="Avg Deal Time" value={data?.avgDealDays != null ? `${data.avgDealDays} days` : '—'} color="purple" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {(data?.stages ?? []).map(stage => (
          <div key={stage.name} className={`border-2 rounded-lg p-3 ${STAGE_COLOR[stage.name] ?? 'bg-gray-100 border-gray-300'}`}>
            <div className="text-lg font-bold text-gray-800">{stage.count}</div>
            <div className="text-xs font-medium text-gray-600 mt-0.5 capitalize">{stage.name.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SegmentRow { name: string; count: number; desc: string; computed: boolean; id?: string }

const SEGMENT_FIELDS = [
  'membership_plan', 'class_count', 'last_active_days', 'pose_score_avg', 'preferred_style',
  'location', 'signup_days_ago', 'total_spend_cad', 'challenge_completed', 'has_referrals', 'birthday_month',
] as const;
const SEGMENT_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in', 'contains'] as const;

function NewSegmentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [field, setField] = useState<typeof SEGMENT_FIELDS[number]>('last_active_days');
  const [operator, setOperator] = useState<typeof SEGMENT_OPERATORS[number]>('lte');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/crm/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, criteria: [{ field, operator, value }], logic: 'AND' }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setName(''); setDescription(''); setValue(''); onCreated(); }
    else setError(body.error ?? 'Failed to create segment.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Create Segment</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Segment name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <select value={field} onChange={e => setField(e.target.value as typeof field)} className="border rounded px-2 py-1.5 text-sm flex-1">
          {SEGMENT_FIELDS.map(f => <option key={f} value={f}>{f}{f === 'location' ? ' (not yet supported — no location data exists)' : ''}</option>)}
        </select>
        <select value={operator} onChange={e => setOperator(e.target.value as typeof operator)} className="border rounded px-2 py-1.5 text-sm">
          {SEGMENT_OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="value" className="border rounded px-2 py-1.5 text-sm w-28" />
      </div>
      <p className="text-xs text-gray-400">Single-criterion segments only for now — edit the row directly in the database for multi-criteria logic.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !name || !value} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

function SegmentationTab() {
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [customSegments, setCustomSegments] = useState<SegmentRow[]>([]);
  const load = () => fetchJson<{ segments: SegmentRow[]; customSegments: SegmentRow[] }>('/api/crm/segments').then(d => {
    setSegments(d?.segments ?? []); setCustomSegments(d?.customSegments ?? []);
  });
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Customer Segments</h3>
        <NewSegmentForm onCreated={load} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {[...segments, ...customSegments].map(seg => (
          <div key={seg.id ?? seg.name} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm">{seg.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{seg.desc}</div>
              </div>
              {seg.computed
                ? <span className="text-lg font-bold text-blue-600">{seg.count}</span>
                : <span className="text-xs text-gray-400 italic">not yet computed</span>}
            </div>
            <div className="flex gap-2 mt-3">
              <button className="text-xs text-blue-600 hover:underline">View</button>
              <button className="text-xs text-purple-600 hover:underline">Campaign</button>
              <button className="text-xs text-gray-500 hover:underline">Export</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ClvData { avgClv: number; top10PctClv: number; byTier: { tier: string; p25: number; median: number; p90: number }[] }

function CLVTab() {
  const [data, setData] = useState<ClvData | null>(null);
  useEffect(() => { fetchJson<ClvData>('/api/crm/clv').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Avg CLV"         value={`$${(data?.avgClv ?? 0).toLocaleString()}`}   sub="Per paying customer" color="purple" />
        <KpiCard label="Top 10% CLV"     value={`$${(data?.top10PctClv ?? 0).toLocaleString()}`} sub="90th percentile"   color="green" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">CLV Distribution by Tier</h3>
        {!data?.byTier.length ? <EmptyState message="No customer spend recorded yet." /> : data.byTier.map(t => (
          <div key={t.tier} className="py-2 border-b border-gray-50 text-sm">
            <div className="flex justify-between">
              <span className="font-medium w-20 capitalize">{t.tier}</span>
              <span className="text-gray-500 text-xs">P25: ${t.p25}</span>
              <span className="font-semibold text-purple-700">Median: ${t.median}</span>
              <span className="text-gray-500 text-xs">P90: ${t.p90}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChurnData {
  churnRatePct: number; membersFlagged: number;
  reasons: { reason: string; pct: number }[];
  atRisk: { name: string; lastClass: string | null; risk: string }[];
}

function ChurnTab() {
  const [data, setData] = useState<ChurnData | null>(null);
  useEffect(() => { fetchJson<ChurnData>('/api/crm/churn').then(setData); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Churn Risk Rate"   value={`${data?.churnRatePct ?? 0}%`}  color="amber" />
        <KpiCard label="Members Flagged"   value={String(data?.membersFlagged ?? 0)} sub="High/critical risk" color="rose" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Top Churn Reasons (Ollama-flagged)</h3>
          {!data?.reasons.length ? <EmptyState message="No high-risk members flagged yet." /> : data.reasons.map(r => (
            <div key={r.reason} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-36 text-gray-600 text-xs truncate" title={r.reason}>{r.reason}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-rose-400 rounded" style={{ width: `${r.pct}%` }} /></div>
              <span className="w-8 text-right font-medium">{r.pct}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">At-Risk — Early Warning</h3>
          {!data?.atRisk.length ? <EmptyState message="No members currently flagged." /> : data.atRisk.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
              <div><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">Last class: {m.lastClass ? new Date(m.lastClass).toLocaleDateString() : 'never'}</div></div>
              <Badge color={m.risk === 'Critical' || m.risk === 'High' ? 'red' : m.risk === 'Medium' ? 'amber' : 'green'}>{m.risk}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const VOC_FLOW = [
  { label: '1. Real inbound text', sub: 'Contact-form messages + comment sentiment_log', color: 'bg-gray-50 border-gray-200 text-gray-800' },
  { label: '2. Weekly job', sub: 'VoiceOfCustomerJob — skips if zero real messages', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { label: '3. Ollama clusters', sub: 'Themes/complaints/requests grounded only in given text', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { label: '4. Digest stored', sub: "status='draft', one per tenant per week", color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { label: '5. Staff reviews', sub: 'Read here — no auto-action taken', color: 'bg-green-50 border-green-200 text-green-800' },
];

interface VocTheme { label: string; count: number; sentiment: string }
interface VocDigest {
  id: string; periodStart: string; periodEnd: string; sourceMessageCount: number;
  themes: VocTheme[]; topComplaints: string[]; topRequests: string[]; overallSummary: string; status: string;
}

function VoiceOfCustomerTab() {
  const [digests, setDigests] = useState<VocDigest[] | null>(null);
  const load = () => fetchJson<{ digests: VocDigest[] }>('/api/marketing/voice-of-customer').then(d => setDigests(d?.digests ?? []));
  useEffect(() => { load(); }, []);

  async function transition(id: string, status: string) {
    await fetch(`/api/marketing/voice-of-customer/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-5 bg-white">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Process Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-center">
          {VOC_FLOW.map((n, i) => (
            <div key={n.label} className="flex flex-col items-center gap-1">
              <div className={`w-full border rounded-xl p-3 ${n.color}`}>
                <p className="font-semibold text-xs">{n.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
              </div>
              {i < VOC_FLOW.length - 1 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      {!digests ? <EmptyState message="Loading…" /> : digests.length === 0 ? (
        <EmptyState message="No digests yet — the weekly job skips creating one when there's no real inbound customer text that week." />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <a href="/api/admin/voice-of-customer/export" className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">⬇ Export All (PDF)</a>
          </div>
          {digests.map(d => (
            <div key={d.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">
                  {new Date(d.periodStart).toLocaleDateString()} – {new Date(d.periodEnd).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{d.sourceMessageCount} real message{d.sourceMessageCount === 1 ? '' : 's'}</span>
                  <Badge color={d.status === 'draft' ? 'amber' : 'gray'}>{d.status}</Badge>
                  {d.status === 'draft' && (
                    <>
                      <button onClick={() => transition(d.id, 'reviewed')} className="text-xs text-green-600 hover:underline">Mark Reviewed</button>
                      <button onClick={() => transition(d.id, 'dismissed')} className="text-xs text-red-500 hover:underline">Dismiss</button>
                    </>
                  )}
                  <a href={`/api/admin/voice-of-customer/export?id=${d.id}`} className="text-xs text-blue-600 hover:underline">PDF</a>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-3">{d.overallSummary}</p>
              {d.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {d.themes.map(t => (
                    <Badge key={t.label} color={t.sentiment === 'positive' ? 'green' : t.sentiment === 'negative' ? 'red' : 'gray'}>
                      {t.label} ({t.count})
                    </Badge>
                  ))}
                </div>
              )}
              {d.topComplaints.length > 0 && (
                <p className="text-xs text-gray-500 mt-1"><span className="font-medium text-gray-600">Complaints:</span> {d.topComplaints.join('; ')}</p>
              )}
              {d.topRequests.length > 0 && (
                <p className="text-xs text-gray-500 mt-1"><span className="font-medium text-gray-600">Requests:</span> {d.topRequests.join('; ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CampaignRow { id: string; name: string; status: string; segment: string; sent: number; ctrPct: number; conversions: number }
interface BrandKitOption { id: string; name: string; isDefault: boolean }

const OBJECTIVES = ['awareness', 'lead', 'registration', 'booking', 'sale', 'retention'] as const;
const OFFER_TYPES = ['trial', 'membership', 'workshop', 'retreat', 'referral', 'promotional', 'educational'] as const;
const CHANNEL_OPTIONS = ['instagram', 'facebook', 'email', 'sms', 'banner', 'blog', 'youtube'] as const;

const CAMPAIGN_ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  draft:     [{ action: 'approve', label: 'Approve', color: 'text-green-600' }],
  approved:  [{ action: 'launch', label: 'Launch', color: 'text-indigo-600' }],
  active:    [{ action: 'pause', label: 'Pause', color: 'text-amber-600' }, { action: 'complete', label: 'Complete', color: 'text-blue-600' }],
  paused:    [{ action: 'resume', label: 'Resume', color: 'text-green-600' }, { action: 'complete', label: 'Complete', color: 'text-blue-600' }],
  completed: [{ action: 'archive', label: 'Archive', color: 'text-gray-500' }],
  archived:  [],
};

function NewCampaignForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [brandKits, setBrandKits] = useState<BrandKitOption[]>([]);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<typeof OBJECTIVES[number]>('awareness');
  const [offerType, setOfferType] = useState<typeof OFFER_TYPES[number]>('promotional');
  const [channels, setChannels] = useState<string[]>(['email']);
  const [targetPersona, setTargetPersona] = useState('');
  const [budgetPlannedCAD, setBudgetPlannedCAD] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [brandKitId, setBrandKitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchJson<{ brandKits: BrandKitOption[] }>('/api/brand-kits').then(d => setBrandKits(d?.brandKits ?? []));
  }, [open]);

  function toggleChannel(ch: string) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  }

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/crm/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, objective, offerType, channels,
        targetPersona: targetPersona.split(',').map(p => p.trim()).filter(Boolean),
        budgetPlannedCAD: Number(budgetPlannedCAD) || 0,
        startDate, endDate, brandKitId: brandKitId || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setName(''); setStartDate(''); setEndDate(''); onCreated(); }
    else setError(body.error ?? 'Failed to create campaign.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Campaign</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <select value={objective} onChange={e => setObjective(e.target.value as typeof objective)} className="flex-1 border rounded px-2 py-1.5 text-sm">
          {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={offerType} onChange={e => setOfferType(e.target.value as typeof offerType)} className="flex-1 border rounded px-2 py-1.5 text-sm">
          {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Channels</p>
        <div className="flex flex-wrap gap-1.5">
          {CHANNEL_OPTIONS.map(ch => (
            <button key={ch} type="button" onClick={() => toggleChannel(ch)}
              className={`text-xs px-2 py-1 rounded-full ${channels.includes(ch) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{ch}</button>
          ))}
        </div>
      </div>
      <input value={targetPersona} onChange={e => setTargetPersona(e.target.value)} placeholder="target persona, comma separated (e.g. beginner, adult)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <input type="number" min={0} value={budgetPlannedCAD} onChange={e => setBudgetPlannedCAD(e.target.value)} placeholder="Budget (CAD)" className="flex-1 border rounded px-2 py-1.5 text-sm" />
        <select value={brandKitId} onChange={e => setBrandKitId(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm">
          <option value="">No brand kit</option>
          {brandKits.map(b => <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (default)' : ''}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-gray-500">Start
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
        </label>
        <label className="flex-1 text-xs text-gray-500">End
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !name || !channels.length || !startDate || !endDate} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

interface ProposalRow {
  id: string; title: string; amount: number; currency: string; status: string;
  validUntil: string | null; leadName: string; leadEmail: string; createdAt: string; hasContract: boolean;
}

const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  draft: 'gray', sent: 'blue', accepted: 'green', rejected: 'red', expired: 'amber',
};
const PROPOSAL_NEXT_ACTIONS: Record<string, { status: string; label: string }[]> = {
  draft: [{ status: 'sent', label: 'Mark Sent' }],
  sent: [{ status: 'accepted', label: 'Mark Accepted' }, { status: 'rejected', label: 'Mark Rejected' }, { status: 'expired', label: 'Mark Expired' }],
  accepted: [], rejected: [], expired: [],
};

// Proposal Management -- previously "proposal" only existed as a
// campaign_lead.funnel_stage string, with no real entity. Real lifecycle now:
// draft -> sent -> accepted/rejected/expired, linked to a real campaign_lead.
function NewProposalForm({ leads, onCreated }: { leads: LeadRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(''); const [title, setTitle] = useState(''); const [amount, setAmount] = useState('');
  const [validUntil, setValidUntil] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/crm/proposals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, title, amount: Number(amount), validUntil: validUntil || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setLeadId(''); setTitle(''); setAmount(''); setValidUntil(''); onCreated(); }
    else setError(body.error ?? 'Failed to create proposal.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Proposal</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <select value={leadId} onChange={e => setLeadId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
        <option value="">Select lead…</option>
        {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.email})</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Proposal title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount (CAD)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={validUntil} onChange={e => setValidUntil(e.target.value)} type="date" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !leadId || !title || !amount} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

function ProposalsTab() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchJson<{ proposals: ProposalRow[] }>('/api/admin/crm/proposals'),
      fetchJson<{ leads: LeadRow[] }>('/api/crm/leads'),
    ]).then(([p, l]) => { setProposals(p?.proposals ?? []); setLeads(l?.leads ?? []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, status: string) {
    await fetch(`/api/admin/crm/proposals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Proposals ({proposals.length})</h3>
          <NewProposalForm leads={leads} onCreated={load} />
        </div>
        {loading ? <EmptyState message="Loading…" /> : proposals.length === 0 ? <EmptyState message="No proposals yet — create one above." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Title', 'Lead', 'Amount', 'Status', 'Valid Until', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {proposals.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{p.title}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{p.leadName}</td>
                  <td className="px-3 py-2">{p.currency} {p.amount.toFixed(2)}</td>
                  <td className="px-3 py-2"><Badge color={PROPOSAL_STATUS_COLOR[p.status] ?? 'gray'}>{p.status}</Badge></td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{p.validUntil ? new Date(p.validUntil).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {(PROPOSAL_NEXT_ACTIONS[p.status] ?? []).map(a => (
                        <button key={a.status} onClick={() => transition(p.id, a.status)} className="text-xs text-blue-600 hover:underline">{a.label}</button>
                      ))}
                      {p.status === 'accepted' && !p.hasContract && (
                        <span className="text-xs text-gray-400 italic">Create a contract in the Contracts tab</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface ContractRow {
  id: string; title: string; terms: string; amount: number; currency: string; status: string;
  signedByName: string | null; sentAt: string | null; signedAt: string | null; leadName: string;
  leadEmail: string; createdAt: string; proposalId: string;
}

const CONTRACT_STATUS_COLOR: Record<string, string> = { draft: 'gray', sent: 'blue', signed: 'green', void: 'red' };
const CONTRACT_NEXT_ACTIONS: Record<string, string[]> = { draft: ['sent', 'void'], sent: ['signed', 'void'], signed: [], void: [] };

// Contract Management -- a real extension of Proposal Management. No
// e-signature service (DocuSign/HelloSign) is connected -- signing is a
// manual admin-recorded action, not fabricated e-signature integration.
function NewContractForm({ proposals, onCreated }: { proposals: ProposalRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [proposalId, setProposalId] = useState(''); const [title, setTitle] = useState(''); const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  const eligible = proposals.filter(p => p.status === 'accepted' && !p.hasContract);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/crm/contracts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, title, terms }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setProposalId(''); setTitle(''); setTerms(''); onCreated(); }
    else setError(body.error ?? 'Failed to create contract.');
  }

  if (!open) return <button onClick={() => setOpen(true)} disabled={!eligible.length} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-50" title={!eligible.length ? 'No accepted proposals without a contract yet' : ''}>+ New Contract</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <select value={proposalId} onChange={e => setProposalId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
        <option value="">Select accepted proposal…</option>
        {eligible.map(p => <option key={p.id} value={p.id}>{p.title} — {p.leadName} ({p.currency} {p.amount.toFixed(2)})</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contract title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <textarea value={terms} onChange={e => setTerms(e.target.value)} placeholder="Terms (scope, payment schedule, cancellation policy, etc.)" rows={4} className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !proposalId || !title || !terms.trim()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

interface OpportunityRow {
  id: string; title: string; estimatedValue: number; currency: string; stage: string;
  probabilityPct: number | null; expectedCloseDate: string | null; lostReason: string | null;
  leadName: string; leadEmail: string; createdAt: string;
  aiScore: number | null; aiNote: string | null; aiAssessedAt: string | null;
}

const STAGE_COLOR: Record<string, string> = {
  qualification: 'gray', needs_analysis: 'blue', proposal: 'purple', negotiation: 'amber',
  closed_won: 'green', closed_lost: 'red',
};
const STAGE_NEXT: Record<string, string[]> = {
  qualification: ['needs_analysis', 'closed_lost'], needs_analysis: ['proposal', 'closed_lost'],
  proposal: ['negotiation', 'closed_lost'], negotiation: ['closed_won', 'closed_lost'],
  closed_won: [], closed_lost: [],
};

// Opportunity -- the missing link between Lead and Proposal: a lead becomes
// an opportunity once genuinely qualified (a real sales judgment call, not
// automatic), moves through a real stage pipeline, and can have a proposal
// created against it once terms are ready.
function NewOpportunityForm({ leads, onCreated }: { leads: LeadRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(''); const [title, setTitle] = useState(''); const [estimatedValue, setEstimatedValue] = useState('');
  const [probabilityPct, setProbabilityPct] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/crm/opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, title, estimatedValue: Number(estimatedValue), probabilityPct: probabilityPct ? Number(probabilityPct) : undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setLeadId(''); setTitle(''); setEstimatedValue(''); setProbabilityPct(''); onCreated(); }
    else setError(body.error ?? 'Failed to create opportunity.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Opportunity</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <select value={leadId} onChange={e => setLeadId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
        <option value="">Select lead…</option>
        {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.email})</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Opportunity title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} type="number" min="0" step="0.01" placeholder="Estimated value (CAD)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={probabilityPct} onChange={e => setProbabilityPct(e.target.value)} type="number" min="0" max="100" placeholder="Win probability % (optional)" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !leadId || !title || !estimatedValue} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

function OpportunitiesTab() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [losingId, setLosingId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchJson<{ opportunities: OpportunityRow[] }>('/api/admin/crm/opportunities'),
      fetchJson<{ leads: LeadRow[] }>('/api/crm/leads'),
    ]).then(([o, l]) => { setOpportunities(o?.opportunities ?? []); setLeads(l?.leads ?? []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, stage: string, reason?: string) {
    await fetch(`/api/admin/crm/opportunities/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, lostReason: reason }),
    });
    setLosingId(null); setLostReason('');
    load();
  }

  const totalPipelineValue = opportunities.filter(o => !o.stage.startsWith('closed')).reduce((sum, o) => sum + o.estimatedValue, 0);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Opportunities ({opportunities.length})</h3>
            <p className="text-xs text-gray-500">Open pipeline value: ${totalPipelineValue.toFixed(2)}</p>
          </div>
          <NewOpportunityForm leads={leads} onCreated={load} />
        </div>
        {loading ? <EmptyState message="Loading…" /> : opportunities.length === 0 ? <EmptyState message="No opportunities yet — create one above." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Title', 'Lead', 'Value', 'Probability', 'Stage', 'AI Score', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {opportunities.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{o.title}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{o.leadName}</td>
                  <td className="px-3 py-2">{o.currency} {o.estimatedValue.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{o.probabilityPct !== null ? `${o.probabilityPct}%` : '—'}</td>
                  <td className="px-3 py-2"><Badge color={STAGE_COLOR[o.stage] ?? 'gray'}>{o.stage.replace('_', ' ')}</Badge></td>
                  <td className="px-3 py-2 max-w-[160px]">
                    {o.aiScore !== null ? (
                      <span title={o.aiNote ?? ''} className={`text-xs font-semibold ${o.aiScore >= 70 ? 'text-red-600' : o.aiScore >= 40 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {o.aiScore} <span className="font-normal text-gray-400">· {o.aiNote}</span>
                      </span>
                    ) : <span className="text-xs text-gray-300">not yet assessed</span>}
                  </td>
                  <td className="px-3 py-2">
                    {losingId === o.id ? (
                      <div className="flex gap-1 items-center">
                        <input value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Reason…" className="border rounded px-1.5 py-0.5 text-xs w-28" />
                        <button onClick={() => transition(o.id, 'closed_lost', lostReason)} disabled={!lostReason.trim()} className="text-xs text-red-600 hover:underline disabled:opacity-40">Confirm</button>
                        <button onClick={() => setLosingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {(STAGE_NEXT[o.stage] ?? []).map(s => (
                          <button key={s} onClick={() => s === 'closed_lost' ? setLosingId(o.id) : transition(o.id, s)} className="text-xs text-blue-600 hover:underline">
                            {s.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContractsTab() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signedByName, setSignedByName] = useState('');
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchJson<{ contracts: ContractRow[] }>('/api/admin/crm/contracts'),
      fetchJson<{ proposals: ProposalRow[] }>('/api/admin/crm/proposals'),
    ]).then(([c, p]) => { setContracts(c?.contracts ?? []); setProposals(p?.proposals ?? []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, status: string, name?: string) {
    await fetch(`/api/admin/crm/contracts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, signedByName: name }),
    });
    setSigningId(null); setSignedByName('');
    load();
  }

  async function generateInvoice(id: string) {
    setInvoicingId(id); setInvoiceError(null);
    const res = await fetch(`/api/admin/crm/contracts/${id}/generate-invoice`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setInvoicingId(null);
    if (!res.ok) { setInvoiceError(body.error ?? 'Failed to generate invoice.'); return; }
    load();
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Contracts ({contracts.length})</h3>
          <NewContractForm proposals={proposals} onCreated={load} />
        </div>
        {invoiceError && <p className="px-4 py-2 text-xs text-red-600 bg-red-50">{invoiceError}</p>}
        {loading ? <EmptyState message="Loading…" /> : contracts.length === 0 ? <EmptyState message="No contracts yet — create one from an accepted proposal above." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Title', 'Lead', 'Amount', 'Status', 'Signed By', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{c.title}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{c.leadName}</td>
                  <td className="px-3 py-2">{c.currency} {c.amount.toFixed(2)}</td>
                  <td className="px-3 py-2"><Badge color={CONTRACT_STATUS_COLOR[c.status] ?? 'gray'}>{c.status}</Badge></td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{c.signedByName ?? '—'}</td>
                  <td className="px-3 py-2">
                    {signingId === c.id ? (
                      <div className="flex gap-1 items-center">
                        <input value={signedByName} onChange={e => setSignedByName(e.target.value)} placeholder="Signed by…" className="border rounded px-1.5 py-0.5 text-xs w-28" />
                        <button onClick={() => transition(c.id, 'signed', signedByName)} disabled={!signedByName.trim()} className="text-xs text-green-600 hover:underline disabled:opacity-40">Confirm</button>
                        <button onClick={() => setSigningId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {(CONTRACT_NEXT_ACTIONS[c.status] ?? []).map(status => (
                          <button key={status} onClick={() => status === 'signed' ? setSigningId(c.id) : transition(c.id, status)} className="text-xs text-blue-600 hover:underline">
                            {status === 'sent' ? 'Mark Sent' : status === 'signed' ? 'Mark Signed' : 'Void'}
                          </button>
                        ))}
                        {c.status === 'signed' && (
                          <button onClick={() => generateInvoice(c.id)} disabled={invoicingId === c.id} className="text-xs text-green-600 hover:underline disabled:opacity-40">
                            {invoicingId === c.id ? 'Generating…' : 'Generate Invoice'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchJson<{ campaigns: CampaignRow[] }>('/api/crm/campaigns').then(d => setCampaigns(d?.campaigns ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: string) {
    setBusyId(id); setError(null);
    const res = await fetch(`/api/crm/campaigns/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) setError(body.error ?? `Failed to ${action} campaign.`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-semibold">CRM Campaigns</h3>
        <NewCampaignForm onCreated={load} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {campaigns.length === 0 ? <EmptyState message="No campaigns yet — create one above." /> : (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Campaign', 'Segment', 'Impressions', 'Click Rate', 'Conversions', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {campaigns.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.segment}</td>
                <td className="px-3 py-2">{c.sent.toLocaleString()}</td>
                <td className="px-3 py-2">{c.ctrPct}%</td>
                <td className="px-3 py-2 font-bold text-green-700">{c.conversions}</td>
                <td className="px-3 py-2"><Badge color={c.status === 'active' ? 'green' : c.status === 'completed' ? 'blue' : 'gray'}>{c.status}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    {(CAMPAIGN_ACTIONS[c.status] ?? []).map(a => (
                      <button key={a.action} disabled={busyId === c.id} onClick={() => transition(c.id, a.action)} className={`text-xs hover:underline disabled:opacity-50 ${a.color}`}>
                        {busyId === c.id ? '…' : a.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

export default function CRMAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM & Lifecycle</h1>
        <p className="text-sm text-gray-500 mt-1">Leads, pipeline, segmentation, CLV, churn analysis and campaigns</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'      && <OverviewTab />}
      {tab === 'Leads'         && <LeadsTab />}
      {tab === 'Pipeline'      && <PipelineTab />}
      {tab === 'Proposals'     && <ProposalsTab />}
      {tab === 'Opportunities' && <OpportunitiesTab />}
      {tab === 'Contracts'     && <ContractsTab />}
      {tab === 'Segmentation'  && <SegmentationTab />}
      {tab === 'CLV'           && <CLVTab />}
      {tab === 'Churn'         && <ChurnTab />}
      {tab === 'Voice of Customer' && <VoiceOfCustomerTab />}
      {tab === 'Campaigns'     && <CampaignsTab />}
    </div>
  );
}
