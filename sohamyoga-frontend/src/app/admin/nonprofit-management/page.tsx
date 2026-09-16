'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','donors','donations','campaigns','volunteers','tax-receipts','ai-tools'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  'dashboard': 'Dashboard', 'donors': 'Donors', 'donations': 'Donations',
  'campaigns': 'Campaigns', 'volunteers': 'Volunteers',
  'tax-receipts': 'Tax Receipts', 'ai-tools': 'AI Fundraising Tools',
};

const GIVING_LEVELS = ['friend','supporter','patron','champion','benefactor','legacy'];
const DONOR_TYPES = ['individual','corporate','foundation','government','anonymous'];
const FUNDS = ['general','restricted','capital','endowment','emergency'];
const PAYMENT_METHODS = ['cheque','credit_card','etransfer','bank_transfer','paypal','cash','stock','in_kind'];
const CAMPAIGN_TYPES = ['annual_fund','capital','emergency','endowment','event','grant','matching','online','other'];
const CAMPAIGN_STATUSES = ['planning','active','completed','paused'];

interface Donor { id: number; first_name: string; last_name: string; email: string; phone: string; donor_type: string; giving_level: string; total_donated: number; last_donation_date: string; employer: string; employer_matching: boolean; communication_preference: string; tax_receipt_required: boolean; notes: string; }
interface Donation { id: number; donor_id: number; donor_name: string; amount: number; donation_date: string; fund: string; campaign_name: string; payment_method: string; tax_receipt_issued: boolean; tax_receipt_number: string; anonymous: boolean; }
interface Campaign { id: number; name: string; campaign_type: string; goal_amount: number; total_raised: number; donor_count: number; start_date: string; end_date: string; status: string; progress_pct: number; days_remaining: number; campaign_code: string; }
interface Volunteer { id: number; first_name: string; last_name: string; email: string; phone: string; skills: string[]; availability: string[]; total_hours: number; status: string; police_check_expiry: string; days_until_expiry: number; }
interface DashData { total_donors: number; total_donated_all_time: number; donations_mtd_count: number; donations_mtd_total: number; active_campaigns: Campaign[]; volunteers_active: number; tax_receipts_pending: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

const GIVING_COLORS: Record<string, string> = {
  friend: 'bg-gray-100 text-gray-700',
  supporter: 'bg-green-100 text-green-700',
  patron: 'bg-blue-100 text-blue-700',
  champion: 'bg-purple-100 text-purple-700',
  benefactor: 'bg-yellow-100 text-yellow-800',
  legacy: 'bg-gray-800 text-white',
};

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

function Thermometer({ pct, label }: { pct: number; label: string }) {
  const clamp = Math.min(Math.max(pct, 0), 100);
  const color = clamp >= 100 ? 'bg-green-500' : clamp >= 75 ? 'bg-blue-500' : clamp >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span><span>{clamp}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${clamp}%` }} />
      </div>
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
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function NonProfitManagementPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [taxPending, setTaxPending] = useState<Donation[]>([]);
  const [taxIssued, setTaxIssued] = useState<Donation[]>([]);

  const [donorSearch, setDonorSearch] = useState('');
  const [donorGivingFilter, setDonorGivingFilter] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('');
  const [taxTab, setTaxTab] = useState<'pending'|'issued'>('pending');
  const [batchFrom, setBatchFrom] = useState('');
  const [batchTo, setBatchTo] = useState('');

  const [showDonorModal, setShowDonorModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState<Volunteer | null>(null);

  const [donorForm, setDonorForm] = useState<Record<string, string>>({ first_name:'',last_name:'',email:'',phone:'',donor_type:'individual',giving_level:'friend',city:'Calgary',province:'AB',communication_preference:'email',employer:'' });
  const [donationForm, setDonationForm] = useState<Record<string, string>>({ donor_id:'',amount:'',donation_date:'',fund:'general',payment_method:'cheque',campaign_id:'' });
  const [campaignForm, setCampaignForm] = useState<Record<string, string>>({ name:'',description:'',campaign_type:'annual_fund',goal_amount:'',start_date:'',end_date:'',status:'planning' });
  const [volunteerForm, setVolunteerForm] = useState<Record<string, string>>({ first_name:'',last_name:'',email:'',phone:'',skills:'',police_check_date:'',police_check_expiry:'' });
  const [hoursToAdd, setHoursToAdd] = useState('');

  const [aiLetterForm, setAiLetterForm] = useState({ donor_name:'',amount:'',fund:'general',campaign_name:'',giving_level:'friend',organization_name:'',charitable_reg_number:'' });
  const [aiGrantForm, setAiGrantForm] = useState({ program_name:'',amount:'',funder:'',organization_name:'',mission:'',target_population:'' });
  const [aiLetter, setAiLetter] = useState('');
  const [aiGrant, setAiGrant] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadDash = useCallback(async () => {
    const r = await fetch('/api/admin/nonprofit-management');
    if (r.ok) setDash(await r.json());
  }, []);

  const loadDonors = useCallback(async () => {
    const params = new URLSearchParams();
    if (donorSearch) params.set('search', donorSearch);
    if (donorGivingFilter) params.set('giving_level', donorGivingFilter);
    const r = await fetch(`/api/admin/nonprofit-management/donors?${params}`);
    if (r.ok) { const d = await r.json(); setDonors(d.donors); }
  }, [donorSearch, donorGivingFilter]);

  const loadDonations = useCallback(async () => {
    const r = await fetch('/api/admin/nonprofit-management/donations');
    if (r.ok) { const d = await r.json(); setDonations(d.donations); }
  }, []);

  const loadCampaigns = useCallback(async () => {
    const params = new URLSearchParams();
    if (campaignStatusFilter) params.set('status', campaignStatusFilter);
    const r = await fetch(`/api/admin/nonprofit-management/campaigns?${params}`);
    if (r.ok) { const d = await r.json(); setCampaigns(d.campaigns); }
  }, [campaignStatusFilter]);

  const loadVolunteers = useCallback(async () => {
    const r = await fetch('/api/admin/nonprofit-management/volunteers');
    if (r.ok) { const d = await r.json(); setVolunteers(d.volunteers); }
  }, []);

  const loadTaxReceipts = useCallback(async () => {
    const [p, i] = await Promise.all([
      fetch('/api/admin/nonprofit-management/tax-receipts?issued=false'),
      fetch('/api/admin/nonprofit-management/tax-receipts?issued=true'),
    ]);
    if (p.ok) { const d = await p.json(); setTaxPending(d.receipts); }
    if (i.ok) { const d = await i.json(); setTaxIssued(d.receipts); }
  }, []);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { if (tab === 'donors') loadDonors(); }, [tab, loadDonors]);
  useEffect(() => { if (tab === 'donations') loadDonations(); }, [tab, loadDonations]);
  useEffect(() => { if (tab === 'campaigns') loadCampaigns(); }, [tab, loadCampaigns]);
  useEffect(() => { if (tab === 'volunteers') loadVolunteers(); }, [tab, loadVolunteers]);
  useEffect(() => { if (tab === 'tax-receipts') loadTaxReceipts(); }, [tab, loadTaxReceipts]);

  async function addDonor() {
    setLoading(true);
    const r = await fetch('/api/admin/nonprofit-management/donors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donorForm),
    });
    setLoading(false);
    if (r.ok) { setShowDonorModal(false); loadDonors(); flash('Donor added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }

  async function addDonation() {
    setLoading(true);
    const r = await fetch('/api/admin/nonprofit-management/donations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...donationForm, donor_id: Number(donationForm.donor_id), amount: Number(donationForm.amount), campaign_id: donationForm.campaign_id ? Number(donationForm.campaign_id) : null }),
    });
    setLoading(false);
    if (r.ok) { setShowDonationModal(false); loadDonations(); loadDash(); flash('Donation recorded'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }

  async function addCampaign() {
    setLoading(true);
    const r = await fetch('/api/admin/nonprofit-management/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...campaignForm, goal_amount: Number(campaignForm.goal_amount) }),
    });
    setLoading(false);
    if (r.ok) { setShowCampaignModal(false); loadCampaigns(); flash('Campaign created'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }

  async function addVolunteer() {
    setLoading(true);
    const skills = volunteerForm.skills ? volunteerForm.skills.split(',').map(s => s.trim()) : [];
    const r = await fetch('/api/admin/nonprofit-management/volunteers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...volunteerForm, skills }),
    });
    setLoading(false);
    if (r.ok) { setShowVolunteerModal(false); loadVolunteers(); flash('Volunteer added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }

  async function issueTaxReceipt(id: number) {
    const r = await fetch(`/api/admin/nonprofit-management/donations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issue_tax_receipt: true }),
    });
    if (r.ok) { loadTaxReceipts(); loadDash(); flash('Tax receipt issued'); }
  }

  async function batchIssueTaxReceipts() {
    if (!batchFrom || !batchTo) { flash('Select date range'); return; }
    const r = await fetch('/api/admin/nonprofit-management/tax-receipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_from: batchFrom, date_to: batchTo }),
    });
    if (r.ok) { const d = await r.json(); loadTaxReceipts(); loadDash(); flash(`Issued ${d.issued} receipts`); }
  }

  async function logHours() {
    if (!showHoursModal || !hoursToAdd) return;
    const r = await fetch(`/api/admin/nonprofit-management/volunteers/${showHoursModal.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add_hours: Number(hoursToAdd) }),
    });
    if (r.ok) { setShowHoursModal(null); setHoursToAdd(''); loadVolunteers(); flash('Hours logged'); }
  }

  async function genLetter() {
    setAiLoading(true); setAiLetter('');
    const r = await fetch('/api/admin/nonprofit-management/ai-donor-letter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiLetterForm),
    });
    setAiLoading(false);
    if (r.ok) { const d = await r.json(); setAiLetter(d.letter); }
  }

  async function genGrant() {
    setAiLoading(true); setAiGrant('');
    const r = await fetch('/api/admin/nonprofit-management/ai-grant-proposal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiGrantForm),
    });
    setAiLoading(false);
    if (r.ok) { const d = await r.json(); setAiGrant(d.proposal); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Non-Profit &amp; Charity Management Hub</h1>
        <p className="text-sm text-gray-500">Donors · Donations · Campaigns · Volunteers · Tax Receipts · AI Fundraising</p>
      </div>

      {msg && <div className="mx-6 mt-3 px-4 py-2 bg-green-100 text-green-800 rounded text-sm">{msg}</div>}

      <div className="border-b bg-white">
        <div className="flex overflow-x-auto px-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Donors" value={dash.total_donors} color="blue" />
              <KpiCard label="Donations This Month" value={fmtCad(dash.donations_mtd_total)} sub={`${dash.donations_mtd_count} donations`} color="green" />
              <KpiCard label="Active Volunteers" value={dash.volunteers_active} color="purple" />
              <KpiCard label="Tax Receipts Pending" value={dash.tax_receipts_pending} sub="Need issuance" color={dash.tax_receipts_pending > 0 ? 'red' : 'green'} />
            </div>

            {dash.active_campaigns.length > 0 && (
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="font-semibold text-gray-700 mb-4">Active Campaign Progress</h2>
                <div className="space-y-4">
                  {dash.active_campaigns.map(c => (
                    <div key={c.id}>
                      <div className="flex justify-between text-sm font-medium text-gray-700">
                        <span>{c.name}</span>
                        <span>{fmtCad(c.total_raised)} / {fmtCad(c.goal_amount)}</span>
                      </div>
                      <Thermometer pct={c.progress_pct} label={`${c.donor_count} donors · ${c.days_remaining != null ? `${c.days_remaining}d left` : 'No end date'}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold text-gray-700 mb-2">All-Time Impact</h2>
              <p className="text-3xl font-bold text-green-600">{fmtCad(dash.total_donated_all_time)}</p>
              <p className="text-sm text-gray-500">Total raised from {dash.total_donors} donors</p>
            </div>
          </div>
        )}

        {/* DONORS */}
        {tab === 'donors' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <input value={donorSearch} onChange={e => setDonorSearch(e.target.value)} onBlur={loadDonors} placeholder="Search name/email/employer..." className={`${inp} w-56`} />
                <select value={donorGivingFilter} onChange={e => { setDonorGivingFilter(e.target.value); }} className={`${sel} w-40`}>
                  <option value="">All Levels</option>
                  {GIVING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={loadDonors} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Search</button>
              </div>
              <button onClick={() => setShowDonorModal(true)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ Add Donor</button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Email','Type','Level','Total Donated','Last Gift','Employer','Notes'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {donors.map(d => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{d.first_name} {d.last_name}</td>
                      <td className="px-4 py-3 text-gray-500">{d.email}</td>
                      <td className="px-4 py-3"><Badge label={d.donor_type} cls="bg-gray-100 text-gray-700" /></td>
                      <td className="px-4 py-3"><Badge label={d.giving_level} cls={GIVING_COLORS[d.giving_level] ?? 'bg-gray-100 text-gray-700'} /></td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmtCad(d.total_donated)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(d.last_donation_date)}</td>
                      <td className="px-4 py-3">{d.employer} {d.employer_matching && <Badge label="Matching" cls="bg-purple-100 text-purple-700 ml-1" />}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.notes}</td>
                    </tr>
                  ))}
                  {!donors.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No donors found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DONATIONS */}
        {tab === 'donations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-700">Donation Records</h2>
              <button onClick={() => setShowDonationModal(true)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ Add Donation</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Donor','Amount','Date','Fund','Campaign','Method','Tax Receipt','Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {donations.map(d => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{d.anonymous ? <span className="italic text-gray-400">Anonymous</span> : d.donor_name}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{fmtCad(d.amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(d.donation_date)}</td>
                      <td className="px-4 py-3"><Badge label={d.fund} cls="bg-blue-100 text-blue-700" /></td>
                      <td className="px-4 py-3 text-gray-500">{d.campaign_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{d.payment_method || '—'}</td>
                      <td className="px-4 py-3">
                        {d.tax_receipt_issued
                          ? <Badge label={`Issued: ${d.tax_receipt_number}`} cls="bg-green-100 text-green-700" />
                          : <Badge label="Pending" cls="bg-amber-100 text-amber-700" />}
                      </td>
                      <td className="px-4 py-3">
                        {!d.tax_receipt_issued && (
                          <button onClick={() => issueTaxReceipt(d.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Issue Receipt</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!donations.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No donations found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CAMPAIGNS */}
        {tab === 'campaigns' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <select value={campaignStatusFilter} onChange={e => setCampaignStatusFilter(e.target.value)} className={`${sel} w-40`}>
                <option value="">All Statuses</option>
                {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setShowCampaignModal(true)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ Add Campaign</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <div key={c.id} className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{c.name}</h3>
                    <Badge label={c.status} cls={c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'} />
                  </div>
                  <Badge label={c.campaign_type.replace('_',' ')} cls="bg-purple-100 text-purple-700 mb-3" />
                  <div className="text-sm text-gray-500 mb-3">
                    <div>{c.donor_count} donors</div>
                    {c.days_remaining != null && <div>{c.days_remaining > 0 ? `${c.days_remaining} days left` : 'Ended'}</div>}
                    <div className="text-xs mt-1">Code: {c.campaign_code}</div>
                  </div>
                  <Thermometer pct={c.progress_pct} label={`${fmtCad(c.total_raised)} of ${fmtCad(c.goal_amount)}`} />
                </div>
              ))}
              {!campaigns.length && <p className="text-gray-400 col-span-3">No campaigns found</p>}
            </div>
          </div>
        )}

        {/* VOLUNTEERS */}
        {tab === 'volunteers' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold text-gray-700">Volunteer Roster</h2>
              <button onClick={() => setShowVolunteerModal(true)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ Add Volunteer</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Email','Status','Total Hours','Police Check Expiry','Skills','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {volunteers.map(v => {
                    const daysLeft = v.days_until_expiry;
                    const policeColor = !v.police_check_expiry ? 'text-gray-400' : daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft < 30 ? 'text-amber-600 font-semibold' : 'text-green-600';
                    return (
                      <tr key={v.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{v.first_name} {v.last_name}</td>
                        <td className="px-4 py-3 text-gray-500">{v.email}</td>
                        <td className="px-4 py-3"><Badge label={v.status} cls={v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3">{Number(v.total_hours).toFixed(1)}h</td>
                        <td className={`px-4 py-3 ${policeColor}`}>{v.police_check_expiry ? `${fmtDate(v.police_check_expiry)} (${daysLeft}d)` : 'Not on file'}</td>
                        <td className="px-4 py-3">{(v.skills || []).map(s => <Badge key={s} label={s} cls="bg-gray-100 text-gray-600 mr-1" />)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setShowHoursModal(v)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Log Hours</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!volunteers.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No volunteers found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAX RECEIPTS */}
        {tab === 'tax-receipts' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTaxTab('pending')} className={`px-4 py-2 rounded text-sm font-medium ${taxTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-white border text-gray-600'}`}>Pending ({taxPending.length})</button>
              <button onClick={() => setTaxTab('issued')} className={`px-4 py-2 rounded text-sm font-medium ${taxTab === 'issued' ? 'bg-green-600 text-white' : 'bg-white border text-gray-600'}`}>Issued ({taxIssued.length})</button>
            </div>

            {taxTab === 'pending' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-3">Batch Issue by Date Range</h3>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div><label className="text-xs text-gray-600">From</label><input type="date" value={batchFrom} onChange={e => setBatchFrom(e.target.value)} className={inp} /></div>
                    <div><label className="text-xs text-gray-600">To</label><input type="date" value={batchTo} onChange={e => setBatchTo(e.target.value)} className={inp} /></div>
                    <button onClick={batchIssueTaxReceipts} className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-medium">Batch Issue</button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Donor','Amount','Date','Fund','Issue Receipt'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {taxPending.map(d => (
                        <tr key={d.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{d.donor_name}</td>
                          <td className="px-4 py-3 font-bold text-green-700">{fmtCad(d.amount)}</td>
                          <td className="px-4 py-3 text-gray-500">{fmtDate(d.donation_date)}</td>
                          <td className="px-4 py-3"><Badge label={d.fund} cls="bg-blue-100 text-blue-700" /></td>
                          <td className="px-4 py-3"><button onClick={() => issueTaxReceipt(d.id)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Issue</button></td>
                        </tr>
                      ))}
                      {!taxPending.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No pending tax receipts</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {taxTab === 'issued' && (
              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Donor','Amount','Donation Date','Receipt Number','Issued Date','Fund'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {taxIssued.map(d => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{d.donor_name}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{fmtCad(d.amount)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(d.donation_date)}</td>
                        <td className="px-4 py-3"><Badge label={d.tax_receipt_number || '—'} cls="bg-green-100 text-green-700" /></td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate((d as any).tax_receipt_date)}</td>
                        <td className="px-4 py-3"><Badge label={d.fund} cls="bg-blue-100 text-blue-700" /></td>
                      </tr>
                    ))}
                    {!taxIssued.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No issued receipts</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai-tools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Donor Thank-You Letter Generator</h2>
              <div className="space-y-3">
                <FormRow label="Donor Name"><input value={aiLetterForm.donor_name} onChange={e => setAiLetterForm(f => ({ ...f, donor_name: e.target.value }))} className={inp} placeholder="Jane Smith" /></FormRow>
                <FormRow label="Donation Amount ($)"><input type="number" value={aiLetterForm.amount} onChange={e => setAiLetterForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Organization Name"><input value={aiLetterForm.organization_name} onChange={e => setAiLetterForm(f => ({ ...f, organization_name: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Fund">
                  <select value={aiLetterForm.fund} onChange={e => setAiLetterForm(f => ({ ...f, fund: e.target.value }))} className={sel}>
                    {FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Giving Level">
                  <select value={aiLetterForm.giving_level} onChange={e => setAiLetterForm(f => ({ ...f, giving_level: e.target.value }))} className={sel}>
                    {GIVING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FormRow>
                <FormRow label="CRA Reg. Number"><input value={aiLetterForm.charitable_reg_number} onChange={e => setAiLetterForm(f => ({ ...f, charitable_reg_number: e.target.value }))} className={inp} placeholder="123456789 RR 0001" /></FormRow>
                <button onClick={genLetter} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded font-medium text-sm disabled:opacity-50">
                  {aiLoading ? 'Generating...' : 'Generate Letter'}
                </button>
              </div>
              {aiLetter && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500">Generated Letter</p>
                    <button onClick={() => navigator.clipboard.writeText(aiLetter)} className="text-xs text-blue-600">Copy</button>
                  </div>
                  <textarea readOnly value={aiLetter} className="w-full h-48 border rounded p-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Grant Proposal Section Generator</h2>
              <div className="space-y-3">
                <FormRow label="Organization Name"><input value={aiGrantForm.organization_name} onChange={e => setAiGrantForm(f => ({ ...f, organization_name: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Program/Project Name"><input value={aiGrantForm.program_name} onChange={e => setAiGrantForm(f => ({ ...f, program_name: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Requested Amount ($)"><input type="number" value={aiGrantForm.amount} onChange={e => setAiGrantForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></FormRow>
                <FormRow label="Funding Body"><input value={aiGrantForm.funder} onChange={e => setAiGrantForm(f => ({ ...f, funder: e.target.value }))} className={inp} placeholder="e.g. United Way, Government of Alberta" /></FormRow>
                <FormRow label="Mission Statement"><textarea value={aiGrantForm.mission} onChange={e => setAiGrantForm(f => ({ ...f, mission: e.target.value }))} className={`${inp} h-16`} /></FormRow>
                <FormRow label="Target Population"><input value={aiGrantForm.target_population} onChange={e => setAiGrantForm(f => ({ ...f, target_population: e.target.value }))} className={inp} /></FormRow>
                <button onClick={genGrant} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded font-medium text-sm disabled:opacity-50">
                  {aiLoading ? 'Generating...' : 'Generate Grant Proposal Section'}
                </button>
              </div>
              {aiGrant && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500">Generated Proposal Section</p>
                    <button onClick={() => navigator.clipboard.writeText(aiGrant)} className="text-xs text-blue-600">Copy</button>
                  </div>
                  <textarea readOnly value={aiGrant} className="w-full h-48 border rounded p-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showDonorModal && (
        <Modal title="Add New Donor" onClose={() => setShowDonorModal(false)}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="First Name *"><input value={donorForm.first_name} onChange={e => setDonorForm(f => ({ ...f, first_name: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="Last Name *"><input value={donorForm.last_name} onChange={e => setDonorForm(f => ({ ...f, last_name: e.target.value }))} className={inp} /></FormRow>
            </div>
            <FormRow label="Email *"><input type="email" value={donorForm.email} onChange={e => setDonorForm(f => ({ ...f, email: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Phone"><input value={donorForm.phone} onChange={e => setDonorForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Donor Type">
                <select value={donorForm.donor_type} onChange={e => setDonorForm(f => ({ ...f, donor_type: e.target.value }))} className={sel}>
                  {DONOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormRow>
              <FormRow label="Giving Level">
                <select value={donorForm.giving_level} onChange={e => setDonorForm(f => ({ ...f, giving_level: e.target.value }))} className={sel}>
                  {GIVING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormRow>
            </div>
            <FormRow label="Employer"><input value={donorForm.employer} onChange={e => setDonorForm(f => ({ ...f, employer: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Communication Preference">
              <select value={donorForm.communication_preference} onChange={e => setDonorForm(f => ({ ...f, communication_preference: e.target.value }))} className={sel}>
                {['email','mail','phone','none'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormRow>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addDonor} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Donor'}</button>
            <button onClick={() => setShowDonorModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showDonationModal && (
        <Modal title="Record Donation" onClose={() => setShowDonationModal(false)}>
          <div className="space-y-2">
            <FormRow label="Donor ID *"><input type="number" value={donationForm.donor_id} onChange={e => setDonationForm(f => ({ ...f, donor_id: e.target.value }))} className={inp} placeholder="Donor ID number" /></FormRow>
            <FormRow label="Amount ($) *"><input type="number" step="0.01" value={donationForm.amount} onChange={e => setDonationForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Donation Date"><input type="date" value={donationForm.donation_date} onChange={e => setDonationForm(f => ({ ...f, donation_date: e.target.value }))} className={inp} /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Fund">
                <select value={donationForm.fund} onChange={e => setDonationForm(f => ({ ...f, fund: e.target.value }))} className={sel}>
                  {FUNDS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                </select>
              </FormRow>
              <FormRow label="Payment Method">
                <select value={donationForm.payment_method} onChange={e => setDonationForm(f => ({ ...f, payment_method: e.target.value }))} className={sel}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormRow>
            </div>
            <FormRow label="Campaign ID (optional)"><input type="number" value={donationForm.campaign_id} onChange={e => setDonationForm(f => ({ ...f, campaign_id: e.target.value }))} className={inp} /></FormRow>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addDonation} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Record Donation'}</button>
            <button onClick={() => setShowDonationModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showCampaignModal && (
        <Modal title="Create Campaign" onClose={() => setShowCampaignModal(false)}>
          <div className="space-y-2">
            <FormRow label="Campaign Name *"><input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Description"><textarea value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} className={`${inp} h-16`} /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Campaign Type">
                <select value={campaignForm.campaign_type} onChange={e => setCampaignForm(f => ({ ...f, campaign_type: e.target.value }))} className={sel}>
                  {CAMPAIGN_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </FormRow>
              <FormRow label="Status">
                <select value={campaignForm.status} onChange={e => setCampaignForm(f => ({ ...f, status: e.target.value }))} className={sel}>
                  {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormRow>
            </div>
            <FormRow label="Goal Amount ($)"><input type="number" value={campaignForm.goal_amount} onChange={e => setCampaignForm(f => ({ ...f, goal_amount: e.target.value }))} className={inp} /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Start Date"><input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(f => ({ ...f, start_date: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="End Date"><input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(f => ({ ...f, end_date: e.target.value }))} className={inp} /></FormRow>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addCampaign} disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Create Campaign'}</button>
            <button onClick={() => setShowCampaignModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showVolunteerModal && (
        <Modal title="Add Volunteer" onClose={() => setShowVolunteerModal(false)}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="First Name *"><input value={volunteerForm.first_name} onChange={e => setVolunteerForm(f => ({ ...f, first_name: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="Last Name *"><input value={volunteerForm.last_name} onChange={e => setVolunteerForm(f => ({ ...f, last_name: e.target.value }))} className={inp} /></FormRow>
            </div>
            <FormRow label="Email *"><input type="email" value={volunteerForm.email} onChange={e => setVolunteerForm(f => ({ ...f, email: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Phone"><input value={volunteerForm.phone} onChange={e => setVolunteerForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Skills (comma separated)"><input value={volunteerForm.skills} onChange={e => setVolunteerForm(f => ({ ...f, skills: e.target.value }))} className={inp} placeholder="fundraising, administration, events" /></FormRow>
            <div className="grid grid-cols-2 gap-2">
              <FormRow label="Police Check Date"><input type="date" value={volunteerForm.police_check_date} onChange={e => setVolunteerForm(f => ({ ...f, police_check_date: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="Police Check Expiry"><input type="date" value={volunteerForm.police_check_expiry} onChange={e => setVolunteerForm(f => ({ ...f, police_check_expiry: e.target.value }))} className={inp} /></FormRow>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addVolunteer} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Volunteer'}</button>
            <button onClick={() => setShowVolunteerModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showHoursModal && (
        <Modal title={`Log Hours — ${showHoursModal.first_name} ${showHoursModal.last_name}`} onClose={() => setShowHoursModal(null)}>
          <p className="text-sm text-gray-500 mb-4">Current total: {Number(showHoursModal.total_hours).toFixed(1)} hours</p>
          <FormRow label="Hours to Add"><input type="number" step="0.5" min="0" value={hoursToAdd} onChange={e => setHoursToAdd(e.target.value)} className={inp} /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={logHours} className="flex-1 py-2 bg-blue-600 text-white rounded text-sm font-medium">Log Hours</button>
            <button onClick={() => setShowHoursModal(null)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
