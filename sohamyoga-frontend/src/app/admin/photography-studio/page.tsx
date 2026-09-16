'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'shoots', 'clients', 'packages', 'expenses', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', shoots: 'Shoots', clients: 'Clients', packages: 'Packages', expenses: 'Expenses', ai: 'AI Proposal Generator' };

const SHOOT_TYPES = ['portrait','wedding','corporate','real_estate','product','event','maternity','newborn','family','headshot','boudoir','other'];
const CLIENT_TYPES = ['individual','corporate','wedding','real_estate','commercial','editorial','other'];
const SHOOT_STATUSES = ['inquiry','booked','deposit_paid','completed','editing','delivered','archived'];
const EXPENSE_CATS = ['equipment','travel','props','second_shooter','venue_fee','printing','software','other'];

interface DashData { shoots_this_month: number; revenue_mtd: number; pending_deliveries: number; upcoming_shoots_7d: number; }
interface PhotoClient { id: number; first_name: string; last_name: string; email: string; phone: string; company: string; client_type: string; total_spent: number; shoot_count: number; referral_source: string; notes: string; }
interface Shoot { id: number; client_id: number; first_name: string; last_name: string; shoot_type: string; title: string; scheduled_at: string; location: string; duration_hours: number; photographer: string; status: string; package_name: string; package_price: number; deposit_paid: boolean; balance_paid: boolean; gallery_url: string; num_edited_photos: number; contract_signed: boolean; notes: string; }
interface Package { id: number; name: string; shoot_type: string; description: string; price: number; duration_hours: number; includes_edited_photos: number; includes_prints: boolean; travel_included_km: number; is_active: boolean; }
interface Expense { id: number; shoot_id: number; shoot_title: string; category: string; description: string; amount: number; created_at: string; }

function fmtCad(n: number | null) { return n != null ? `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDT(d: string) { return d ? new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function statusColor(s: string) {
  const m: Record<string, string> = { inquiry: 'gray', booked: 'blue', deposit_paid: 'purple', completed: 'green', editing: 'amber', delivered: 'teal', archived: 'gray' };
  return m[s] ?? 'gray';
}

// ─── Add Client Modal ────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', client_type: 'individual', referral_source: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/photography-studio/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Company</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company} onChange={e => f('company', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e => f('client_type', e.target.value)}>{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e => f('referral_source', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Shoot Modal ─────────────────────────────────────────────────────────
function AddShootModal({ clients, packages, onClose, onSaved }: { clients: PhotoClient[]; packages: Package[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', shoot_type: 'portrait', title: '', scheduled_at: '', location: '', duration_hours: '2', photographer: '', package_name: '', package_price: '', deposit_amount: '', balance_due: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function selectPackage(pkg: Package) {
    setForm(p => ({ ...p, package_name: pkg.name, package_price: String(pkg.price), duration_hours: String(pkg.duration_hours ?? 2), deposit_amount: String((pkg.price * 0.3).toFixed(2)), balance_due: String((pkg.price * 0.7).toFixed(2)) }));
  }

  async function submit() {
    if (!form.client_id || !form.title || !form.scheduled_at) return;
    setSaving(true);
    try {
      await fetch('/api/admin/photography-studio/shoots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, client_id: parseInt(form.client_id), duration_hours: parseFloat(form.duration_hours), package_price: form.package_price ? parseFloat(form.package_price) : null, deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null, balance_due: form.balance_due ? parseFloat(form.balance_due) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Book New Shoot</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}><option value="">Select…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.last_name}, {c.first_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Shoot Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shoot_type} onChange={e => f('shoot_type', e.target.value)}>{SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e => f('title', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Scheduled At *</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.scheduled_at} onChange={e => f('scheduled_at', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration (hrs)</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_hours} onChange={e => f('duration_hours', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e => f('location', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Photographer</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.photographer} onChange={e => f('photographer', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Package</label>
            <div className="flex gap-2 mt-0.5 flex-wrap">
              {packages.map(p => <button type="button" key={p.id} onClick={() => selectPackage(p)} className={`px-2 py-1 text-xs rounded border ${form.package_name === p.name ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}>{p.name} ({fmtCad(p.price)})</button>)}
            </div>
          </div>
          <div><label className="text-xs text-gray-500">Package Price ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.package_price} onChange={e => f('package_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Deposit ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deposit_amount} onChange={e => f('deposit_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Balance Due ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.balance_due} onChange={e => f('balance_due', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Book Shoot'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Deliver Modal ───────────────────────────────────────────────────────────
function DeliverModal({ shoot, onClose, onSaved }: { shoot: Shoot; onClose: () => void; onSaved: () => void }) {
  const [galleryUrl, setGalleryUrl] = useState(shoot.gallery_url ?? '');
  const [numPhotos, setNumPhotos] = useState(String(shoot.num_edited_photos ?? ''));
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/photography-studio/shoots/${shoot.id}/deliver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gallery_url: galleryUrl, num_edited_photos: numPhotos ? parseInt(numPhotos) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-96 p-6">
        <h3 className="font-bold mb-3 text-slate-800">Mark as Delivered — {shoot.title}</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Gallery URL</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={galleryUrl} onChange={e => setGalleryUrl(e.target.value)} placeholder="https://…" /></div>
          <div><label className="text-xs text-gray-500">Number of Edited Photos</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={numPhotos} onChange={e => setNumPhotos(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded bg-teal-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Mark Delivered'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────
function DashboardTab({ data, shoots }: { data: DashData | null; shoots: Shoot[] }) {
  const upcoming = shoots.filter(s => new Date(s.scheduled_at) >= new Date() && !['archived','delivered'].includes(s.status)).slice(0, 10);
  const totalRevenue = shoots.filter(s => !['inquiry','archived'].includes(s.status)).reduce((a, s) => a + (s.package_price ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Shoots This Month" value={data?.shoots_this_month ?? '—'} color="blue" />
        <KpiCard label="Revenue MTD" value={data ? fmtCad(data.revenue_mtd) : '—'} color="green" />
        <KpiCard label="Pending Deliveries" value={data?.pending_deliveries ?? '—'} color="amber" />
        <KpiCard label="Upcoming (7d)" value={data?.upcoming_shoots_7d ?? '—'} color="purple" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Upcoming Shoots</h3>
        <div className="space-y-2">
          {upcoming.length === 0 && <p className="text-gray-400 text-sm">No upcoming shoots.</p>}
          {upcoming.map(s => (
            <div key={s.id} className="bg-white border rounded-lg p-3 flex items-center justify-between gap-4 shadow-sm">
              <div>
                <p className="font-medium text-slate-800 text-sm">{s.title}</p>
                <p className="text-xs text-gray-500">{s.last_name}, {s.first_name} · {s.shoot_type} · {fmtDT(s.scheduled_at)}</p>
                <p className="text-xs text-gray-400">{s.location ?? 'Location TBD'} · {s.photographer ?? 'Photographer TBD'}</p>
              </div>
              <Badge label={s.status} color={statusColor(s.status)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shoots Kanban Tab ───────────────────────────────────────────────────────
function ShootsTab({ shoots, clients, packages, onRefresh }: { shoots: Shoot[]; clients: PhotoClient[]; packages: Package[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [deliverShoot, setDeliverShoot] = useState<Shoot | null>(null);

  async function markComplete(s: Shoot) {
    if (!confirm(`Mark "${s.title}" as completed?`)) return;
    await fetch(`/api/admin/photography-studio/shoots/${s.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance_paid: true }) });
    onRefresh();
  }
  async function moveStatus(s: Shoot, status: string) {
    await fetch(`/api/admin/photography-studio/shoots/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    onRefresh();
  }

  const cols: Record<string, Shoot[]> = {};
  SHOOT_STATUSES.forEach(st => { cols[st] = []; });
  shoots.forEach(s => { if (cols[s.status]) cols[s.status].push(s); });

  return (
    <div className="space-y-4">
      {showAdd && <AddShootModal clients={clients} packages={packages} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      {deliverShoot && <DeliverModal shoot={deliverShoot} onClose={() => setDeliverShoot(null)} onSaved={() => { setDeliverShoot(null); onRefresh(); }} />}
      <div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Book Shoot</button></div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {SHOOT_STATUSES.filter(s => s !== 'archived').map(st => (
            <div key={st} className="w-56 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{st.replace('_', ' ')} ({cols[st].length})</p>
              <div className="space-y-2">
                {cols[st].map(s => (
                  <div key={s.id} className="bg-white rounded p-2 shadow-sm text-xs border">
                    <p className="font-medium text-slate-800">{s.title}</p>
                    <p className="text-gray-500">{s.last_name}, {s.first_name}</p>
                    <p className="text-gray-400">{fmtDT(s.scheduled_at)}</p>
                    {s.package_price && <p className="text-green-600 font-medium">{fmtCad(s.package_price)}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {st === 'deposit_paid' && <button onClick={() => moveStatus(s, 'completed')} className="px-2 py-0.5 rounded bg-green-600 text-white text-xs">Complete</button>}
                      {st === 'completed' && <button onClick={() => markComplete(s)} className="px-2 py-0.5 rounded bg-green-700 text-white text-xs">Mark Done</button>}
                      {st === 'editing' && <button onClick={() => setDeliverShoot(s)} className="px-2 py-0.5 rounded bg-teal-600 text-white text-xs">Deliver</button>}
                      {st === 'inquiry' && <button onClick={() => moveStatus(s, 'booked')} className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs">Book</button>}
                      {st === 'booked' && <button onClick={() => moveStatus(s, 'deposit_paid')} className="px-2 py-0.5 rounded bg-purple-600 text-white text-xs">Deposit Paid</button>}
                      {st === 'completed' && <button onClick={() => moveStatus(s, 'editing')} className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs">Start Editing</button>}
                    </div>
                  </div>
                ))}
                {cols[st].length === 0 && <p className="text-xs text-gray-300 text-center py-2">—</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Tab ─────────────────────────────────────────────────────────────
function ClientsTab({ clients, onRefresh }: { clients: PhotoClient[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const filtered = clients.filter(c => `${c.first_name} ${c.last_name} ${c.email} ${c.company ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      <div className="flex items-center gap-3">
        <input className="border rounded px-2 py-1.5 text-sm flex-1 max-w-sm" placeholder="Search name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Client</button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Client', 'Type', 'Email', 'Phone', 'Company', 'Shoots', 'Total Spent', 'Referral'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-slate-800">{c.last_name}, {c.first_name}</td>
                <td className="px-3 py-2"><Badge label={c.client_type} color="blue" /></td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.email}</td>
                <td className="px-3 py-2 text-xs">{c.phone ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.company ?? '—'}</td>
                <td className="px-3 py-2 text-center font-medium">{c.shoot_count ?? 0}</td>
                <td className="px-3 py-2 text-green-600 font-medium">{fmtCad(c.total_spent)}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{c.referral_source ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No clients found.</p>}
      </div>
    </div>
  );
}

// ─── Packages Tab ─────────────────────────────────────────────────────────────
function PackagesTab() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', shoot_type: '', description: '', price: '', duration_hours: '2', includes_edited_photos: '', includes_prints: false, travel_included_km: '0' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch('/api/admin/photography-studio/packages').then(r => r.json());
    setPackages(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function addPackage() {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      await fetch('/api/admin/photography-studio/packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: parseFloat(form.price), duration_hours: parseFloat(form.duration_hours), includes_edited_photos: form.includes_edited_photos ? parseInt(form.includes_edited_photos) : null, travel_included_km: parseInt(form.travel_included_km) }) });
      setShowAdd(false);
      setForm({ name: '', shoot_type: '', description: '', price: '', duration_hours: '2', includes_edited_photos: '', includes_prints: false, travel_included_km: '0' });
      load();
    } finally { setSaving(false); }
  }

  async function deactivate(id: number) {
    await fetch(`/api/admin/photography-studio/packages/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Package</button></div>
      {showAdd && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">New Package</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Shoot Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shoot_type} onChange={e => f('shoot_type', e.target.value)}><option value="">All types</option>{SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Price ($) *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.price} onChange={e => f('price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Duration (hrs)</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_hours} onChange={e => f('duration_hours', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Edited Photos</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.includes_edited_photos} onChange={e => f('includes_edited_photos', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Travel (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.travel_included_km} onChange={e => f('travel_included_km', e.target.value)} /></div>
            <div className="col-span-3"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="prints" checked={form.includes_prints} onChange={e => f('includes_prints', e.target.checked)} /><label htmlFor="prints" className="text-sm">Includes Prints</label></div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
            <button onClick={addPackage} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create Package'}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packages.map(p => (
          <div key={p.id} className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{p.name}</h3>
                {p.shoot_type && <p className="text-xs text-gray-500 mt-0.5">{p.shoot_type}</p>}
              </div>
              <p className="text-xl font-bold text-green-600">{fmtCad(p.price)}</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">{p.description ?? '—'}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              {p.duration_hours && <p>• {p.duration_hours}h session</p>}
              {p.includes_edited_photos && <p>• {p.includes_edited_photos} edited photos</p>}
              {p.includes_prints && <p>• Prints included</p>}
              {p.travel_included_km > 0 && <p>• {p.travel_included_km}km travel included</p>}
            </div>
            <button onClick={() => deactivate(p.id)} className="mt-3 text-xs text-red-500 hover:underline">Deactivate</button>
          </div>
        ))}
        {packages.length === 0 && <p className="text-gray-400 text-sm col-span-3">No active packages.</p>}
      </div>
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ shoots }: { shoots: Shoot[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shootId, setShootId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ shoot_id: '', category: 'equipment', description: '', amount: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const url = shootId ? `/api/admin/photography-studio/expenses?shoot_id=${shootId}` : '/api/admin/photography-studio/expenses';
    const data = await fetch(url).then(r => r.json());
    setExpenses(Array.isArray(data) ? data : []);
  }, [shootId]);
  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function addExpense() {
    if (!form.shoot_id || !form.description || !form.amount) return;
    setSaving(true);
    try {
      await fetch('/api/admin/photography-studio/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, shoot_id: parseInt(form.shoot_id), amount: parseFloat(form.amount) }) });
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  }

  const total = expenses.reduce((a, e) => a + parseFloat(String(e.amount)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="border rounded px-2 py-1.5 text-sm" value={shootId} onChange={e => setShootId(e.target.value)}>
          <option value="">All Shoots</option>
          {shoots.map(s => <option key={s.id} value={s.id}>{s.title} ({s.last_name})</option>)}
        </select>
        <button onClick={() => setShowAdd(!showAdd)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Expense</button>
      </div>
      {showAdd && (
        <div className="bg-gray-50 border rounded-lg p-4 grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Shoot *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shoot_id} onChange={e => f('shoot_id', e.target.value)}><option value="">Select…</option>{shoots.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e => f('category', e.target.value)}>{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Amount ($) *</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.amount} onChange={e => f('amount', e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
            <button onClick={addExpense} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? '…' : 'Add'}</button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        <p className="font-bold text-slate-800">Total: {fmtCad(total)}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Shoot', 'Category', 'Description', 'Amount', 'Date'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-600">{e.shoot_title ?? '—'}</td>
                <td className="px-3 py-2"><Badge label={e.category} color="gray" /></td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2 font-medium text-red-600">{fmtCad(e.amount)}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{fmtDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No expenses found.</p>}
      </div>
    </div>
  );
}

// ─── AI Proposal Tab ──────────────────────────────────────────────────────────
function AIProposalTab({ clients }: { clients: PhotoClient[] }) {
  const [shootType, setShootType] = useState('portrait');
  const [clientId, setClientId] = useState('');
  const [details, setDetails] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAI, setIsAI] = useState(false);

  const selectedClient = clients.find(c => c.id === parseInt(clientId));
  const clientName = selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'Valued Client';

  async function generate() {
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/admin/photography-studio/ai-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shoot_type: shootType, client_name: clientName, details }) });
      const data = await res.json();
      setResult(data.result); setIsAI(data.ai);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Shoot Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={shootType} onChange={e => setShootType(e.target.value)}>{SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Client (optional)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Generic Client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.last_name}, {c.first_name}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Additional Details / Special Requests</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g. outdoor location, golden hour, 3 outfit changes, family of 4…" /></div>
      </div>
      <button onClick={generate} disabled={loading} className="px-5 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{loading ? 'Generating…' : 'Generate Proposal'}</button>
      {result && (
        <div className={`rounded-lg p-4 border text-sm whitespace-pre-wrap ${isAI ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500">{isAI ? '🤖 AI-Generated Proposal' : '📋 Standard Template'}</p>
            <button onClick={() => { navigator.clipboard.writeText(result); }} className="text-xs text-blue-600 hover:underline">Copy</button>
          </div>
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PhotographyStudioPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<PhotoClient[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  const loadAll = useCallback(async () => {
    const [d, sh, cl, pk] = await Promise.all([
      fetch('/api/admin/photography-studio').then(r => r.json()),
      fetch('/api/admin/photography-studio/shoots').then(r => r.json()),
      fetch('/api/admin/photography-studio/clients').then(r => r.json()),
      fetch('/api/admin/photography-studio/packages').then(r => r.json()),
    ]);
    setDash(d);
    setShoots(Array.isArray(sh) ? sh : []);
    setClients(Array.isArray(cl) ? cl : []);
    setPackages(Array.isArray(pk) ? pk : []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">Photography & Media Studio Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Client management, shoot booking, packages, expenses &amp; AI proposals</p>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab data={dash} shoots={shoots} />}
        {tab === 'shoots' && <ShootsTab shoots={shoots} clients={clients} packages={packages} onRefresh={loadAll} />}
        {tab === 'clients' && <ClientsTab clients={clients} onRefresh={loadAll} />}
        {tab === 'packages' && <PackagesTab />}
        {tab === 'expenses' && <ExpensesTab shoots={shoots} />}
        {tab === 'ai' && <AIProposalTab clients={clients} />}
      </div>
    </div>
  );
}
