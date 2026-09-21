'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','jobs','clients','quotes','materials','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', jobs: 'Jobs', clients: 'Clients', quotes: 'Quotes', materials: 'Materials', ai: 'AI Estimator' };

const TRADE_TYPES = ['electrical','plumbing','hvac','carpentry','painting','roofing','concrete','landscaping','renovation','general','drywall','flooring','insulation','windows_doors'];
const JOB_STATUSES = ['estimate','quoted','approved','scheduled','in_progress','completed','invoiced','paid','warranty','cancelled'];
const JOB_PRIORITIES = ['urgent','high','normal','low'];
const CLIENT_TYPES = ['residential','commercial','industrial','strata','property_management'];
const CLIENT_SOURCES = ['referral','kijiji','google','facebook','door_knock','repeat'];
const QUOTE_STATUSES = ['draft','sent','accepted','declined','expired'];

interface TradeClient { id: number; name: string; email: string; phone: string; city: string; client_type: string; source: string; job_count: number; total_spend: number; last_job: string; }
interface TradeJob { id: number; job_number: string; title: string; trade_type: string; client_id: number; client_name: string; client_phone: string; address: string; city: string; status: string; priority: string; start_date: string; end_date: string; estimate_amount: number; quoted_amount: number; invoiced_amount: number; paid_amount: number; lead_worker: string; warranty_months: number; permit_required?: boolean; }
interface TradeQuote { id: number; client_id: number; client_name: string; title: string; trade_type: string; line_items: LineItem[]; subtotal: number; gst: number; total: number; valid_until: string; status: string; }
interface LineItem { description: string; quantity: number; unit: string; unit_price: number; total: number; }
interface TradeMaterial { id: number; job_id: number; description: string; quantity: number; unit: string; supplier: string; unit_cost: number; total_cost: number; ordered: boolean; received: boolean; }
interface DashStats { jobsByStatus: Record<string, { count: number; value: number }>; revenueMonth: { invoiced: number; paid: number }; overdue: number; quotesPending: number; materialsToOrder: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function tradeColor(t: string) {
  const m: Record<string, string> = { electrical: 'amber', plumbing: 'blue', hvac: 'teal', carpentry: 'orange', painting: 'purple', roofing: 'gray', concrete: 'gray', renovation: 'blue', landscaping: 'green', general: 'gray', drywall: 'gray', flooring: 'orange', insulation: 'amber', windows_doors: 'teal' };
  return m[t] ?? 'gray';
}
function statusColor(s: string) {
  const m: Record<string, string> = { estimate: 'gray', quoted: 'blue', approved: 'teal', scheduled: 'purple', in_progress: 'amber', completed: 'green', invoiced: 'purple', paid: 'green', warranty: 'teal', cancelled: 'red', draft: 'gray', sent: 'blue', accepted: 'green', declined: 'red', expired: 'gray' };
  return m[s] ?? 'gray';
}
function priorityColor(p: string) { const m: Record<string,string> = { urgent: 'red', high: 'amber', normal: 'blue', low: 'gray' }; return m[p] ?? 'gray'; }

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} p-6 overflow-y-auto max-h-[90vh]`}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button></div>
        {children}
      </div>
    </div>
  );
}

function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: 'Calgary', province: 'AB', client_type: 'residential', source: 'referral', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try { await fetch('/api/admin/trades-contractor/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Client" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-xs text-gray-500">Client Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e => f('client_type', e.target.value)}>{CLIENT_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.source} onChange={e => f('source', e.target.value)}>{CLIENT_SOURCES.map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button></div>
    </Modal>
  );
}

function AddJobModal({ clients, onClose, onSaved }: { clients: TradeClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', title: '', trade_type: 'electrical', description: '', address: '', city: 'Calgary', status: 'estimate', priority: 'normal', start_date: '', end_date: '', estimate_amount: '', quoted_amount: '', material_cost: '', labour_cost: '', permit_required: false, lead_worker: '', warranty_months: '12', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.client_id || !form.title) return;
    setSaving(true);
    try {
      await fetch('/api/admin/trades-contractor/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, estimate_amount: form.estimate_amount ? parseFloat(form.estimate_amount) : null, quoted_amount: form.quoted_amount ? parseFloat(form.quoted_amount) : null, material_cost: form.material_cost ? parseFloat(form.material_cost) : null, labour_cost: form.labour_cost ? parseFloat(form.labour_cost) : null, warranty_months: parseInt(form.warranty_months) || 0 }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <Modal title="New Job" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}><option value="">— Select Client —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Job Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e => f('title', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Trade Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade_type} onChange={e => f('trade_type', e.target.value)}>{TRADE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e => f('priority', e.target.value)}>{JOB_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{JOB_STATUSES.slice(0,5).map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Lead Worker</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lead_worker} onChange={e => f('lead_worker', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Warranty (months)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.warranty_months} onChange={e => f('warranty_months', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">End Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_date} onChange={e => f('end_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Estimate Amount</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.estimate_amount} onChange={e => f('estimate_amount', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Quoted Amount</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quoted_amount} onChange={e => f('quoted_amount', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Material Cost</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.material_cost} onChange={e => f('material_cost', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Labour Cost</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.labour_cost} onChange={e => f('labour_cost', e.target.value)} /></div>
        <div className="flex items-center gap-2"><input type="checkbox" id="permit" checked={form.permit_required} onChange={e => f('permit_required', e.target.checked)} /><label htmlFor="permit" className="text-sm text-gray-700">Permit Required</label></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Job'}</button></div>
    </Modal>
  );
}

function NewQuoteModal({ clients, onClose, onSaved }: { clients: TradeClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', title: '', trade_type: 'electrical', valid_until: '', terms: 'Payment due 30 days from invoice date. 2% monthly interest on overdue balances.' });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit: 'job', unit_price: 0, total: 0 }]);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  function updateLine(i: number, k: keyof LineItem, v: string | number) {
    setLineItems(items => items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [k]: v };
      if (k === 'quantity' || k === 'unit_price') updated.total = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  }
  const subtotal = lineItems.reduce((s, li) => s + (li.total || 0), 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  async function submit() {
    if (!form.client_id || !form.title) return;
    setSaving(true);
    try { await fetch('/api/admin/trades-contractor/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, line_items: lineItems }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="New Quote" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}><option value="">— Select —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Trade Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade_type} onChange={e => f('trade_type', e.target.value)}>{TRADE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Quote Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e => f('title', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Valid Until</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.valid_until} onChange={e => f('valid_until', e.target.value)} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-medium text-gray-700">Line Items</h4><button onClick={() => setLineItems(p => [...p, { description: '', quantity: 1, unit: 'job', unit_price: 0, total: 0 }])} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">+ Add Row</button></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded">
              <thead className="bg-gray-50"><tr>{['Description','Qty','Unit','Unit Price','Total',''].map(h => <th key={h} className="px-2 py-2 text-left text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {lineItems.map((li, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1"><input className="w-full border rounded px-1 py-1" value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} /></td>
                    <td className="px-2 py-1"><input type="number" className="w-16 border rounded px-1 py-1" value={li.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value))} /></td>
                    <td className="px-2 py-1"><input className="w-20 border rounded px-1 py-1" value={li.unit} onChange={e => updateLine(i, 'unit', e.target.value)} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.01" className="w-24 border rounded px-1 py-1" value={li.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value))} /></td>
                    <td className="px-2 py-1 font-medium">${Number(li.total).toFixed(2)}</td>
                    <td className="px-2 py-1"><button onClick={() => setLineItems(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">&times;</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right text-sm mt-2 space-y-0.5">
            <p className="text-gray-500">Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></p>
            <p className="text-gray-500">GST (5%): <span className="font-medium">${gst.toFixed(2)}</span></p>
            <p className="text-base font-bold">Total: ${(subtotal + gst).toFixed(2)}</p>
          </div>
        </div>
        <div><label className="text-xs text-gray-500">Terms</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.terms} onChange={e => f('terms', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Quote'}</button></div>
    </Modal>
  );
}

export default function TradesContractorPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [clients, setClients] = useState<TradeClient[]>([]);
  const [jobs, setJobs] = useState<TradeJob[]>([]);
  const [quotes, setQuotes] = useState<TradeQuote[]>([]);
  const [materials, setMaterials] = useState<TradeMaterial[]>([]);
  const [jobFilter, setJobFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [aiForm, setAiForm] = useState({ trade_type: 'electrical', description: '', sq_ft: '', materials_list: '', city: 'Calgary' });
  const [aiEstimate, setAiEstimate] = useState('');
  const [scopeForm, setScopeForm] = useState({ trade_type: 'electrical', client_description: '' });
  const [aiScope, setAiScope] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);

  const fetchStats = useCallback(async () => { const r = await fetch('/api/admin/trades-contractor'); if (r.ok) setStats(await r.json()); }, []);
  const fetchClients = useCallback(async () => { const r = await fetch('/api/admin/trades-contractor/clients'); if (r.ok) setClients(await r.json()); }, []);
  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    if (jobFilter) params.set('status', jobFilter);
    if (tradeFilter) params.set('trade_type', tradeFilter);
    const r = await fetch(`/api/admin/trades-contractor/jobs?${params}`);
    if (r.ok) setJobs(await r.json());
  }, [jobFilter, tradeFilter]);
  const fetchQuotes = useCallback(async () => { const params = quoteFilter ? `?status=${quoteFilter}` : ''; const r = await fetch(`/api/admin/trades-contractor/quotes${params}`); if (r.ok) setQuotes(await r.json()); }, [quoteFilter]);
  const fetchMaterials = useCallback(async () => { const r = await fetch('/api/admin/trades-contractor/jobs'); if (r.ok) { const js = await r.json(); const mats: TradeMaterial[] = []; for (const j of js) { const mr = await fetch(`/api/admin/trades-contractor/jobs/${j.id}/materials`); if (mr.ok) { const ms = await mr.json(); mats.push(...ms); } } setMaterials(mats); } }, []);

  useEffect(() => { fetchStats(); fetchClients(); fetchJobs(); fetchQuotes(); }, [fetchStats, fetchClients, fetchJobs, fetchQuotes]);
  useEffect(() => { if (tab === 'materials') fetchMaterials(); }, [tab, fetchMaterials]);
  useEffect(() => { fetchJobs(); }, [jobFilter, tradeFilter, fetchJobs]);
  useEffect(() => { fetchQuotes(); }, [quoteFilter, fetchQuotes]);

  async function advanceStatus(job: TradeJob, next: string) {
    await fetch(`/api/admin/trades-contractor/jobs/${job.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...job, status: next }) });
    fetchJobs(); fetchStats();
  }
  async function invoiceJob(job: TradeJob) {
    await fetch(`/api/admin/trades-contractor/jobs/${job.id}/invoice`, { method: 'POST' });
    fetchJobs(); fetchStats();
  }
  async function acceptQuote(id: number) {
    await fetch(`/api/admin/trades-contractor/quotes/${id}/accept`, { method: 'POST' });
    fetchQuotes(); fetchJobs(); fetchStats();
  }
  async function runEstimate() {
    if (!aiForm.description) return;
    setAiLoading(true); setAiEstimate('');
    try { const r = await fetch('/api/admin/trades-contractor/ai-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) }); if (r.ok) { const d = await r.json(); setAiEstimate(d.estimate || ''); } } finally { setAiLoading(false); }
  }
  async function runScope() {
    if (!scopeForm.client_description) return;
    setScopeLoading(true); setAiScope('');
    try { const r = await fetch('/api/admin/trades-contractor/ai-scope', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scopeForm) }); if (r.ok) { const d = await r.json(); setAiScope(d.scope || ''); } } finally { setScopeLoading(false); }
  }

  const STATUS_PIPELINE = ['estimate','quoted','approved','scheduled','in_progress'];
  const STATUS_NEXT: Record<string, string> = { estimate: 'quoted', quoted: 'approved', approved: 'scheduled', scheduled: 'in_progress', in_progress: 'completed' };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Trades & Contractor Hub</h1>
        <p className="text-slate-400 text-sm mt-0.5">CRM for Canadian Tradespeople — Electrical, Plumbing, HVAC & More</p>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6">

        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Invoiced This Month" value={fmtCad(stats.revenueMonth.invoiced)} color="blue" />
              <KpiCard label="Collected This Month" value={fmtCad(stats.revenueMonth.paid)} color="green" />
              <KpiCard label="Quotes Pending" value={stats.quotesPending} color="amber" sub="Awaiting client response" />
              <KpiCard label="Overdue Jobs" value={stats.overdue} color={stats.overdue > 0 ? 'red' : 'green'} sub="Past end date" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Materials to Order" value={stats.materialsToOrder} color="purple" />
              {['in_progress','scheduled','invoiced','estimate'].map(s => <KpiCard key={s} label={s.replace(/_/g,' ')} value={stats.jobsByStatus[s]?.count ?? 0} sub={stats.jobsByStatus[s]?.value ? fmtCad(stats.jobsByStatus[s].value) : undefined} color={statusColor(s)} />)}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Job Pipeline by Status</h3>
              <div className="flex flex-wrap gap-2">
                {JOB_STATUSES.map(s => (
                  <div key={s} className="text-center bg-gray-50 rounded-lg p-3 min-w-[90px]">
                    <p className="text-2xl font-bold">{stats.jobsByStatus[s]?.count ?? 0}</p>
                    <Badge label={s} color={statusColor(s)} />
                    {stats.jobsByStatus[s]?.value ? <p className="text-xs text-gray-400 mt-1">{fmtCad(stats.jobsByStatus[s].value)}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={jobFilter} onChange={e => setJobFilter(e.target.value)}><option value="">All Statuses</option>{JOB_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                <select className="border rounded px-3 py-1.5 text-sm" value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}><option value="">All Trades</option>{TRADE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <button onClick={() => setShowAddJob(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ New Job</button>
            </div>
            <div className="grid gap-4">
              {jobs.map(j => (
                <div key={j.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-400">{j.job_number}</span>
                        <Badge label={j.trade_type} color={tradeColor(j.trade_type)} />
                        <Badge label={j.priority} color={priorityColor(j.priority)} />
                        <Badge label={j.status} color={statusColor(j.status)} />
                        {j.permit_required && <Badge label="Permit" color="amber" />}
                      </div>
                      <h3 className="font-semibold text-slate-800">{j.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{j.client_name} · {j.address ? `${j.address}, ` : ''}{j.city}</p>
                      {j.lead_worker && <p className="text-xs text-gray-400 mt-0.5">Lead: {j.lead_worker}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {j.quoted_amount ? <p className="font-bold text-slate-800">{fmtCad(j.quoted_amount)}</p> : j.estimate_amount ? <p className="text-gray-500">{fmtCad(j.estimate_amount)} (est.)</p> : null}
                      {j.invoiced_amount && <p className="text-sm text-purple-600">Inv: {fmtCad(j.invoiced_amount)}</p>}
                      <div className="text-xs text-gray-400 mt-1">{j.start_date ? fmtDate(j.start_date) : '—'} → {j.end_date ? fmtDate(j.end_date) : '—'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {STATUS_PIPELINE.includes(j.status) && STATUS_NEXT[j.status] && (
                      <button onClick={() => advanceStatus(j, STATUS_NEXT[j.status])} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">→ {STATUS_NEXT[j.status].replace(/_/g,' ')}</button>
                    )}
                    {j.status === 'completed' && !j.invoiced_amount && (
                      <button onClick={() => invoiceJob(j)} className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Invoice</button>
                    )}
                  </div>
                </div>
              ))}
              {jobs.length === 0 && <p className="text-center text-gray-400 py-8">No jobs found</p>}
            </div>
            {showAddJob && <AddJobModal clients={clients} onClose={() => setShowAddJob(false)} onSaved={() => { setShowAddJob(false); fetchJobs(); fetchStats(); }} />}
          </div>
        )}

        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-end"><button onClick={() => setShowAddClient(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Client</button></div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name','Phone','Type','Source','Jobs','Total Spend','Last Job'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.email}</p></td>
                      <td className="px-4 py-3">{c.phone}</td>
                      <td className="px-4 py-3"><Badge label={c.client_type} color="blue" /></td>
                      <td className="px-4 py-3"><Badge label={c.source||'—'} color="gray" /></td>
                      <td className="px-4 py-3 text-center">{c.job_count}</td>
                      <td className="px-4 py-3 font-semibold">{fmtCad(c.total_spend)}</td>
                      <td className="px-4 py-3">{fmtDate(c.last_job)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clients.length === 0 && <p className="text-center text-gray-400 py-8">No clients yet</p>}
            </div>
            {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); fetchClients(); }} />}
          </div>
        )}

        {tab === 'quotes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <select className="border rounded px-3 py-1.5 text-sm" value={quoteFilter} onChange={e => setQuoteFilter(e.target.value)}><option value="">All Statuses</option>{QUOTE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              <button onClick={() => setShowAddQuote(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ New Quote</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Client','Title','Trade','Subtotal','GST','Total','Valid Until','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {quotes.map(q => (
                    <tr key={q.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{q.client_name}</td>
                      <td className="px-4 py-3">{q.title}</td>
                      <td className="px-4 py-3"><Badge label={q.trade_type||'—'} color={tradeColor(q.trade_type||'')} /></td>
                      <td className="px-4 py-3">{fmtCad(q.subtotal)}</td>
                      <td className="px-4 py-3">{fmtCad(q.gst)}</td>
                      <td className="px-4 py-3 font-bold">{fmtCad(q.total)}</td>
                      <td className="px-4 py-3">{fmtDate(q.valid_until)}</td>
                      <td className="px-4 py-3"><Badge label={q.status} color={statusColor(q.status)} /></td>
                      <td className="px-4 py-3">
                        {q.status === 'sent' && <button onClick={() => acceptQuote(q.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Accept</button>}
                        {q.status === 'draft' && <button onClick={async () => { await fetch(`/api/admin/trades-contractor/quotes/${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...q, status: 'sent' }) }); fetchQuotes(); }} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Send</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {quotes.length === 0 && <p className="text-center text-gray-400 py-8">No quotes found</p>}
            </div>
            {showAddQuote && <NewQuoteModal clients={clients} onClose={() => setShowAddQuote(false)} onSaved={() => { setShowAddQuote(false); fetchQuotes(); }} />}
          </div>
        )}

        {tab === 'materials' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Job ID','Description','Qty','Unit','Supplier','Unit Cost','Total','Ordered','Received'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">JOB-{m.job_id}</td>
                      <td className="px-4 py-3">{m.description}</td>
                      <td className="px-4 py-3">{m.quantity}</td>
                      <td className="px-4 py-3">{m.unit}</td>
                      <td className="px-4 py-3">{m.supplier || '—'}</td>
                      <td className="px-4 py-3">{m.unit_cost ? fmtCad(m.unit_cost) : '—'}</td>
                      <td className="px-4 py-3 font-semibold">{m.total_cost ? fmtCad(m.total_cost) : '—'}</td>
                      <td className="px-4 py-3"><Badge label={m.ordered ? 'Yes' : 'No'} color={m.ordered ? 'green' : 'red'} /></td>
                      <td className="px-4 py-3"><Badge label={m.received ? 'Yes' : 'No'} color={m.received ? 'green' : m.ordered ? 'amber' : 'gray'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {materials.length === 0 && <p className="text-center text-gray-400 py-8">No materials tracked yet</p>}
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-5 space-y-3">
                <h3 className="font-bold text-slate-800">AI Cost Estimator</h3>
                <p className="text-sm text-gray-500">Generate Calgary-market estimate breakdowns with labour, materials, and permits.</p>
                <div><label className="text-xs text-gray-500">Trade Type</label><select className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={aiForm.trade_type} onChange={e => setAiForm(p => ({ ...p, trade_type: e.target.value }))}>{TRADE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Project Description *</label><textarea className="w-full border rounded px-3 py-2 text-sm mt-0.5" rows={3} placeholder="Describe the project scope…" value={aiForm.description} onChange={e => setAiForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">Area (sq ft)</label><input type="number" className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={aiForm.sq_ft} onChange={e => setAiForm(p => ({ ...p, sq_ft: e.target.value }))} /></div>
                  <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={aiForm.city} onChange={e => setAiForm(p => ({ ...p, city: e.target.value }))} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Materials List (optional)</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="e.g. 200A Square D panel, 14/2 wire…" value={aiForm.materials_list} onChange={e => setAiForm(p => ({ ...p, materials_list: e.target.value }))} /></div>
                <button onClick={runEstimate} disabled={aiLoading || !aiForm.description} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{aiLoading ? 'Estimating…' : 'Generate Estimate'}</button>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-bold text-slate-800 mb-3">Estimate Breakdown</h3>
                {aiLoading && <div className="text-center text-gray-400 py-8"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" /><p>Generating estimate…</p></div>}
                {aiEstimate && !aiLoading && <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiEstimate}</div>}
                {!aiEstimate && !aiLoading && <p className="text-gray-400 text-sm">Fill in the form to generate a Calgary-market estimate breakdown.</p>}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-5 space-y-3">
                <h3 className="font-bold text-slate-800">AI Scope Writer</h3>
                <p className="text-sm text-gray-500">Convert a client&apos;s description into a professional Scope of Work document.</p>
                <div><label className="text-xs text-gray-500">Trade Type</label><select className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={scopeForm.trade_type} onChange={e => setScopeForm(p => ({ ...p, trade_type: e.target.value }))}>{TRADE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Client Description *</label><textarea className="w-full border rounded px-3 py-2 text-sm mt-0.5" rows={4} placeholder="Paste client email or description…" value={scopeForm.client_description} onChange={e => setScopeForm(p => ({ ...p, client_description: e.target.value }))} /></div>
                <button onClick={runScope} disabled={scopeLoading || !scopeForm.client_description} className="w-full py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">{scopeLoading ? 'Writing scope…' : 'Generate Scope of Work'}</button>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-bold text-slate-800 mb-3">Scope of Work</h3>
                {scopeLoading && <div className="text-center text-gray-400 py-8"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full mx-auto mb-2" /><p>Writing scope…</p></div>}
                {aiScope && !scopeLoading && <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiScope}</div>}
                {!aiScope && !scopeLoading && <p className="text-gray-400 text-sm">Enter a client description to generate a professional Scope of Work.</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
