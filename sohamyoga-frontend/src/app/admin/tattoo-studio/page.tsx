'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','appointments','clients','artists','supplies','ai-aftercare'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  'dashboard': 'Dashboard', 'appointments': 'Appointments', 'clients': 'Clients',
  'artists': 'Artists', 'supplies': 'Supplies', 'ai-aftercare': 'AI Aftercare',
};

const APPT_TYPES = ['new_tattoo','touch_up','cover_up','piercing','consultation','removal_referral'];
const APPT_STATUSES = ['consultation_pending','design_approved','booked','confirmed','in_progress','completed','cancelled','no_show'];
const STYLES = ['traditional','neo_traditional','realism','blackwork','geometric','watercolor','japanese','tribal','minimalist','lettering','portrait','other'];
const SUPPLY_CATEGORIES = ['ink','needle','aftercare','glove','barrier_film','machine_part','cleaning','piercing_jewelry','other'];

interface Client { id: number; first_name: string; last_name: string; email: string; phone: string; date_of_birth: string; age: number; id_verified: boolean; bloodborne_pathogen_consent: boolean; total_sessions: number; total_spent: number; keloid_prone: boolean; preferred_artist: string; referral_source: string; }
interface Artist { id: number; first_name: string; last_name: string; stage_name: string; email: string; phone: string; specialties: string[]; styles: string[]; bpp_expiry: string; bpp_days_remaining: number; booth_rent: number; commission_pct: number; instagram_handle: string; portfolio_url: string; status: string; }
interface Appointment { id: number; client_id: number; client_name: string; client_phone: string; id_verified: boolean; bloodborne_pathogen_consent: boolean; artist: string; appointment_type: string; scheduled_at: string; duration_hours: number; deposit_amount: number; deposit_paid: boolean; status: string; placement: string; size_inches: number; style: string; colors: string; total_amount: number; balance_due: number; aftercare_instructions_given: boolean; client_rating: number; }
interface Supply { id: number; name: string; category: string; brand: string; quantity_on_hand: number; unit: string; reorder_point: number; cost_per_unit: number; is_sterile_single_use: boolean; expiry_date: string; days_until_expiry: number; is_low_stock: boolean; }
interface DashData { appointments_today: number; revenue_today: number; deposits_collected_mtd: number; supplies_low_stock: number; artists_active: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDateTime(d: string) { return d ? new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

function Badge({ label, cls = 'bg-gray-100 text-gray-700' }: { label: string; cls?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const apptStatusColor: Record<string, string> = {
  consultation_pending: 'bg-yellow-100 text-yellow-700',
  design_approved: 'bg-blue-100 text-blue-700',
  booked: 'bg-indigo-100 text-indigo-700',
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-200 text-red-800',
};

export default function TattooStudioPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);

  const [apptDateFilter, setApptDateFilter] = useState('');
  const [apptArtistFilter, setApptArtistFilter] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [supplyFilter, setSupplyFilter] = useState<'all'|'low'|'expiring'>('all');

  const [showClientModal, setShowClientModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<Supply | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<Appointment | null>(null);

  const [clientForm, setClientForm] = useState<Record<string,string>>({ first_name:'',last_name:'',email:'',phone:'',date_of_birth:'',id_type:'',id_number:'',skin_type:'',referral_source:'',notes:'' });
  const [clientConsent, setClientConsent] = useState({ id_verified: false, bloodborne_pathogen_consent: false, keloid_prone: false });
  const [apptForm, setApptForm] = useState<Record<string,string>>({ client_id:'',artist:'',appointment_type:'new_tattoo',scheduled_at:'',duration_hours:'2',deposit_amount:'100',placement:'',size_inches:'',style:'traditional',colors:'black_grey',design_notes:'',notes:'' });
  const [apptDeposit, setApptDeposit] = useState(false);
  const [artistForm, setArtistForm] = useState<Record<string,string>>({ first_name:'',last_name:'',stage_name:'',email:'',phone:'',bloodborne_pathogen_cert_date:'',bpp_expiry:'',booth_rent:'',commission_pct:'',instagram_handle:'',portfolio_url:'' });
  const [supplyForm, setSupplyForm] = useState<Record<string,string>>({ name:'',category:'ink',brand:'',quantity_on_hand:'',unit:'unit',reorder_point:'10',cost_per_unit:'',supplier:'',expiry_date:'' });
  const [supplyIsSterile, setSupplyIsSterile] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [completeForm, setCompleteForm] = useState({ total_amount:'',client_rating:'' });

  const [aiApptId, setAiApptId] = useState('');
  const [aiForm, setAiForm] = useState({ placement:'',size_inches:'',style:'traditional',colors:'black_grey' });
  const [aiAftercare, setAiAftercare] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const flashErr = (m: string) => { setErr(m); setTimeout(() => setErr(''), 4000); };

  const loadDash = useCallback(async () => { const r = await fetch('/api/admin/tattoo-studio'); if (r.ok) setDash(await r.json()); }, []);
  const loadArtists = useCallback(async () => { const r = await fetch('/api/admin/tattoo-studio/artists'); if (r.ok) { const d = await r.json(); setArtists(d.artists); } }, []);
  const loadClients = useCallback(async () => {
    const params = new URLSearchParams();
    if (clientSearch) params.set('search', clientSearch);
    const r = await fetch(`/api/admin/tattoo-studio/clients?${params}`);
    if (r.ok) { const d = await r.json(); setClients(d.clients); }
  }, [clientSearch]);
  const loadAppointments = useCallback(async () => {
    const params = new URLSearchParams();
    if (apptDateFilter) params.set('date', apptDateFilter);
    if (apptArtistFilter) params.set('artist', apptArtistFilter);
    if (apptStatusFilter) params.set('status', apptStatusFilter);
    const r = await fetch(`/api/admin/tattoo-studio/appointments?${params}`);
    if (r.ok) { const d = await r.json(); setAppointments(d.appointments); }
  }, [apptDateFilter, apptArtistFilter, apptStatusFilter]);
  const loadSupplies = useCallback(async () => {
    const params = new URLSearchParams();
    if (supplyFilter === 'low') params.set('low_stock', 'true');
    if (supplyFilter === 'expiring') params.set('expiring', 'true');
    const r = await fetch(`/api/admin/tattoo-studio/supplies?${params}`);
    if (r.ok) { const d = await r.json(); setSupplies(d.supplies); }
  }, [supplyFilter]);

  useEffect(() => { loadDash(); loadArtists(); }, [loadDash, loadArtists]);
  useEffect(() => { if (tab === 'appointments') loadAppointments(); }, [tab, loadAppointments]);
  useEffect(() => { if (tab === 'clients') loadClients(); }, [tab, loadClients]);
  useEffect(() => { if (tab === 'supplies') loadSupplies(); }, [tab, loadSupplies]);

  async function addClient() {
    setLoading(true);
    const r = await fetch('/api/admin/tattoo-studio/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...clientForm, ...clientConsent }),
    });
    setLoading(false);
    if (r.ok) { setShowClientModal(false); loadClients(); flash('Client added'); }
    else { const e = await r.json(); flashErr(e.error || 'Error'); }
  }

  async function addAppointment() {
    setLoading(true);
    const r = await fetch('/api/admin/tattoo-studio/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...apptForm, client_id: Number(apptForm.client_id), duration_hours: Number(apptForm.duration_hours), deposit_amount: Number(apptForm.deposit_amount), deposit_paid: apptDeposit, size_inches: apptForm.size_inches ? Number(apptForm.size_inches) : null }),
    });
    setLoading(false);
    if (r.ok) { setShowApptModal(false); loadAppointments(); loadDash(); flash('Appointment booked'); }
    else { const e = await r.json(); flashErr(e.error || 'Error'); }
  }

  async function addArtist() {
    setLoading(true);
    const r = await fetch('/api/admin/tattoo-studio/artists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...artistForm, booth_rent: artistForm.booth_rent ? Number(artistForm.booth_rent) : null, commission_pct: artistForm.commission_pct ? Number(artistForm.commission_pct) : null }),
    });
    setLoading(false);
    if (r.ok) { setShowArtistModal(false); loadArtists(); flash('Artist added'); }
    else { const e = await r.json(); flashErr(e.error || 'Error'); }
  }

  async function addSupply() {
    setLoading(true);
    const r = await fetch('/api/admin/tattoo-studio/supplies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...supplyForm, quantity_on_hand: Number(supplyForm.quantity_on_hand), reorder_point: Number(supplyForm.reorder_point), cost_per_unit: supplyForm.cost_per_unit ? Number(supplyForm.cost_per_unit) : null, is_sterile_single_use: supplyIsSterile }),
    });
    setLoading(false);
    if (r.ok) { setShowSupplyModal(false); loadSupplies(); loadDash(); flash('Supply added'); }
    else { const e = await r.json(); flashErr(e.error || 'Error'); }
  }

  async function adjustSupply() {
    if (!showAdjustModal) return;
    const r = await fetch(`/api/admin/tattoo-studio/supplies/${showAdjustModal.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjust_quantity: Number(adjustQty) }),
    });
    if (r.ok) { setShowAdjustModal(null); setAdjustQty(''); loadSupplies(); loadDash(); flash('Quantity adjusted'); }
  }

  async function completeAppointment() {
    if (!showCompleteModal) return;
    const r = await fetch(`/api/admin/tattoo-studio/appointments/${showCompleteModal.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_amount: Number(completeForm.total_amount), client_rating: completeForm.client_rating ? Number(completeForm.client_rating) : null }),
    });
    if (r.ok) { setShowCompleteModal(null); loadAppointments(); loadDash(); flash('Appointment completed'); }
    else { const e = await r.json(); flashErr(e.error || 'Error'); }
  }

  async function checkIn(appt: Appointment) {
    const r = await fetch(`/api/admin/tattoo-studio/appointments/${appt.id}/checkin`, { method: 'POST' });
    if (r.ok) { loadAppointments(); flash('Client checked in'); }
    else { const e = await r.json(); flashErr(e.error || 'Check-in failed'); }
  }

  async function genAftercare() {
    setAiLoading(true); setAiAftercare('');
    const payload = aiApptId
      ? await fetch(`/api/admin/tattoo-studio/appointments/${aiApptId}`).then(r => r.json()).then(d => ({ placement: d.appointment?.placement, size_inches: d.appointment?.size_inches, style: d.appointment?.style, colors: d.appointment?.colors }))
      : aiForm;
    const r = await fetch('/api/admin/tattoo-studio/ai-aftercare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setAiLoading(false);
    if (r.ok) { const d = await r.json(); setAiAftercare(d.aftercare); }
  }

  const consentBadge = (client: Client) => {
    if (!client.id_verified || !client.bloodborne_pathogen_consent) {
      return <Badge label="Consent Required" cls="bg-red-100 text-red-700" />;
    }
    return <Badge label="Consent OK" cls="bg-green-100 text-green-700" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Tattoo &amp; Piercing Studio Hub</h1>
        <p className="text-sm text-gray-500">Appointments · Clients · Artists · Supplies · AI Aftercare — Alberta Regulated</p>
      </div>
      {msg && <div className="mx-6 mt-3 px-4 py-2 bg-green-100 text-green-800 rounded text-sm">{msg}</div>}
      {err && <div className="mx-6 mt-3 px-4 py-2 bg-red-100 text-red-800 rounded text-sm font-medium">{err}</div>}

      <div className="border-b bg-white">
        <div className="flex overflow-x-auto px-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Today's Appointments" value={dash.appointments_today} color="blue" />
              <KpiCard label="Revenue Today" value={fmtCad(dash.revenue_today)} color="green" />
              <KpiCard label="Deposits MTD" value={fmtCad(dash.deposits_collected_mtd)} color="purple" />
              <KpiCard label="Low Stock Items" value={dash.supplies_low_stock} color={dash.supplies_low_stock > 0 ? 'red' : 'green'} />
              <KpiCard label="Active Artists" value={dash.artists_active} color="blue" />
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700">Artist Roster</h2>
                <button onClick={() => setShowArtistModal(true)} className="text-sm px-3 py-1 bg-purple-600 text-white rounded">+ Add Artist</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {artists.filter(a => a.status === 'active').map(a => (
                  <div key={a.id} className="border rounded-lg p-3">
                    <p className="font-semibold">{a.stage_name || `${a.first_name} ${a.last_name}`}</p>
                    <div className="flex flex-wrap gap-1 mt-1">{(a.styles || []).map(s => <Badge key={s} label={s} cls="bg-purple-100 text-purple-700" />)}</div>
                    {a.bpp_days_remaining !== null && (
                      <p className={`text-xs mt-1 ${a.bpp_days_remaining < 30 ? 'text-red-600' : a.bpp_days_remaining < 90 ? 'text-amber-600' : 'text-green-600'}`}>
                        BPP: {fmtDate(a.bpp_expiry)} ({a.bpp_days_remaining}d)
                      </p>
                    )}
                    {a.instagram_handle && <p className="text-xs text-gray-400 mt-1">@{a.instagram_handle}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <input type="date" value={apptDateFilter} onChange={e => setApptDateFilter(e.target.value)} className={`${inp} w-40`} />
                <select value={apptArtistFilter} onChange={e => setApptArtistFilter(e.target.value)} className={`${sel} w-40`}>
                  <option value="">All Artists</option>
                  {artists.map(a => <option key={a.id} value={`${a.first_name} ${a.last_name}`}>{a.stage_name || `${a.first_name} ${a.last_name}`}</option>)}
                </select>
                <select value={apptStatusFilter} onChange={e => setApptStatusFilter(e.target.value)} className={`${sel} w-40`}>
                  <option value="">All Statuses</option>
                  {APPT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
                <button onClick={loadAppointments} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Filter</button>
              </div>
              <button onClick={() => setShowApptModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Book Appointment</button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Client','Artist','Type','Style/Placement','Time','Status','Deposit','Amount','Actions'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {appointments.map(appt => (
                    <tr key={appt.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <p className="font-medium">{appt.client_name}</p>
                        <p className="text-xs text-gray-400">{appt.client_phone}</p>
                        {(!appt.id_verified || !appt.bloodborne_pathogen_consent) && (
                          <Badge label="Consent Missing" cls="bg-red-100 text-red-700 mt-1" />
                        )}
                      </td>
                      <td className="px-3 py-3">{appt.artist}</td>
                      <td className="px-3 py-3"><Badge label={appt.appointment_type.replace(/_/g,' ')} cls="bg-gray-100 text-gray-700" /></td>
                      <td className="px-3 py-3">
                        <span className="text-xs">{appt.style && <Badge label={appt.style} cls="bg-indigo-100 text-indigo-700 mr-1" />}</span>
                        <span className="text-xs text-gray-500">{appt.placement}</span>
                        {appt.size_inches && <span className="text-xs text-gray-400"> · {appt.size_inches}"</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{fmtDateTime(appt.scheduled_at)}</td>
                      <td className="px-3 py-3"><Badge label={appt.status.replace(/_/g,' ')} cls={apptStatusColor[appt.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-3 py-3">
                        {appt.deposit_paid
                          ? <Badge label={`Paid ${fmtCad(appt.deposit_amount)}`} cls="bg-green-100 text-green-700" />
                          : <Badge label={`Due ${fmtCad(appt.deposit_amount)}`} cls="bg-amber-100 text-amber-700" />}
                      </td>
                      <td className="px-3 py-3">
                        {appt.total_amount ? fmtCad(appt.total_amount) : '—'}
                        {appt.balance_due > 0 && <p className="text-xs text-red-600">Bal: {fmtCad(appt.balance_due)}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {(appt.status === 'booked' || appt.status === 'confirmed') && (
                            <button onClick={() => checkIn(appt)} className="text-xs px-2 py-1 bg-amber-500 text-white rounded">Check In</button>
                          )}
                          {appt.status === 'in_progress' && (
                            <button onClick={() => { setShowCompleteModal(appt); setCompleteForm({ total_amount:'', client_rating:'' }); }} className="text-xs px-2 py-1 bg-green-600 text-white rounded">Complete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!appointments.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No appointments found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search name/phone/email..." className={`${inp} w-56`} />
                <button onClick={loadClients} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Search</button>
              </div>
              <button onClick={() => setShowClientModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Client</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Phone','Age','Consent Status','Sessions','Total Spent','Keloid','Preferred Artist'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                      <td className={`px-4 py-3 ${Number(c.age) < 18 ? 'text-red-600 font-bold' : 'text-gray-700'}`}>{c.age}</td>
                      <td className="px-4 py-3">{consentBadge(c)}</td>
                      <td className="px-4 py-3">{c.total_sessions}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmtCad(c.total_spent)}</td>
                      <td className="px-4 py-3">{c.keloid_prone ? <Badge label="Keloid Prone" cls="bg-red-100 text-red-700" /> : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.preferred_artist || '—'}</td>
                    </tr>
                  ))}
                  {!clients.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No clients found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ARTISTS */}
        {tab === 'artists' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold text-gray-700">Artist Management</h2>
              <button onClick={() => setShowArtistModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Artist</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {artists.map(a => (
                <div key={a.id} className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{a.stage_name || `${a.first_name} ${a.last_name}`}</h3>
                      {a.stage_name && <p className="text-xs text-gray-500">{a.first_name} {a.last_name}</p>}
                    </div>
                    <Badge label={a.status} cls={a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'guest' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(a.styles || []).map(s => <Badge key={s} label={s} cls="bg-purple-100 text-purple-700" />)}
                  </div>
                  {a.bpp_expiry && (
                    <div className={`text-xs px-2 py-1 rounded mb-2 ${Number(a.bpp_days_remaining) < 30 ? 'bg-red-50 text-red-700' : Number(a.bpp_days_remaining) < 90 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      BPP Cert: {fmtDate(a.bpp_expiry)} ({a.bpp_days_remaining}d remaining)
                    </div>
                  )}
                  <div className="text-xs text-gray-500 space-y-1">
                    {a.booth_rent && <p>Booth Rent: {fmtCad(a.booth_rent)}/mo</p>}
                    {a.commission_pct && <p>Commission: {a.commission_pct}%</p>}
                    {a.instagram_handle && <p>Instagram: @{a.instagram_handle}</p>}
                    {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noopener" className="text-blue-500 hover:underline">Portfolio</a>}
                  </div>
                </div>
              ))}
              {!artists.length && <p className="text-gray-400">No artists found</p>}
            </div>
          </div>
        )}

        {/* SUPPLIES */}
        {tab === 'supplies' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                {(['all','low','expiring'] as const).map(f => (
                  <button key={f} onClick={() => setSupplyFilter(f)} className={`px-3 py-1.5 rounded text-sm font-medium ${supplyFilter === f ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`}>{f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Expiring Soon'}</button>
                ))}
              </div>
              <button onClick={() => setShowSupplyModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Supply</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Category','Brand','Qty on Hand','Reorder Point','Status','Sterile/Single-use','Expiry','Actions'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {supplies.map(s => (
                    <tr key={s.id} className={`border-b hover:bg-gray-50 ${s.is_low_stock ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-3 font-medium">{s.name}</td>
                      <td className="px-3 py-3"><Badge label={s.category} cls="bg-gray-100 text-gray-700" /></td>
                      <td className="px-3 py-3 text-gray-500">{s.brand || '—'}</td>
                      <td className={`px-3 py-3 font-semibold ${s.is_low_stock ? 'text-red-600' : 'text-gray-800'}`}>{Number(s.quantity_on_hand).toFixed(1)} {s.unit}</td>
                      <td className="px-3 py-3 text-gray-500">{Number(s.reorder_point).toFixed(1)}</td>
                      <td className="px-3 py-3">{s.is_low_stock ? <Badge label="Low Stock" cls="bg-red-100 text-red-700" /> : <Badge label="OK" cls="bg-green-100 text-green-700" />}</td>
                      <td className="px-3 py-3">{s.is_sterile_single_use ? <Badge label="Sterile Single-Use" cls="bg-blue-100 text-blue-700" /> : '—'}</td>
                      <td className="px-3 py-3">
                        {s.expiry_date ? (
                          <span className={s.days_until_expiry < 0 ? 'text-red-600 font-bold' : s.days_until_expiry < 30 ? 'text-amber-600' : 'text-green-600'}>
                            {fmtDate(s.expiry_date)} ({s.days_until_expiry}d)
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => { setShowAdjustModal(s); setAdjustQty(''); }} className="text-xs px-2 py-1 border rounded text-gray-600">Adjust Qty</button>
                      </td>
                    </tr>
                  ))}
                  {!supplies.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No supplies found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI AFTERCARE */}
        {tab === 'ai-aftercare' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Aftercare Instructions Generator</h2>
              <p className="text-sm text-gray-500 mb-4">Enter an Appointment ID to auto-fill, or fill manually.</p>
              <div className="flex gap-2 mb-4">
                <input type="number" value={aiApptId} onChange={e => setAiApptId(e.target.value)} placeholder="Appointment ID (optional)" className={`${inp} flex-1`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormRow label="Placement *"><input value={aiForm.placement} onChange={e => setAiForm(f => ({ ...f, placement: e.target.value }))} className={inp} placeholder="e.g. forearm, ribcage" /></FormRow>
                <FormRow label="Size (inches)"><input type="number" step="0.5" value={aiForm.size_inches} onChange={e => setAiForm(f => ({ ...f, size_inches: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Style *">
                  <select value={aiForm.style} onChange={e => setAiForm(f => ({ ...f, style: e.target.value }))} className={sel}>
                    {STYLES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Colors">
                  <select value={aiForm.colors} onChange={e => setAiForm(f => ({ ...f, colors: e.target.value }))} className={sel}>
                    <option value="black_grey">Black &amp; Grey</option>
                    <option value="full_color">Full Color</option>
                    <option value="single_color">Single Color</option>
                  </select>
                </FormRow>
              </div>
              <button onClick={genAftercare} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded font-medium text-sm disabled:opacity-50 mt-2">
                {aiLoading ? 'Generating...' : 'Generate Aftercare Instructions'}
              </button>
              {aiAftercare && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium text-gray-500">Aftercare Instructions</p>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(aiAftercare)} className="text-xs text-blue-600">Copy</button>
                      <button onClick={() => window.print()} className="text-xs text-purple-600">Print</button>
                    </div>
                  </div>
                  <textarea readOnly value={aiAftercare} className="w-full h-64 border rounded p-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showClientModal && (
        <Modal title="Add New Client" onClose={() => setShowClientModal(false)}>
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-xs text-red-700">
            Clients must be 18+ years old. ID verification and consent required before booking.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="First Name *"><input value={clientForm.first_name} onChange={e => setClientForm(f => ({ ...f, first_name: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Last Name *"><input value={clientForm.last_name} onChange={e => setClientForm(f => ({ ...f, last_name: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Phone *"><input value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Email"><input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Date of Birth *"><input type="date" value={clientForm.date_of_birth} onChange={e => setClientForm(f => ({ ...f, date_of_birth: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="ID Type"><input value={clientForm.id_type} onChange={e => setClientForm(f => ({ ...f, id_type: e.target.value }))} className={inp} placeholder="Driver's License, Passport" /></FormRow>
            <FormRow label="ID Number"><input value={clientForm.id_number} onChange={e => setClientForm(f => ({ ...f, id_number: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Referral Source"><input value={clientForm.referral_source} onChange={e => setClientForm(f => ({ ...f, referral_source: e.target.value }))} className={inp} /></FormRow>
          <div className="space-y-2 mt-3 bg-gray-50 rounded p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clientConsent.id_verified} onChange={e => setClientConsent(c => ({ ...c, id_verified: e.target.checked }))} />
              <span>ID Verified</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clientConsent.bloodborne_pathogen_consent} onChange={e => setClientConsent(c => ({ ...c, bloodborne_pathogen_consent: e.target.checked }))} />
              <span>Bloodborne Pathogen Consent Signed</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clientConsent.keloid_prone} onChange={e => setClientConsent(c => ({ ...c, keloid_prone: e.target.checked }))} />
              <span>Keloid Prone</span>
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addClient} disabled={loading} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Client'}</button>
            <button onClick={() => setShowClientModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showApptModal && (
        <Modal title="Book Appointment" onClose={() => setShowApptModal(false)}>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-xs text-amber-700">Client must have ID verified and consent on file.</div>
          <FormRow label="Client ID *"><input type="number" value={apptForm.client_id} onChange={e => setApptForm(f => ({ ...f, client_id: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Artist *">
            <select value={apptForm.artist} onChange={e => setApptForm(f => ({ ...f, artist: e.target.value }))} className={sel}>
              <option value="">Select artist...</option>
              {artists.filter(a => a.status === 'active').map(a => <option key={a.id} value={`${a.first_name} ${a.last_name}`}>{a.stage_name || `${a.first_name} ${a.last_name}`}</option>)}
            </select>
          </FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Type *">
              <select value={apptForm.appointment_type} onChange={e => setApptForm(f => ({ ...f, appointment_type: e.target.value }))} className={sel}>
                {APPT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </FormRow>
            <FormRow label="Date &amp; Time *"><input type="datetime-local" value={apptForm.scheduled_at} onChange={e => setApptForm(f => ({ ...f, scheduled_at: e.target.value }))} className={inp} /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Placement"><input value={apptForm.placement} onChange={e => setApptForm(f => ({ ...f, placement: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Size (inches)"><input type="number" step="0.5" value={apptForm.size_inches} onChange={e => setApptForm(f => ({ ...f, size_inches: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Style">
              <select value={apptForm.style} onChange={e => setApptForm(f => ({ ...f, style: e.target.value }))} className={sel}>
                {STYLES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </FormRow>
            <FormRow label="Colors">
              <select value={apptForm.colors} onChange={e => setApptForm(f => ({ ...f, colors: e.target.value }))} className={sel}>
                <option value="black_grey">Black &amp; Grey</option>
                <option value="full_color">Full Color</option>
                <option value="single_color">Single Color</option>
              </select>
            </FormRow>
          </div>
          <FormRow label="Duration (hrs)"><input type="number" step="0.5" value={apptForm.duration_hours} onChange={e => setApptForm(f => ({ ...f, duration_hours: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Deposit ($)"><input type="number" step="0.01" value={apptForm.deposit_amount} onChange={e => setApptForm(f => ({ ...f, deposit_amount: e.target.value }))} className={inp} /></FormRow>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" checked={apptDeposit} onChange={e => setApptDeposit(e.target.checked)} />
            <span>Deposit Paid</span>
          </label>
          <div className="flex gap-2 mt-4">
            <button onClick={addAppointment} disabled={loading} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Book Appointment'}</button>
            <button onClick={() => setShowApptModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showArtistModal && (
        <Modal title="Add Artist" onClose={() => setShowArtistModal(false)}>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="First Name *"><input value={artistForm.first_name} onChange={e => setArtistForm(f => ({ ...f, first_name: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Last Name *"><input value={artistForm.last_name} onChange={e => setArtistForm(f => ({ ...f, last_name: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Stage Name"><input value={artistForm.stage_name} onChange={e => setArtistForm(f => ({ ...f, stage_name: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Email"><input type="email" value={artistForm.email} onChange={e => setArtistForm(f => ({ ...f, email: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="BPP Cert Date"><input type="date" value={artistForm.bloodborne_pathogen_cert_date} onChange={e => setArtistForm(f => ({ ...f, bloodborne_pathogen_cert_date: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="BPP Expiry"><input type="date" value={artistForm.bpp_expiry} onChange={e => setArtistForm(f => ({ ...f, bpp_expiry: e.target.value }))} className={inp} /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Booth Rent ($)"><input type="number" value={artistForm.booth_rent} onChange={e => setArtistForm(f => ({ ...f, booth_rent: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Commission %"><input type="number" value={artistForm.commission_pct} onChange={e => setArtistForm(f => ({ ...f, commission_pct: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Instagram Handle"><input value={artistForm.instagram_handle} onChange={e => setArtistForm(f => ({ ...f, instagram_handle: e.target.value }))} className={inp} placeholder="without @" /></FormRow>
          <FormRow label="Portfolio URL"><input value={artistForm.portfolio_url} onChange={e => setArtistForm(f => ({ ...f, portfolio_url: e.target.value }))} className={inp} /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={addArtist} disabled={loading} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Artist'}</button>
            <button onClick={() => setShowArtistModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showSupplyModal && (
        <Modal title="Add Supply" onClose={() => setShowSupplyModal(false)}>
          <FormRow label="Name *"><input value={supplyForm.name} onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Category">
              <select value={supplyForm.category} onChange={e => setSupplyForm(f => ({ ...f, category: e.target.value }))} className={sel}>
                {SUPPLY_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </FormRow>
            <FormRow label="Brand"><input value={supplyForm.brand} onChange={e => setSupplyForm(f => ({ ...f, brand: e.target.value }))} className={inp} /></FormRow>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FormRow label="Qty on Hand"><input type="number" step="0.1" value={supplyForm.quantity_on_hand} onChange={e => setSupplyForm(f => ({ ...f, quantity_on_hand: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Unit"><input value={supplyForm.unit} onChange={e => setSupplyForm(f => ({ ...f, unit: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Reorder Point"><input type="number" value={supplyForm.reorder_point} onChange={e => setSupplyForm(f => ({ ...f, reorder_point: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Supplier"><input value={supplyForm.supplier} onChange={e => setSupplyForm(f => ({ ...f, supplier: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Expiry Date"><input type="date" value={supplyForm.expiry_date} onChange={e => setSupplyForm(f => ({ ...f, expiry_date: e.target.value }))} className={inp} /></FormRow>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" checked={supplyIsSterile} onChange={e => setSupplyIsSterile(e.target.checked)} />
            <span>Sterile Single-Use Item</span>
          </label>
          <div className="flex gap-2 mt-4">
            <button onClick={addSupply} disabled={loading} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Supply'}</button>
            <button onClick={() => setShowSupplyModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showAdjustModal && (
        <Modal title={`Adjust Quantity — ${showAdjustModal.name}`} onClose={() => setShowAdjustModal(null)}>
          <p className="text-sm text-gray-500 mb-4">Current: {Number(showAdjustModal.quantity_on_hand).toFixed(1)} {showAdjustModal.unit}</p>
          <FormRow label="Adjustment (+ to add, - to use)">
            <input type="number" step="0.1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} className={inp} placeholder="e.g. -5 to use 5 units" />
          </FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={adjustSupply} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm font-medium">Adjust</button>
            <button onClick={() => setShowAdjustModal(null)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showCompleteModal && (
        <Modal title={`Complete — ${showCompleteModal.client_name}`} onClose={() => setShowCompleteModal(null)}>
          <p className="text-sm text-gray-500 mb-3">Deposit: {fmtCad(showCompleteModal.deposit_amount)} {showCompleteModal.deposit_paid ? '(paid)' : '(not paid)'}</p>
          <FormRow label="Total Amount ($) *"><input type="number" step="0.01" value={completeForm.total_amount} onChange={e => setCompleteForm(f => ({ ...f, total_amount: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Client Rating (1-5)"><input type="number" min="1" max="5" value={completeForm.client_rating} onChange={e => setCompleteForm(f => ({ ...f, client_rating: e.target.value }))} className={inp} /></FormRow>
          <p className="text-xs text-green-700 mt-1">Aftercare instructions will be marked as given. Balance due = Total - Deposit (if paid).</p>
          <div className="flex gap-2 mt-4">
            <button onClick={completeAppointment} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium">Complete Appointment</button>
            <button onClick={() => setShowCompleteModal(null)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
