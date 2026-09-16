'use client';
import { useEffect, useState, useCallback } from 'react';

// ── Insurer data ──────────────────────────────────────────────────────────────
const INSURERS_BY_TYPE: Record<string, string[]> = {
  health: ['Manulife', 'Sun Life', 'Canada Life', 'AB Blue Cross', 'Green Shield Canada', 'Desjardins', 'iA Financial'],
  home: ['Intact', 'Aviva Canada', 'Wawanesa', 'Economical', 'Belair Direct', 'TD Insurance', 'Allstate Canada', 'SGI Canada', 'Pembridge'],
  vehicle: ['Intact', 'Aviva', 'Wawanesa', 'TD Insurance', 'Allstate', 'Belair Direct', 'SGI', 'CAA Insurance', 'Portage Mutual'],
  life: ['Sun Life', 'Manulife', 'Canada Life', 'iA Financial', 'Equitable Life', 'Empire Life', 'Foresters Financial', 'RBC Insurance'],
  travel: ['Manulife Travel', 'Blue Cross Travel', 'TuGo', 'Allianz Global', 'CAA Travel', 'Medipac', 'CHUBB Travel'],
  disability: ['Manulife', 'Sun Life', 'Canada Life', 'iA Financial', 'RBC Insurance', 'Equitable Life'],
  critical_illness: ['Sun Life', 'Manulife', 'Canada Life', 'RBC Insurance', 'Empire Life', 'iA Financial'],
  group: ['Manulife Group', 'Sun Life Group', 'Canada Life Group', 'Desjardins Group', 'iA Group', 'Green Shield'],
  business: ['Intact Commercial', 'Aviva Commercial', 'Northbridge', 'AIG Canada', 'Zurich Canada'],
  tenant: ['Intact', 'Aviva', 'Belair Direct', 'Square One Insurance', 'Sonnet Insurance'],
};

const POLICY_TYPES = Object.keys(INSURERS_BY_TYPE);

const POLICY_TYPE_LABELS: Record<string, string> = {
  health: 'Health', home: 'Home', vehicle: 'Vehicle', life: 'Life',
  travel: 'Travel', disability: 'Disability', critical_illness: 'Critical Illness',
  group: 'Group Benefits', business: 'Business', tenant: 'Tenant',
};

const POLICY_TYPE_ICONS: Record<string, string> = {
  health: '🏥', home: '🏠', vehicle: '🚗', life: '💚', travel: '✈️',
  disability: '♿', critical_illness: '❤️', group: '👥', business: '🏢', tenant: '🔑',
};

const CREDIT_TIER_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700',
  lapsed: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
  quoted: 'bg-sky-100 text-sky-700',
  applied: 'bg-blue-100 text-blue-700',
  renewed: 'bg-teal-100 text-teal-700',
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  filed: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-teal-100 text-teal-700',
  paid: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  closed: 'bg-gray-100 text-gray-500',
};

// ── Typical Alberta broker commission rates ───────────────────────────────────
const COMMISSION_BENCHMARKS: { type: string; rate: string }[] = [
  { type: 'Health', rate: '5–8%' }, { type: 'Life', rate: '40–120% (first yr)' },
  { type: 'Home', rate: '10–20%' }, { type: 'Vehicle', rate: '8–15%' },
  { type: 'Travel', rate: '25–40%' }, { type: 'Disability', rate: '30–60% (first yr)' },
  { type: 'Critical Illness', rate: '35–80% (first yr)' }, { type: 'Group Benefits', rate: '5–10%' },
  { type: 'Business', rate: '10–20%' }, { type: 'Tenant', rate: '15–25%' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Client { id: number; name: string; email: string | null; phone: string | null; city: string; province: string; status: string; source: string | null; credit_tier: string | null; annual_income: string | null; date_of_birth: string | null; occupation: string | null; smoker: boolean; broker_notes: string | null; created_at: string; policy_count: string; policies_by_type: Record<string, number> | null; }
interface Policy { id: number; client_id: number; client_name: string; client_phone: string; client_email: string; policy_type: string; insurer: string; policy_number: string | null; coverage_amount: string | null; annual_premium: string | null; monthly_premium: string | null; deductible: string | null; effective_date: string | null; expiry_date: string | null; status: string; broker_commission_pct: string | null; broker_commission_amt: string | null; renewal_reminder_sent: boolean; notes: string | null; days_to_expiry: string | null; created_at: string; }
interface Quote { id: number; client_id: number; client_name: string; client_phone: string; policy_type: string; insurer: string; quoted_premium: string | null; coverage_amount: string | null; deductible: string | null; status: string; valid_until: string | null; notes: string | null; created_at: string; }
interface Claim { id: number; policy_id: number; policy_type: string; insurer: string; policy_number: string | null; client_name: string; client_phone: string; claim_number: string | null; claim_type: string | null; incident_date: string | null; filed_date: string | null; claim_amount: string | null; approved_amount: string | null; status: string; notes: string | null; }

type Tab = 'dashboard' | 'clients' | 'policies' | 'quotes' | 'claims' | 'renewals' | 'ai' | 'commission';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: string | number | null | undefined) =>
  v == null || v === '' ? '—' : `$${Number(v).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-CA') : '—';

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    red: 'border-l-4 border-red-500 bg-red-50', teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400 text-xs">—</span>;
  if (days < 0) return <Badge label="Expired" cls="bg-gray-200 text-gray-600" />;
  if (days <= 30) return <Badge label={`${days}d`} cls="bg-red-100 text-red-700" />;
  if (days <= 60) return <Badge label={`${days}d`} cls="bg-amber-100 text-amber-700" />;
  return <Badge label={`${days}d`} cls="bg-green-100 text-green-700" />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

// ── Main Component ────────────────────────────────────────────────────────────
export default function InsuranceBrokerPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [renewals, setRenewals] = useState<{ expiring_30: Policy[]; expiring_60: Policy[]; expiring_90: Policy[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [clientFilters, setClientFilters] = useState({ status: '', source: '', province: '', search: '' });
  const [policyFilters, setPolicyFilters] = useState({ policy_type: '', insurer: '', status: '', expiring_soon: '' });
  const [quoteFilters, setQuoteFilters] = useState({ policy_type: '', insurer: '', status: '' });
  const [claimFilters, setClaimFilters] = useState({ policy_type: '', status: '' });

  // Modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDetail, setClientDetail] = useState<{ client: Client; policies: Policy[]; quotes: Quote[]; claims: Claim[] } | null>(null);

  // AI Advisor
  const [aiForm, setAiForm] = useState({ age: 35, income: 75000, smoker: false, has_dependents: false, owns_home: false, has_vehicle: true, occupation: 'professional', current_coverage: [] as string[] });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Renewal email generation
  const [renewalEmail, setRenewalEmail] = useState<{ policyId: number; text: string } | null>(null);
  const [renewalEmailLoading, setRenewalEmailLoading] = useState<number | null>(null);

  const api = (path: string) => `/api/admin/insurance-broker${path}`;

  const loadStats = useCallback(async () => {
    try { const r = await fetch(api('')); if (r.ok) setStats(await r.json()); } catch { /* ignore */ }
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(clientFilters).filter(([, v]) => v)));
      const r = await fetch(api(`/clients?${qs}`));
      if (r.ok) { const d = await r.json(); setClients(d.clients); }
    } catch { setError('Failed to load clients.'); } finally { setLoading(false); }
  }, [clientFilters]);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(policyFilters).filter(([, v]) => v)));
      const r = await fetch(api(`/policies?${qs}`));
      if (r.ok) { const d = await r.json(); setPolicies(d.policies); }
    } catch { setError('Failed to load policies.'); } finally { setLoading(false); }
  }, [policyFilters]);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(quoteFilters).filter(([, v]) => v)));
      const r = await fetch(api(`/quotes?${qs}`));
      if (r.ok) { const d = await r.json(); setQuotes(d.quotes); }
    } catch { setError('Failed to load quotes.'); } finally { setLoading(false); }
  }, [quoteFilters]);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(claimFilters).filter(([, v]) => v)));
      const r = await fetch(api(`/claims?${qs}`));
      if (r.ok) { const d = await r.json(); setClaims(d.claims); }
    } catch { setError('Failed to load claims.'); } finally { setLoading(false); }
  }, [claimFilters]);

  const loadRenewals = useCallback(async () => {
    try { const r = await fetch(api('/renewals')); if (r.ok) setRenewals(await r.json()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === 'clients') loadClients(); }, [tab, loadClients]);
  useEffect(() => { if (tab === 'policies') loadPolicies(); }, [tab, loadPolicies]);
  useEffect(() => { if (tab === 'quotes') loadQuotes(); }, [tab, loadQuotes]);
  useEffect(() => { if (tab === 'claims') loadClaims(); }, [tab, loadClaims]);
  useEffect(() => { if (tab === 'renewals') loadRenewals(); }, [tab, loadRenewals]);

  const loadClientDetail = async (c: Client) => {
    setSelectedClient(c);
    try {
      const r = await fetch(api(`/clients/${c.id}`));
      if (r.ok) setClientDetail(await r.json());
    } catch { /* ignore */ }
  };

  const markReminderSent = async (policyId: number) => {
    await fetch(api(`/policies/${policyId}`), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renewal_reminder_sent: true }),
    });
    loadRenewals();
  };

  const generateRenewalEmail = async (p: Policy) => {
    setRenewalEmailLoading(p.id);
    try {
      const prompt = `Draft a professional renewal reminder email for a Canadian insurance broker to send to their client.

Client: ${p.client_name}
Policy Type: ${POLICY_TYPE_LABELS[p.policy_type] ?? p.policy_type} Insurance
Insurer: ${p.insurer}
Current Annual Premium: ${fmt$(p.annual_premium)} CAD
Expiry Date: ${fmtDate(p.expiry_date)}
Days Until Expiry: ${p.days_to_expiry} days

Write a warm, professional renewal reminder email (3-4 paragraphs). Include: importance of renewing before expiry, offer to review coverage and potentially find better rates, and a clear call to action.`;

      const r = await fetch(api('/ai-recommend'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: 40, income: 80000, occupation: 'client', current_coverage: [p.policy_type], _prompt_override: prompt }),
      });
      if (r.ok) {
        const d = await r.json();
        // Simple renewal email template as fallback
        const emailText = d.recommendation?.includes('@') ? d.recommendation :
          `Subject: Your ${POLICY_TYPE_LABELS[p.policy_type]} Insurance Renewal — Action Required\n\nDear ${p.client_name},\n\nI hope you're doing well. I'm reaching out regarding your ${POLICY_TYPE_LABELS[p.policy_type]} insurance policy with ${p.insurer}, which is scheduled to expire on ${fmtDate(p.expiry_date)} — just ${p.days_to_expiry} days away.\n\nTo ensure you remain fully protected without any gap in coverage, I'd like to connect with you to review your current policy and discuss your renewal options. This is also a great opportunity to assess whether your coverage still meets your needs, or if we can find you a better rate from one of our Canadian carrier partners.\n\nYour current annual premium is ${fmt$(p.annual_premium)} CAD. I'll be comparing quotes from multiple insurers to ensure you're getting the best value.\n\nPlease reply to this email or call me at your earliest convenience. I'm committed to making the renewal process as seamless as possible for you.\n\nWarm regards,\n[Your Name]\nLicensed Insurance Broker`;
        setRenewalEmail({ policyId: p.id, text: emailText });
      }
    } catch { /* ignore */ } finally {
      setRenewalEmailLoading(null);
    }
  };

  const acceptQuote = async (quoteId: number) => {
    const r = await fetch(api(`/quotes/${quoteId}/accept`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (r.ok) { loadQuotes(); loadPolicies(); }
  };

  const exportRenewalsCSV = () => {
    if (!renewals) return;
    const all = [...renewals.expiring_30, ...renewals.expiring_60, ...renewals.expiring_90];
    const lines = ['Client,Phone,Email,Type,Insurer,Premium,Expiry,Days Left'];
    all.forEach(p => lines.push([
      p.client_name, p.client_phone || '', p.client_email || '',
      POLICY_TYPE_LABELS[p.policy_type] ?? p.policy_type, p.insurer,
      p.annual_premium || '', fmtDate(p.expiry_date), p.days_to_expiry ?? '',
    ].join(',')));
    navigator.clipboard.writeText(lines.join('\n'));
    alert('Renewal list copied to clipboard as CSV.');
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'clients', label: 'Clients' },
    { id: 'policies', label: 'Policies' }, { id: 'quotes', label: 'Quotes' },
    { id: 'claims', label: 'Claims' }, { id: 'renewals', label: 'Renewals' },
    { id: 'ai', label: 'AI Advisor' }, { id: 'commission', label: 'Commission' },
  ];

  // ── Add Client Form ─────────────────────────────────────────────────────────
  function AddClientModal() {
    const [f, setF] = useState({ name: '', email: '', phone: '', city: 'Calgary', province: 'AB', address: '', date_of_birth: '', gender: '', occupation: '', smoker: false, annual_income: '', credit_tier: '', status: 'prospect', source: '', broker_notes: '' });
    const [saving, setSaving] = useState(false);
    const upd = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

    const save = async () => {
      if (!f.name.trim()) return;
      setSaving(true);
      const r = await fetch(api('/clients'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      setSaving(false);
      if (r.ok) { setShowAddClient(false); loadClients(); loadStats(); }
    };

    return (
      <Modal title="Add New Client" onClose={() => setShowAddClient(false)}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name *"><input className={inputCls} value={f.name} onChange={e => upd('name', e.target.value)} placeholder="Jane Smith" /></FormField>
          <FormField label="Phone"><input className={inputCls} value={f.phone} onChange={e => upd('phone', e.target.value)} placeholder="403-555-0100" /></FormField>
          <FormField label="Email"><input className={inputCls} type="email" value={f.email} onChange={e => upd('email', e.target.value)} placeholder="jane@example.com" /></FormField>
          <FormField label="Date of Birth"><input className={inputCls} type="date" value={f.date_of_birth} onChange={e => upd('date_of_birth', e.target.value)} /></FormField>
          <FormField label="Occupation"><input className={inputCls} value={f.occupation} onChange={e => upd('occupation', e.target.value)} placeholder="Engineer" /></FormField>
          <FormField label="Annual Income (CAD)"><input className={inputCls} type="number" value={f.annual_income} onChange={e => upd('annual_income', e.target.value)} placeholder="75000" /></FormField>
          <FormField label="City"><input className={inputCls} value={f.city} onChange={e => upd('city', e.target.value)} /></FormField>
          <FormField label="Province">
            <select className={selectCls} value={f.province} onChange={e => upd('province', e.target.value)}>
              {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p => <option key={p}>{p}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={selectCls} value={f.status} onChange={e => upd('status', e.target.value)}>
              {['prospect','active','lapsed','cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Source">
            <select className={selectCls} value={f.source} onChange={e => upd('source', e.target.value)}>
              <option value="">— Select —</option>
              {['referral','website','kijiji','social','walk_in'].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Credit Tier">
            <select className={selectCls} value={f.credit_tier} onChange={e => upd('credit_tier', e.target.value)}>
              <option value="">— Select —</option>
              {['excellent','good','fair','poor'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </FormField>
          <FormField label="Gender">
            <select className={selectCls} value={f.gender} onChange={e => upd('gender', e.target.value)}>
              <option value="">— Select —</option>
              <option value="male">Male</option><option value="female">Female</option><option value="other">Other / Prefer not to say</option>
            </select>
          </FormField>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="smoker" checked={f.smoker} onChange={e => upd('smoker', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="smoker" className="text-sm text-gray-600">Smoker</label>
          </div>
          <div className="col-span-2">
            <FormField label="Broker Notes"><textarea className={inputCls} rows={3} value={f.broker_notes} onChange={e => upd('broker_notes', e.target.value)} placeholder="Internal notes..." /></FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setShowAddClient(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || !f.name.trim()} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Client'}
          </button>
        </div>
      </Modal>
    );
  }

  // ── Add Policy Form ─────────────────────────────────────────────────────────
  function AddPolicyModal({ prefillClientId }: { prefillClientId?: number }) {
    const [f, setF] = useState({ client_id: prefillClientId?.toString() ?? '', policy_type: 'health', insurer: '', policy_number: '', coverage_amount: '', annual_premium: '', monthly_premium: '', deductible: '', effective_date: '', expiry_date: '', status: 'quoted', broker_commission_pct: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const upd = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));
    const insurers = INSURERS_BY_TYPE[f.policy_type] ?? [];

    const save = async () => {
      setSaving(true);
      const r = await fetch(api('/policies'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, client_id: parseInt(f.client_id, 10) }),
      });
      setSaving(false);
      if (r.ok) { setShowAddPolicy(false); loadPolicies(); loadStats(); }
    };

    return (
      <Modal title="Add Policy" onClose={() => setShowAddPolicy(false)}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Client ID *"><input className={inputCls} type="number" value={f.client_id} onChange={e => upd('client_id', e.target.value)} placeholder="Client ID" /></FormField>
          <FormField label="Policy Type">
            <select className={selectCls} value={f.policy_type} onChange={e => { upd('policy_type', e.target.value); upd('insurer', ''); }}>
              {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}</option>)}
            </select>
          </FormField>
          <FormField label="Insurer *">
            <select className={selectCls} value={f.insurer} onChange={e => upd('insurer', e.target.value)}>
              <option value="">— Select Insurer —</option>
              {insurers.map(ins => <option key={ins} value={ins}>{ins}</option>)}
            </select>
          </FormField>
          <FormField label="Policy Number"><input className={inputCls} value={f.policy_number} onChange={e => upd('policy_number', e.target.value)} placeholder="POL-000001" /></FormField>
          <FormField label="Coverage Amount (CAD)"><input className={inputCls} type="number" value={f.coverage_amount} onChange={e => upd('coverage_amount', e.target.value)} /></FormField>
          <FormField label="Annual Premium (CAD)"><input className={inputCls} type="number" value={f.annual_premium} onChange={e => upd('annual_premium', e.target.value)} /></FormField>
          <FormField label="Monthly Premium (CAD)"><input className={inputCls} type="number" value={f.monthly_premium} onChange={e => upd('monthly_premium', e.target.value)} /></FormField>
          <FormField label="Deductible (CAD)"><input className={inputCls} type="number" value={f.deductible} onChange={e => upd('deductible', e.target.value)} /></FormField>
          <FormField label="Effective Date"><input className={inputCls} type="date" value={f.effective_date} onChange={e => upd('effective_date', e.target.value)} /></FormField>
          <FormField label="Expiry Date"><input className={inputCls} type="date" value={f.expiry_date} onChange={e => upd('expiry_date', e.target.value)} /></FormField>
          <FormField label="Status">
            <select className={selectCls} value={f.status} onChange={e => upd('status', e.target.value)}>
              {['quoted','applied','active','lapsed','cancelled','renewed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Commission %"><input className={inputCls} type="number" value={f.broker_commission_pct} onChange={e => upd('broker_commission_pct', e.target.value)} placeholder="15" /></FormField>
          <div className="col-span-2"><FormField label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={e => upd('notes', e.target.value)} /></FormField></div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setShowAddPolicy(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || !f.client_id || !f.insurer} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Policy'}
          </button>
        </div>
      </Modal>
    );
  }

  // ── Add Quote Form ──────────────────────────────────────────────────────────
  function AddQuoteModal() {
    const [f, setF] = useState({ client_id: '', policy_type: 'health', insurer: '', quoted_premium: '', coverage_amount: '', deductible: '', status: 'pending', valid_until: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const upd = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

    const save = async () => {
      setSaving(true);
      const r = await fetch(api('/quotes'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, client_id: parseInt(f.client_id, 10) }),
      });
      setSaving(false);
      if (r.ok) { setShowAddQuote(false); loadQuotes(); }
    };

    return (
      <Modal title="Create Quote" onClose={() => setShowAddQuote(false)}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Client ID *"><input className={inputCls} type="number" value={f.client_id} onChange={e => upd('client_id', e.target.value)} /></FormField>
          <FormField label="Policy Type">
            <select className={selectCls} value={f.policy_type} onChange={e => { upd('policy_type', e.target.value); upd('insurer', ''); }}>
              {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}</option>)}
            </select>
          </FormField>
          <FormField label="Insurer *">
            <select className={selectCls} value={f.insurer} onChange={e => upd('insurer', e.target.value)}>
              <option value="">— Select —</option>
              {(INSURERS_BY_TYPE[f.policy_type] ?? []).map(ins => <option key={ins}>{ins}</option>)}
            </select>
          </FormField>
          <FormField label="Quoted Premium (CAD)"><input className={inputCls} type="number" value={f.quoted_premium} onChange={e => upd('quoted_premium', e.target.value)} /></FormField>
          <FormField label="Coverage Amount (CAD)"><input className={inputCls} type="number" value={f.coverage_amount} onChange={e => upd('coverage_amount', e.target.value)} /></FormField>
          <FormField label="Deductible (CAD)"><input className={inputCls} type="number" value={f.deductible} onChange={e => upd('deductible', e.target.value)} /></FormField>
          <FormField label="Status">
            <select className={selectCls} value={f.status} onChange={e => upd('status', e.target.value)}>
              {['pending','sent','accepted','declined','expired'].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Valid Until"><input className={inputCls} type="date" value={f.valid_until} onChange={e => upd('valid_until', e.target.value)} /></FormField>
          <div className="col-span-2"><FormField label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={e => upd('notes', e.target.value)} /></FormField></div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setShowAddQuote(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || !f.client_id || !f.insurer} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Quote'}
          </button>
        </div>
      </Modal>
    );
  }

  // ── Add Claim Form ──────────────────────────────────────────────────────────
  function AddClaimModal() {
    const [f, setF] = useState({ policy_id: '', claim_number: '', claim_type: '', incident_date: '', filed_date: '', claim_amount: '', status: 'filed', notes: '' });
    const [saving, setSaving] = useState(false);
    const upd = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

    const save = async () => {
      setSaving(true);
      const r = await fetch(api('/claims'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, policy_id: parseInt(f.policy_id, 10) }),
      });
      setSaving(false);
      if (r.ok) { setShowAddClaim(false); loadClaims(); }
    };

    return (
      <Modal title="File Claim" onClose={() => setShowAddClaim(false)}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Policy ID *"><input className={inputCls} type="number" value={f.policy_id} onChange={e => upd('policy_id', e.target.value)} /></FormField>
          <FormField label="Claim Number"><input className={inputCls} value={f.claim_number} onChange={e => upd('claim_number', e.target.value)} placeholder="CLM-000001" /></FormField>
          <FormField label="Claim Type"><input className={inputCls} value={f.claim_type} onChange={e => upd('claim_type', e.target.value)} placeholder="Water damage, Collision, etc." /></FormField>
          <FormField label="Incident Date"><input className={inputCls} type="date" value={f.incident_date} onChange={e => upd('incident_date', e.target.value)} /></FormField>
          <FormField label="Claim Amount (CAD)"><input className={inputCls} type="number" value={f.claim_amount} onChange={e => upd('claim_amount', e.target.value)} /></FormField>
          <FormField label="Status">
            <select className={selectCls} value={f.status} onChange={e => upd('status', e.target.value)}>
              {['filed','under_review','approved','paid','denied','closed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <div className="col-span-2"><FormField label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={e => upd('notes', e.target.value)} /></FormField></div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setShowAddClaim(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || !f.policy_id} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'File Claim'}
          </button>
        </div>
      </Modal>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const byType: { policy_type: string; count: string; premium_volume: string }[] = (stats as Record<string, unknown[]> | null)?.by_type as { policy_type: string; count: string; premium_volume: string }[] ?? [];
  const maxVol = Math.max(...byType.map(r => Number(r.premium_volume)), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🏦 Insurance Broker Hub</h1>
            <p className="text-slate-300 text-sm mt-0.5">Canadian Insurance CRM — 10 Verticals</p>
          </div>
          <div className="flex gap-2 text-xs text-slate-400">
            <span>Health · Home · Vehicle · Life · Travel</span>
            <span>·</span>
            <span>Disability · CI · Group · Business · Tenant</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}

        {/* ─── TAB: DASHBOARD ─────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Monthly Commission" value={fmt$(((stats as Record<string,unknown>)?.commission as {monthly?:number})?.monthly)} color="green" sub="From active policies" />
              <KpiCard label="Annual Commission" value={fmt$(((stats as Record<string,unknown>)?.commission as {annual?:number})?.annual)} color="teal" />
              <KpiCard label="Active Policies" value={(stats as Record<string,unknown>)?.policies ? String(((stats as Record<string,unknown>)?.policies as Record<string,number>)?.active ?? 0) : '—'} color="blue" />
              <KpiCard label="Pending Quotes" value={(stats as Record<string,unknown>)?.quotes ? String(((stats as Record<string,unknown>)?.quotes as Record<string,number>)?.pending ?? 0) : '—'} color="purple" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Clients" value={((stats as Record<string,unknown>)?.clients as Record<string,number>)?.total ?? '—'} />
              <KpiCard label="Active Clients" value={((stats as Record<string,unknown>)?.clients as Record<string,number>)?.active ?? '—'} color="green" />
              <KpiCard label="Expiring ≤30d" value={((stats as Record<string,unknown>)?.policies as Record<string,number>)?.expiring_30d ?? '—'} color="red" sub="Urgent renewals" />
              <KpiCard label="Expiring ≤60d" value={((stats as Record<string,unknown>)?.policies as Record<string,number>)?.expiring_60d ?? '—'} color="amber" />
            </div>

            {/* Policy type volume bars */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Premium Volume by Insurance Type</h2>
              {byType.length === 0 ? <p className="text-gray-400 text-sm">No policy data yet.</p> : (
                <div className="space-y-3">
                  {byType.map(r => (
                    <div key={r.policy_type} className="flex items-center gap-3">
                      <span className="w-6 text-center">{POLICY_TYPE_ICONS[r.policy_type] ?? '📋'}</span>
                      <span className="w-32 text-sm text-gray-600 truncate">{POLICY_TYPE_LABELS[r.policy_type] ?? r.policy_type}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(Number(r.premium_volume) / maxVol) * 100}%` }} />
                      </div>
                      <span className="w-24 text-right text-xs text-gray-500">{fmt$(r.premium_volume)}</span>
                      <span className="w-12 text-right text-xs text-gray-400">{r.count} pol</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: CLIENTS ───────────────────────────────────────────────── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <input className={`${inputCls} w-52`} placeholder="Search name / email / phone…" value={clientFilters.search} onChange={e => setClientFilters(p => ({ ...p, search: e.target.value }))} onKeyDown={e => e.key === 'Enter' && loadClients()} />
              <select className={`${selectCls} w-36`} value={clientFilters.status} onChange={e => setClientFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {['prospect','active','lapsed','cancelled'].map(s => <option key={s}>{s}</option>)}
              </select>
              <select className={`${selectCls} w-36`} value={clientFilters.province} onChange={e => setClientFilters(p => ({ ...p, province: e.target.value }))}>
                <option value="">All Provinces</option>
                {['AB','BC','ON','QC','SK','MB','NS','NB','NL','PE'].map(p => <option key={p}>{p}</option>)}
              </select>
              <select className={`${selectCls} w-36`} value={clientFilters.source} onChange={e => setClientFilters(p => ({ ...p, source: e.target.value }))}>
                <option value="">All Sources</option>
                {['referral','website','kijiji','social','walk_in'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={loadClients} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Filter</button>
              <button onClick={() => setShowAddClient(true)} className="ml-auto px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">+ Add Client</button>
            </div>

            {loading ? <div className="text-center py-8 text-gray-400">Loading clients…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Policies</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Credit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Added</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clients.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{c.name}</div>
                          {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.city}, {c.province}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.policies_by_type
                              ? Object.entries(c.policies_by_type).map(([t]) => (
                                <span key={t} title={POLICY_TYPE_LABELS[t] ?? t} className="text-base">{POLICY_TYPE_ICONS[t] ?? '📋'}</span>
                              ))
                              : <span className="text-gray-400 text-xs">{c.policy_count} pol</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.credit_tier ? <Badge label={c.credit_tier} cls={CREDIT_TIER_COLORS[c.credit_tier] ?? 'bg-gray-100 text-gray-600'} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3"><Badge label={c.status} cls={STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(c.created_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => loadClientDetail(c)} className="text-blue-600 text-xs hover:underline">View</button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No clients found. Add your first client!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: POLICIES ──────────────────────────────────────────────── */}
        {tab === 'policies' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <select className={`${selectCls} w-40`} value={policyFilters.policy_type} onChange={e => setPolicyFilters(p => ({ ...p, policy_type: e.target.value }))}>
                <option value="">All Types</option>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}</option>)}
              </select>
              <select className={`${selectCls} w-36`} value={policyFilters.status} onChange={e => setPolicyFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {['quoted','applied','active','lapsed','cancelled','renewed'].map(s => <option key={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={policyFilters.expiring_soon === '1'} onChange={e => setPolicyFilters(p => ({ ...p, expiring_soon: e.target.checked ? '1' : '' }))} />
                Expiring ≤90d
              </label>
              <button onClick={loadPolicies} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Filter</button>
              <button onClick={() => setShowAddPolicy(true)} className="ml-auto px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">+ Add Policy</button>
            </div>

            {loading ? <div className="text-center py-8 text-gray-400">Loading policies…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Insurer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Annual Prem.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expiry</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {policies.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{p.client_name}</div>
                          <div className="text-xs text-gray-400">{p.policy_number || `#${p.id}`}</div>
                        </td>
                        <td className="px-4 py-3"><span className="text-xl">{POLICY_TYPE_ICONS[p.policy_type] ?? '📋'}</span></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{p.insurer}</td>
                        <td className="px-4 py-3 text-gray-600">{fmt$(p.coverage_amount)}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{fmt$(p.annual_premium)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.broker_commission_pct ? `${p.broker_commission_pct}%` : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500">{fmtDate(p.expiry_date)}</div>
                          <ExpiryBadge days={p.days_to_expiry != null ? Number(p.days_to_expiry) : null} />
                        </td>
                        <td className="px-4 py-3"><Badge label={p.status} cls={STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3">
                          <button onClick={async () => {
                            await fetch(api(`/policies/${p.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'renew' }) });
                            loadPolicies();
                          }} className="text-xs text-blue-600 hover:underline">Renew</button>
                        </td>
                      </tr>
                    ))}
                    {policies.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No policies found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: QUOTES ────────────────────────────────────────────────── */}
        {tab === 'quotes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <select className={`${selectCls} w-40`} value={quoteFilters.policy_type} onChange={e => setQuoteFilters(p => ({ ...p, policy_type: e.target.value }))}>
                <option value="">All Types</option>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}</option>)}
              </select>
              <select className={`${selectCls} w-36`} value={quoteFilters.status} onChange={e => setQuoteFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {['pending','sent','accepted','declined','expired'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={loadQuotes} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Filter</button>
              <button onClick={() => setShowAddQuote(true)} className="ml-auto px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">+ Create Quote</button>
            </div>

            {loading ? <div className="text-center py-8 text-gray-400">Loading quotes…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Insurer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Premium</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valid Until</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {quotes.map(q => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{q.client_name}</div>
                          <div className="text-xs text-gray-400">ID {q.client_id}</div>
                        </td>
                        <td className="px-4 py-3 text-xl">{POLICY_TYPE_ICONS[q.policy_type] ?? '📋'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{q.insurer}</td>
                        <td className="px-4 py-3 font-medium">{fmt$(q.quoted_premium)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmt$(q.coverage_amount)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(q.valid_until)}</td>
                        <td className="px-4 py-3"><Badge label={q.status} cls={STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3">
                          {q.status === 'pending' || q.status === 'sent' ? (
                            <button onClick={() => acceptQuote(q.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Accept → Policy</button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No quotes found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: CLAIMS ────────────────────────────────────────────────── */}
        {tab === 'claims' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <select className={`${selectCls} w-40`} value={claimFilters.policy_type} onChange={e => setClaimFilters(p => ({ ...p, policy_type: e.target.value }))}>
                <option value="">All Types</option>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}</option>)}
              </select>
              <select className={`${selectCls} w-40`} value={claimFilters.status} onChange={e => setClaimFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {['filed','under_review','approved','paid','denied','closed'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={loadClaims} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Filter</button>
              <button onClick={() => setShowAddClaim(true)} className="ml-auto px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">+ File Claim</button>
            </div>

            {loading ? <div className="text-center py-8 text-gray-400">Loading claims…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Insurer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Claim#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Incident</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Filed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Claimed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Approved</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {claims.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.client_name}</td>
                        <td className="px-4 py-3 text-xl">{POLICY_TYPE_ICONS[c.policy_type] ?? '📋'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{c.insurer}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{c.claim_number || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.incident_date)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.filed_date)}</td>
                        <td className="px-4 py-3 font-medium">{fmt$(c.claim_amount)}</td>
                        <td className="px-4 py-3 text-green-700 font-medium">{fmt$(c.approved_amount)}</td>
                        <td className="px-4 py-3"><Badge label={c.status.replace('_', ' ')} cls={STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                      </tr>
                    ))}
                    {claims.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No claims found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: RENEWALS ──────────────────────────────────────────────── */}
        {tab === 'renewals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Policies Expiring in 90 Days</h2>
              <div className="flex gap-2">
                <button onClick={loadRenewals} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Refresh</button>
                <button onClick={exportRenewalsCSV} className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800">Export CSV</button>
              </div>
            </div>

            {renewalEmail && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-amber-800 text-sm">Renewal Email Draft</span>
                  <button onClick={() => setRenewalEmail(null)} className="text-amber-500 hover:text-amber-700 text-lg">&times;</button>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded p-3 border border-amber-100">{renewalEmail.text}</pre>
                <button onClick={() => { navigator.clipboard.writeText(renewalEmail.text); }} className="mt-2 text-xs text-amber-700 hover:underline">Copy to clipboard</button>
              </div>
            )}

            {renewals ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { key: 'expiring_30' as const, label: '0–30 Days', cls: 'border-t-4 border-red-500', hdr: 'bg-red-50 text-red-700' },
                  { key: 'expiring_60' as const, label: '31–60 Days', cls: 'border-t-4 border-amber-500', hdr: 'bg-amber-50 text-amber-700' },
                  { key: 'expiring_90' as const, label: '61–90 Days', cls: 'border-t-4 border-green-500', hdr: 'bg-green-50 text-green-700' },
                ] as const).map(bucket => (
                  <div key={bucket.key} className={`bg-white rounded-xl border ${bucket.cls}`}>
                    <div className={`px-4 py-2 rounded-t-lg ${bucket.hdr}`}>
                      <span className="text-sm font-semibold">{bucket.label}</span>
                      <span className="text-xs ml-2 opacity-75">({renewals[bucket.key].length})</span>
                    </div>
                    <div className="divide-y max-h-[600px] overflow-y-auto">
                      {renewals[bucket.key].length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">None</div>}
                      {renewals[bucket.key].map(p => (
                        <div key={p.id} className="px-4 py-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm text-gray-800">{p.client_name}</div>
                              <div className="text-xs text-gray-500">{p.client_phone}</div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span>{POLICY_TYPE_ICONS[p.policy_type]}</span>
                                <span className="text-xs text-gray-600">{p.insurer}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">Prem: {fmt$(p.annual_premium)}/yr · Exp: {fmtDate(p.expiry_date)}</div>
                            </div>
                            <ExpiryBadge days={p.days_to_expiry != null ? Number(p.days_to_expiry) : null} />
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => markReminderSent(p.id)}
                              className={`text-xs px-2 py-1 rounded ${p.renewal_reminder_sent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              {p.renewal_reminder_sent ? '✓ Reminder Sent' : 'Mark Sent'}
                            </button>
                            <button
                              onClick={() => generateRenewalEmail(p)}
                              disabled={renewalEmailLoading === p.id}
                              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            >
                              {renewalEmailLoading === p.id ? 'Drafting…' : 'Draft Email'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-8 text-gray-400">Loading renewals…</div>}
          </div>
        )}

        {/* ─── TAB: AI ADVISOR ────────────────────────────────────────────── */}
        {tab === 'ai' && (
          <div className="max-w-3xl space-y-5">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Client Need Analysis</h2>
              <p className="text-sm text-gray-500 mb-4">Enter client details to identify coverage gaps and get personalized recommendations for the Canadian market.</p>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Age">
                  <input className={inputCls} type="number" min={18} max={90} value={aiForm.age} onChange={e => setAiForm(f => ({ ...f, age: parseInt(e.target.value, 10) || 35 }))} />
                </FormField>
                <FormField label="Annual Income (CAD)">
                  <input className={inputCls} type="number" value={aiForm.income} onChange={e => setAiForm(f => ({ ...f, income: parseInt(e.target.value, 10) || 0 }))} />
                </FormField>
                <FormField label="Occupation">
                  <input className={inputCls} value={aiForm.occupation} onChange={e => setAiForm(f => ({ ...f, occupation: e.target.value }))} placeholder="Software engineer, teacher, contractor…" />
                </FormField>
                <div className="flex flex-col gap-2 justify-center">
                  {[
                    { key: 'smoker', label: 'Smoker' },
                    { key: 'has_dependents', label: 'Has Dependents' },
                    { key: 'owns_home', label: 'Owns Home' },
                    { key: 'has_vehicle', label: 'Has Vehicle' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={aiForm[f.key as keyof typeof aiForm] as boolean}
                        onChange={e => setAiForm(p => ({ ...p, [f.key]: e.target.checked }))} className="w-4 h-4" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">Current Coverage (check all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {POLICY_TYPES.map(t => (
                    <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${aiForm.current_coverage.includes(t) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="checkbox" className="sr-only" checked={aiForm.current_coverage.includes(t)}
                        onChange={e => setAiForm(p => ({ ...p, current_coverage: e.target.checked ? [...p.current_coverage, t] : p.current_coverage.filter(c => c !== t) }))} />
                      {POLICY_TYPE_ICONS[t]} {POLICY_TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={async () => {
                setAiLoading(true); setAiResult('');
                try {
                  const r = await fetch(api('/ai-recommend'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm),
                  });
                  if (r.ok) { const d = await r.json(); setAiResult(d.recommendation); }
                } catch { setAiResult('AI service unavailable. Please try again.'); } finally { setAiLoading(false); }
              }} disabled={aiLoading} className="mt-5 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {aiLoading ? 'Analyzing…' : '🔍 Analyze Coverage Gaps'}
              </button>
            </div>

            {aiResult && (
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">AI Coverage Recommendations</h3>
                  <button onClick={() => setShowAddQuote(true)} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">Create Quote from Recommendation</button>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResult}</pre>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: COMMISSION ────────────────────────────────────────────── */}
        {tab === 'commission' && (() => {
          const commData = (stats as Record<string,unknown>)?.commission as { monthly?: number; annual?: number; by_type?: { policy_type: string; commission: number }[] } | undefined;
          const byTypeComm = commData?.by_type ?? [];
          const maxComm = Math.max(...byTypeComm.map(r => r.commission), 1);

          const activePolCount = policies.filter(p => p.status === 'active').length;
          const pendingComm = quotes.filter(q => q.status === 'pending' || q.status === 'sent')
            .reduce((sum, q) => sum + (Number(q.quoted_premium) * 0.12), 0);

          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Monthly Commission" value={fmt$(commData?.monthly)} color="green" sub="Active policies / 12" />
                <KpiCard label="Annual Commission" value={fmt$(commData?.annual)} color="teal" />
                <KpiCard label="Pending (est.)" value={fmt$(pendingComm)} color="amber" sub="Quotes pending acceptance" />
                <KpiCard label="Active Policies" value={activePolCount} color="blue" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* By type bars */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Commission by Insurance Type</h3>
                  {byTypeComm.length === 0 ? <p className="text-gray-400 text-sm">No active policies yet.</p> : (
                    <div className="space-y-3">
                      {byTypeComm.sort((a, b) => b.commission - a.commission).map(r => (
                        <div key={r.policy_type} className="flex items-center gap-3">
                          <span className="text-base w-6 text-center">{POLICY_TYPE_ICONS[r.policy_type] ?? '📋'}</span>
                          <span className="w-28 text-xs text-gray-600 truncate">{POLICY_TYPE_LABELS[r.policy_type] ?? r.policy_type}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(r.commission / maxComm) * 100}%` }} />
                          </div>
                          <span className="w-20 text-right text-xs font-medium text-gray-700">{fmt$(r.commission)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Benchmarks */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Alberta Broker Commission Benchmarks</h3>
                  <div className="space-y-2">
                    {COMMISSION_BENCHMARKS.map(b => (
                      <div key={b.type} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-600">{b.type}</span>
                        <span className="text-sm font-medium text-gray-800">{b.rate}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Rates are typical Alberta market ranges. Actual rates vary by carrier and volume agreements.</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAddClient && <AddClientModal />}
      {showAddPolicy && <AddPolicyModal prefillClientId={selectedClient?.id} />}
      {showAddQuote && <AddQuoteModal />}
      {showAddClaim && <AddClaimModal />}

      {/* Client Detail Panel */}
      {selectedClient && clientDetail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => { setSelectedClient(null); setClientDetail(null); }} />
          <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{clientDetail.client.name}</div>
                <div className="text-slate-300 text-sm">{clientDetail.client.city}, {clientDetail.client.province} · {clientDetail.client.phone || 'No phone'}</div>
              </div>
              <button onClick={() => { setSelectedClient(null); setClientDetail(null); }} className="text-white text-2xl">&times;</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Client info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{clientDetail.client.email || '—'}</span></div>
                <div><span className="text-gray-500">DOB:</span> <span className="font-medium">{fmtDate(clientDetail.client.date_of_birth)}</span></div>
                <div><span className="text-gray-500">Occupation:</span> <span className="font-medium">{clientDetail.client.occupation || '—'}</span></div>
                <div><span className="text-gray-500">Income:</span> <span className="font-medium">{fmt$(clientDetail.client.annual_income)}/yr</span></div>
                <div><span className="text-gray-500">Smoker:</span> <span className="font-medium">{clientDetail.client.smoker ? 'Yes' : 'No'}</span></div>
                <div><span className="text-gray-500">Credit:</span> {clientDetail.client.credit_tier ? <Badge label={clientDetail.client.credit_tier} cls={CREDIT_TIER_COLORS[clientDetail.client.credit_tier] ?? ''} /> : '—'}</div>
                <div><span className="text-gray-500">Source:</span> <span className="font-medium">{clientDetail.client.source || '—'}</span></div>
                <div><span className="text-gray-500">Status:</span> <Badge label={clientDetail.client.status} cls={STATUS_COLORS[clientDetail.client.status] ?? ''} /></div>
              </div>
              {clientDetail.client.broker_notes && (
                <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                  <span className="font-medium">Notes:</span> {clientDetail.client.broker_notes}
                </div>
              )}

              {/* Policies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-700">Policies ({clientDetail.policies.length})</h4>
                  <button onClick={() => setShowAddPolicy(true)} className="text-xs text-blue-600 hover:underline">+ Add Policy</button>
                </div>
                {clientDetail.policies.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{POLICY_TYPE_ICONS[p.policy_type]}</span>
                      <span className="font-medium">{p.insurer}</span>
                      <Badge label={p.status} cls={STATUS_COLORS[p.status] ?? ''} />
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{fmt$(p.annual_premium)}/yr</div>
                      <div className="text-xs text-gray-400">Exp: {fmtDate(p.expiry_date)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quotes */}
              {clientDetail.quotes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Quotes ({clientDetail.quotes.length})</h4>
                  {clientDetail.quotes.map(q => (
                    <div key={q.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{POLICY_TYPE_ICONS[q.policy_type]}</span>
                        <span>{q.insurer}</span>
                        <Badge label={q.status} cls={STATUS_COLORS[q.status] ?? ''} />
                      </div>
                      <span className="font-medium">{fmt$(q.quoted_premium)}/yr</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Claims */}
              {clientDetail.claims.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Claims ({clientDetail.claims.length})</h4>
                  {clientDetail.claims.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{POLICY_TYPE_ICONS[c.policy_type]}</span>
                        <span>{c.claim_number || 'Claim'}</span>
                        <Badge label={c.status.replace('_', ' ')} cls={STATUS_COLORS[c.status] ?? ''} />
                      </div>
                      <div className="text-right">
                        <div>{fmt$(c.claim_amount)}</div>
                        {c.approved_amount && <div className="text-xs text-green-600">Approved: {fmt$(c.approved_amount)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
