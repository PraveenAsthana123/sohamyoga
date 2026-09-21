'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','appointments','soap','plans','outcomes','billing'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', patients: 'Patients', appointments: 'Appointments', soap: 'SOAP Notes', plans: 'Treatment Plans', outcomes: 'Outcome Measures', billing: 'Billing' };

const REFERRAL_SOURCES = ['physician','self','wca','mvac','insurance','employer','other'];
const TREATMENT_TYPES = ['initial_assessment','follow_up','manual_therapy','exercise_therapy','acupuncture','ultrasound','TENS','IFC','taping','work_conditioning','discharge_assessment','home_program_review'];
const MEASURE_TYPES = ['DASH','NDI','LEFS','Oswestry','PSFS','NPRS','VAS','ROM','grip_strength','6MWT','other'];

interface Patient { id: number; first_name: string; last_name: string; phone: string; email: string; primary_diagnosis: string; referral_source: string; status: string; wca_claim_number: string; mvac_claim_number: string; date_of_injury: string; treatment_goals: string; }
interface Appointment { id: number; patient_id: number; first_name: string; last_name: string; physio: string; appointment_date: string; start_time: string; end_time: string; treatment_type: string; status: string; primary_diagnosis: string; wca_claim_number: string; fee: number; subjective: string; objective: string; assessment: string; plan: string; patient_paid?: number; }
interface TreatmentPlan { id: number; patient_id: number; first_name: string; last_name: string; physio: string; diagnosis: string; treatment_goals: string; proposed_visits: number; visits_completed: number; frequency: string; duration_weeks: number; status: string; wca_pre_authorized: boolean; wca_auth_visits: number; }
interface OutcomeMeasure { id: number; patient_id: number; first_name: string; last_name: string; assessment_date: string; measure_type: string; score: number; max_score: number; interpretation: string; }
interface Dashboard { patients_active: number; appointments_today: number; wca_patients: number; discharge_due_this_week: number; revenue_mtd: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${c[color] ?? c.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

const referralColor = (s: string) => ({ physician: 'blue', wca: 'amber', mvac: 'orange', self: 'green', insurance: 'purple', employer: 'teal', other: 'gray' })[s] ?? 'gray';
const statusColor = (s: string) => ({ active: 'green', discharged: 'gray', on_hold: 'amber', waitlist: 'blue' })[s] ?? 'gray';
const apptStatusColor = (s: string) => ({ scheduled: 'blue', confirmed: 'green', in_progress: 'amber', completed: 'teal', cancelled: 'red', no_show: 'gray' })[s] ?? 'gray';

// ─── Add Patient Modal ─────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', date_of_birth: '', health_card_number: '', city: 'Calgary', province: 'AB', referral_source: 'physician', referring_physician: '', injury_type: '', primary_diagnosis: '', date_of_injury: '', wca_claim_number: '', mvac_claim_number: '', group_benefits_provider: '', group_benefits_id: '', treatment_goals: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/physiotherapy/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Physiotherapy Patient</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Health Card #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.health_card_number} onChange={e => f('health_card_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e => f('referral_source', e.target.value)}>{REFERRAL_SOURCES.map(s => <option key={s}>{s.replace('_',' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Referring Physician</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referring_physician} onChange={e => f('referring_physician', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Injury Type</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.injury_type} onChange={e => f('injury_type', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_diagnosis} onChange={e => f('primary_diagnosis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Injury</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_injury} onChange={e => f('date_of_injury', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">WCA Claim #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.wca_claim_number} onChange={e => f('wca_claim_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">MVAC Claim #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.mvac_claim_number} onChange={e => f('mvac_claim_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Group Benefits Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.group_benefits_provider} onChange={e => f('group_benefits_provider', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Treatment Goals</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.treatment_goals} onChange={e => f('treatment_goals', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Appointment Modal ─────────────────────────────────────────────────────
function NewApptModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ patient_id: '', physio: '', appointment_date: today, start_time: '09:00', end_time: '10:00', treatment_type: 'follow_up', wca_visit: false, mvac_visit: false, fee: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.physio) return;
    setSaving(true);
    try {
      await fetch('/api/admin/physiotherapy/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), fee: form.fee ? parseFloat(form.fee) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Appointment</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => f('patient_id', e.target.value)}><option value="">Select patient…</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Physio *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.physio} onChange={e => f('physio', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_date} onChange={e => f('appointment_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Start Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_time} onChange={e => f('start_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_time} onChange={e => f('end_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Treatment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.treatment_type} onChange={e => f('treatment_type', e.target.value)}>{TREATMENT_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e => f('fee', e.target.value)} /></div>
          <div className="flex items-center gap-3 mt-1">
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.wca_visit} onChange={e => f('wca_visit', e.target.checked)} />WCA</label>
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.mvac_visit} onChange={e => f('mvac_visit', e.target.checked)} />MVAC</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Book Appointment'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SOAP Note Completion Modal ────────────────────────────────────────────────
function SoapModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ subjective: appt.subjective ?? '', objective: appt.objective ?? '', assessment: appt.assessment ?? '', plan: appt.plan ?? '', fee: String(appt.fee ?? ''), insurance_claimed: '', patient_paid: '', payment_method: 'direct' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/physiotherapy/appointments/${appt.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, fee: form.fee ? parseFloat(form.fee) : undefined, insurance_claimed: form.insurance_claimed ? parseFloat(form.insurance_claimed) : undefined, patient_paid: form.patient_paid ? parseFloat(form.patient_paid) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete SOAP Note</h2>
        <p className="text-xs text-gray-500 mb-4">{appt.first_name} {appt.last_name} — {appt.treatment_type?.replace(/_/g, ' ')} — {fmtDate(appt.appointment_date)}</p>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold text-gray-600">S — Subjective</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.subjective} onChange={e => f('subjective', e.target.value)} placeholder="Patient-reported symptoms, pain level, functional limitations…" /></div>
          <div><label className="text-xs font-semibold text-gray-600">O — Objective</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.objective} onChange={e => f('objective', e.target.value)} placeholder="ROM, strength, palpation, functional testing, treatment performed…" /></div>
          <div><label className="text-xs font-semibold text-gray-600">A — Assessment</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.assessment} onChange={e => f('assessment', e.target.value)} placeholder="Progress toward goals, clinical impression…" /></div>
          <div><label className="text-xs font-semibold text-gray-600">P — Plan</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.plan} onChange={e => f('plan', e.target.value)} placeholder="Next session, home program, frequency…" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e => f('fee', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Insurance Claimed ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_claimed} onChange={e => f('insurance_claimed', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_paid} onChange={e => f('patient_paid', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Complete & Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Outcome Measure Modal ─────────────────────────────────────────────────
function AddOutcomeModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ patient_id: '', assessment_date: today, physio: '', measure_type: 'NPRS', score: '', max_score: '', interpretation: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.measure_type) return;
    setSaving(true);
    try {
      await fetch('/api/admin/physiotherapy/outcome-measures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), score: form.score ? parseFloat(form.score) : undefined, max_score: form.max_score ? parseFloat(form.max_score) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Record Outcome Measure</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => f('patient_id', e.target.value)}><option value="">Select patient…</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Assessment Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assessment_date} onChange={e => f('assessment_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Physio</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.physio} onChange={e => f('physio', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Measure Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.measure_type} onChange={e => f('measure_type', e.target.value)}>{MEASURE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Score</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.score} onChange={e => f('score', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Max Score</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.max_score} onChange={e => f('max_score', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Interpretation</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.interpretation} onChange={e => f('interpretation', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Measure'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PhysiotherapyPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeMeasure[]>([]);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showAddOutcome, setShowAddOutcome] = useState(false);
  const [soapAppt, setSoapAppt] = useState<Appointment | null>(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [outcomePatientId, setOutcomePatientId] = useState('');
  // AI SOAP
  const [soapForm, setSoapForm] = useState({ treatment_type: 'follow_up', primary_diagnosis: '', subjective: '', objective_findings: '', techniques: '', goals: '' });
  const [soapResult, setSoapResult] = useState('');
  const [soapLoading, setSoapLoading] = useState(false);
  // AI Treatment Plan
  const [planForm, setPlanForm] = useState({ primary_diagnosis: '', date_of_injury: '', referral_source: 'physician', treatment_goals: '', duration_weeks: '6' });
  const [planResult, setPlanResult] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async (t: Tab) => {
    if (t === 'dashboard') { const r = await fetch('/api/admin/physiotherapy'); setDashboard(await r.json()); }
    if (t === 'patients') { const r = await fetch(`/api/admin/physiotherapy/patients?search=${encodeURIComponent(patientFilter)}`); setPatients(await r.json()); }
    if (t === 'appointments') { const r = await fetch(`/api/admin/physiotherapy/appointments?date=${today}`); setAppointments(await r.json()); }
    if (t === 'soap') { const r = await fetch(`/api/admin/physiotherapy/appointments?date=${today}&status=completed`); setAppointments(await r.json()); if (patients.length === 0) { const pr = await fetch('/api/admin/physiotherapy/patients'); setPatients(await pr.json()); } }
    if (t === 'plans') { const r = await fetch('/api/admin/physiotherapy/treatment-plans'); setPlans(await r.json()); }
    if (t === 'outcomes') {
      const url = outcomePatientId ? `/api/admin/physiotherapy/outcome-measures?patient_id=${outcomePatientId}` : '/api/admin/physiotherapy/outcome-measures';
      const r = await fetch(url); setOutcomes(await r.json());
      if (patients.length === 0) { const pr = await fetch('/api/admin/physiotherapy/patients'); setPatients(await pr.json()); }
    }
    if (t === 'billing') { const r = await fetch(`/api/admin/physiotherapy/appointments?status=completed`); setAppointments(await r.json()); }
  }, [patientFilter, outcomePatientId, patients.length, today]);

  useEffect(() => { load(tab); }, [tab, load]);

  async function generateSoap() {
    setSoapLoading(true);
    try {
      const r = await fetch('/api/admin/physiotherapy/ai-soap-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(soapForm) });
      const data = await r.json();
      setSoapResult(data.soap_note);
    } finally { setSoapLoading(false); }
  }

  async function generatePlan() {
    setPlanLoading(true);
    try {
      const r = await fetch('/api/admin/physiotherapy/ai-treatment-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(planForm) });
      const data = await r.json();
      setPlanResult(data.treatment_plan);
    } finally { setPlanLoading(false); }
  }

  const billingByPayer = appointments.reduce((acc, a) => {
    const payer = a.wca_claim_number ? 'WCA' : (a as Appointment & { mvac_claim_number?: string }).mvac_claim_number ? 'MVAC' : 'Direct';
    acc[payer] = (acc[payer] ?? 0) + (Number(a.fee) || 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Physiotherapy & Rehabilitation Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Patient management, SOAP notes, treatment plans, outcome measures, WCA/MVAC billing — Calgary, AB</p>
      </div>
      <div className="flex border-b bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Active Patients" value={dashboard.patients_active} color="blue" />
              <KpiCard label="Appointments Today" value={dashboard.appointments_today} color="green" />
              <KpiCard label="WCA Patients" value={dashboard.wca_patients} color="amber" />
              <KpiCard label="Discharge Due This Week" value={dashboard.discharge_due_this_week} color="purple" />
              <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="green" />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setTab('patients'); setShowAddPatient(true); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ New Patient</button>
                <button onClick={() => { setTab('appointments'); setShowNewAppt(true); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Book Appointment</button>
                <button onClick={() => setTab('soap')} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">AI SOAP Note</button>
              </div>
            </div>
          </div>
        )}

        {/* PATIENTS */}
        {tab === 'patients' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm" placeholder="Search patients…" value={patientFilter} onChange={e => setPatientFilter(e.target.value)} onKeyDown={e => e.key === 'Enter' && load('patients')} />
              <button onClick={() => load('patients')} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Search</button>
              <button onClick={() => setShowAddPatient(true)} className="ml-auto px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ New Patient</button>
            </div>
            <div className="space-y-2">
              {patients.map(p => (
                <div key={p.id} className="bg-white rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500">{p.phone} · {p.email}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{p.primary_diagnosis}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge label={p.referral_source?.replace('_',' ')} color={referralColor(p.referral_source)} />
                        <Badge label={p.status} color={statusColor(p.status)} />
                        {p.wca_claim_number && <Badge label={`WCA: ${p.wca_claim_number}`} color="amber" />}
                        {p.mvac_claim_number && <Badge label={`MVAC: ${p.mvac_claim_number}`} color="orange" />}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      <p>Injury: {fmtDate(p.date_of_injury)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {patients.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No patients found.</p>}
            </div>
            {showAddPatient && <AddPatientModal onClose={() => setShowAddPatient(false)} onSaved={() => { setShowAddPatient(false); load('patients'); }} />}
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-slate-700">Today: {fmtDate(today)}</span>
              <button onClick={() => setShowNewAppt(true)} className="ml-auto px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ Book Appointment</button>
            </div>
            <div className="space-y-2">
              {appointments.map(a => (
                <div key={a.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-4">
                  <div className="w-20 text-center">
                    <p className="text-sm font-mono font-semibold text-slate-700">{a.start_time?.slice(0,5)}</p>
                    <p className="text-xs text-gray-400">{a.end_time?.slice(0,5)}</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{a.first_name} {a.last_name}</p>
                    <p className="text-xs text-gray-500">{a.physio} · {a.treatment_type?.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-400">{a.primary_diagnosis}</p>
                    {a.wca_claim_number && <Badge label={`WCA`} color="amber" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={a.status} color={apptStatusColor(a.status)} />
                    {['scheduled','confirmed','in_progress'].includes(a.status) && (
                      <button onClick={() => setSoapAppt(a)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Complete SOAP</button>
                    )}
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No appointments for today.</p>}
            </div>
            {showNewAppt && <NewApptModal patients={patients.length ? patients : []} onClose={() => setShowNewAppt(false)} onSaved={() => { setShowNewAppt(false); load('appointments'); }} />}
            {soapAppt && <SoapModal appt={soapAppt} onClose={() => setSoapAppt(null)} onSaved={() => { setSoapAppt(null); load('appointments'); }} />}
          </div>
        )}

        {/* SOAP NOTES */}
        {tab === 'soap' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-700 mb-3">AI SOAP Note Generator</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Treatment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={soapForm.treatment_type} onChange={e => setSoapForm(p => ({ ...p, treatment_type: e.target.value }))}>{TREATMENT_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={soapForm.primary_diagnosis} onChange={e => setSoapForm(p => ({ ...p, primary_diagnosis: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Subjective (patient report)</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={soapForm.subjective} onChange={e => setSoapForm(p => ({ ...p, subjective: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Objective Findings</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={soapForm.objective_findings} onChange={e => setSoapForm(p => ({ ...p, objective_findings: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Techniques Used</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={soapForm.techniques} onChange={e => setSoapForm(p => ({ ...p, techniques: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Treatment Goals</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={soapForm.goals} onChange={e => setSoapForm(p => ({ ...p, goals: e.target.value }))} /></div>
              </div>
              <button onClick={generateSoap} disabled={soapLoading} className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">{soapLoading ? 'Generating…' : 'Generate SOAP Note'}</button>
              {soapResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                  <pre className="text-sm text-green-900 whitespace-pre-wrap font-sans leading-relaxed">{soapResult}</pre>
                  <button onClick={() => navigator.clipboard?.writeText(soapResult)} className="mt-2 text-xs text-green-700 hover:underline">Copy to clipboard</button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-700 mb-3">AI Treatment Plan Generator</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={planForm.primary_diagnosis} onChange={e => setPlanForm(p => ({ ...p, primary_diagnosis: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Date of Injury</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={planForm.date_of_injury} onChange={e => setPlanForm(p => ({ ...p, date_of_injury: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={planForm.referral_source} onChange={e => setPlanForm(p => ({ ...p, referral_source: e.target.value }))}>{REFERRAL_SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Duration (weeks)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={planForm.duration_weeks} onChange={e => setPlanForm(p => ({ ...p, duration_weeks: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Treatment Goals</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={planForm.treatment_goals} onChange={e => setPlanForm(p => ({ ...p, treatment_goals: e.target.value }))} /></div>
              </div>
              <button onClick={generatePlan} disabled={planLoading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">{planLoading ? 'Generating…' : 'Generate Treatment Plan'}</button>
              {planResult && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                  <pre className="text-sm text-blue-900 whitespace-pre-wrap font-sans leading-relaxed">{planResult}</pre>
                  <button onClick={() => navigator.clipboard?.writeText(planResult)} className="mt-2 text-xs text-blue-700 hover:underline">Copy to clipboard</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TREATMENT PLANS */}
        {tab === 'plans' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => load('plans')} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Refresh</button>
            </div>
            {plans.map(plan => {
              const pct = plan.proposed_visits ? Math.round((Number(plan.visits_completed) / plan.proposed_visits) * 100) : 0;
              return (
                <div key={plan.id} className="bg-white rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{plan.first_name} {plan.last_name}</p>
                      <p className="text-xs text-gray-500">{plan.physio} · {plan.diagnosis}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{plan.frequency ?? 'Frequency TBD'} × {plan.duration_weeks} weeks · {plan.proposed_visits} visits planned</p>
                      {plan.wca_pre_authorized && <Badge label={`WCA Auth: ${plan.wca_auth_visits ?? '?'} visits`} color="amber" />}
                    </div>
                    <div className="text-right">
                      <Badge label={plan.status} color={plan.status === 'active' ? 'green' : plan.status === 'completed' ? 'teal' : 'amber'} />
                      <p className="text-xs text-gray-400 mt-1">{plan.visits_completed ?? 0}/{plan.proposed_visits ?? '?'} visits</p>
                      <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                    </div>
                  </div>
                </div>
              );
            })}
            {plans.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No treatment plans found.</p>}
          </div>
        )}

        {/* OUTCOME MEASURES */}
        {tab === 'outcomes' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <select className="border rounded px-2 py-1.5 text-sm" value={outcomePatientId} onChange={e => setOutcomePatientId(e.target.value)}>
                <option value="">All patients</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
              <button onClick={() => load('outcomes')} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Filter</button>
              <button onClick={() => setShowAddOutcome(true)} className="ml-auto px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ Add Measure</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {outcomes.map(om => {
                const pct = om.max_score ? Math.round((om.score / om.max_score) * 100) : null;
                return (
                  <div key={om.id} className="bg-white rounded-lg border px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{om.first_name} {om.last_name}</p>
                        <p className="text-xs text-gray-500">{om.measure_type} · {fmtDate(om.assessment_date)}</p>
                        {om.interpretation && <p className="text-xs text-gray-400 mt-0.5 italic">{om.interpretation}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-700">{om.score ?? '—'}{om.max_score ? `/${om.max_score}` : ''}</p>
                        {pct !== null && <p className="text-xs text-gray-400">{pct}%</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {outcomes.length === 0 && <p className="text-sm text-gray-400 col-span-2 text-center py-8">No outcome measures found.</p>}
            </div>
            {showAddOutcome && <AddOutcomeModal patients={patients} onClose={() => setShowAddOutcome(false)} onSaved={() => { setShowAddOutcome(false); load('outcomes'); }} />}
          </div>
        )}

        {/* BILLING */}
        {tab === 'billing' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(billingByPayer).map(([payer, total]) => (
                <KpiCard key={payer} label={`${payer} Billing`} value={fmtCad(total)} color={payer === 'WCA' ? 'amber' : payer === 'MVAC' ? 'orange' : 'blue'} />
              ))}
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Date','Patient','Physio','Type','Fee','Insurance','Patient Paid'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {appointments.filter(a => a.status === 'completed').map(a => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs">{fmtDate(a.appointment_date)}</td>
                      <td className="px-4 py-2">{a.first_name} {a.last_name}</td>
                      <td className="px-4 py-2 text-xs">{a.physio}</td>
                      <td className="px-4 py-2 text-xs">{a.treatment_type?.replace(/_/g,' ')}</td>
                      <td className="px-4 py-2 text-xs font-mono">{a.fee ? fmtCad(a.fee) : '—'}</td>
                      <td className="px-4 py-2 text-xs font-mono">{(a as Appointment & { insurance_claimed?: number }).insurance_claimed ? fmtCad((a as Appointment & { insurance_claimed?: number }).insurance_claimed!) : '—'}</td>
                      <td className="px-4 py-2 text-xs font-mono">{a.patient_paid ? fmtCad(a.patient_paid) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {appointments.filter(a => a.status === 'completed').length === 0 && <p className="text-sm text-gray-400 text-center py-8">No completed appointments.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
