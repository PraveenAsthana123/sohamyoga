'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'patients', 'schedule', 'treatment', 'recalls', 'billing', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', patients: 'Patients', schedule: 'Schedule',
  treatment: 'Treatment Plans', recalls: 'Recalls', billing: 'Billing', ai: 'AI Clinical Notes',
};

const APPT_TYPES_DENTAL = ['exam', 'cleaning', 'xray', 'filling', 'crown', 'extraction', 'root_canal', 'whitening', 'orthodontics', 'emergency', 'consultation'];
const APPT_STATUSES = ['scheduled', 'confirmed', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'];
const INSURERS = ['Alberta Blue Cross', 'Manulife', 'Sun Life', 'Great-West Life', 'Canada Life', 'Desjardins', 'Industrial Alliance', 'No Insurance'];
const PROVIDERS = ['Dr. Amanda Lee', 'Dr. James Park', 'Dr. Sarah Chen', 'Dr. Michael Wang'];

interface Patient {
  id: number; name: string; email: string; phone: string; date_of_birth: string;
  alberta_health_number: string; allergies: string[]; medical_alerts: string[];
  primary_insurer: string; primary_policy_number: string; recall_interval_months: number;
  last_exam_date: string; last_cleaning_date: string; next_recall_date: string;
  preferred_provider: string; status: string;
}
interface Appointment {
  id: number; patient_id: number; patient_name: string; patient_phone: string;
  allergies: string[]; medical_alerts: string[];
  provider_name: string; appointment_type: string; procedure_codes: string[];
  appointment_date: string; appointment_time: string; duration_minutes: number;
  status: string; chair_number: number; fee: number; insurance_estimate: number;
  patient_portion: number; submitted_to_insurance: boolean; outstanding: number;
  patient_paid?: number;
}
interface TreatmentPlan {
  id: number; patient_id: number; patient_name: string; title: string; provider: string;
  total_estimated_fee: number; insurance_coverage_estimate: number; patient_responsibility: number;
  status: string; priority: string; item_count: number; items_completed: number;
}
interface Recall {
  id: number; patient_id: number; patient_name: string; patient_phone: string;
  patient_email: string; preferred_provider: string; recall_type: string; due_date: string;
  reminder_sent: boolean; booked: boolean; status: string;
}
interface Dashboard {
  appointments: { today_appointments: number; remaining_today: number; daily_production: number; insurance_pending: number };
  patients: { total_patients: number; active_patients: number };
  recalls: { overdue_recalls: number };
  billing: { total_outstanding: number; collected_today: number };
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function age(dob: string) { if (!dob) return '—'; const d = new Date(dob); const a = new Date().getFullYear() - d.getFullYear(); return `${a}y`; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function apptStatusColor(s: string) {
  return { scheduled: 'gray', confirmed: 'blue', arrived: 'teal', seated: 'purple', completed: 'green', no_show: 'red', cancelled: 'red' }[s] ?? 'gray';
}

// ─── Add Patient Modal ──────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', date_of_birth: '', health_card_number: '', alberta_health_number: '',
    address: '', city: 'Calgary', province: 'AB', gender: '', preferred_language: 'English',
    emergency_contact: '', emergency_phone: '',
    allergies: '', medical_alerts: '',
    primary_insurer: 'No Insurance', primary_policy_number: '', primary_group_number: '',
    secondary_insurer: '', secondary_policy_number: '',
    recall_interval_months: '6', preferred_provider: PROVIDERS[0], status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/dental-medical/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
          medical_alerts: form.medical_alerts ? form.medical_alerts.split(',').map(s => s.trim()).filter(Boolean) : [],
          recall_interval_months: parseInt(form.recall_interval_months),
        }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">New Patient — Step {step}/3</h2>
          <div className="flex gap-1">{[1,2,3].map(s => <div key={s} className={`w-8 h-2 rounded ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />)}</div>
        </div>
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Full Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Gender</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.gender} onChange={e => f('gender', e.target.value)}><option value="">Select</option>{['Male','Female','Non-binary','Prefer not to say'].map(g => <option key={g}>{g}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Alberta Health Number (AHN)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.alberta_health_number} onChange={e => f('alberta_health_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Health Card #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.health_card_number} onChange={e => f('health_card_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)} /></div>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-semibold text-red-700 mb-2">HEALTH ALERTS</p>
              <div><label className="text-xs text-gray-500">Allergies (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.allergies} onChange={e => f('allergies', e.target.value)} placeholder="Penicillin, Latex" /></div>
              <div className="mt-2"><label className="text-xs text-gray-500">Medical Alerts</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.medical_alerts} onChange={e => f('medical_alerts', e.target.value)} placeholder="Pacemaker, Warfarin" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Emergency Contact</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact} onChange={e => f('emergency_contact', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Emergency Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_phone} onChange={e => f('emergency_phone', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Primary Insurer</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_insurer} onChange={e => f('primary_insurer', e.target.value)}>{INSURERS.map(i => <option key={i}>{i}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Policy #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_policy_number} onChange={e => f('primary_policy_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Group #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_group_number} onChange={e => f('primary_group_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Secondary Insurer</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.secondary_insurer} onChange={e => f('secondary_insurer', e.target.value)} /></div>
          </div>
        )}
        {step === 3 && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Preferred Provider</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_provider} onChange={e => f('preferred_provider', e.target.value)}>{PROVIDERS.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Recall Interval (months)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recall_interval_months} onChange={e => f('recall_interval_months', e.target.value)}>{['3','6','9','12'].map(m => <option key={m} value={m}>{m} months</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Preferred Language</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_language} onChange={e => f('preferred_language', e.target.value)}>{['English','French','Mandarin','Cantonese','Punjabi','Hindi','Spanish','Other'].map(l => <option key={l}>{l}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
          </div>
        )}
        <div className="flex justify-between mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-1.5 rounded border text-sm text-gray-600">Back</button>}
            {step < 3 && <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">Next</button>}
            {step === 3 && <button onClick={submit} disabled={saving || !form.name} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Create Patient'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Appointment Modal ──────────────────────────────────────────────────
function NewApptModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    patient_id: '', provider_name: PROVIDERS[0], appointment_type: 'cleaning',
    procedure_codes: '', appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '09:00', duration_minutes: '60', status: 'scheduled',
    chair_number: '1', fee: '', insurance_estimate: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.appointment_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/dental-medical/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, patient_id: parseInt(form.patient_id), chair_number: parseInt(form.chair_number),
          duration_minutes: parseInt(form.duration_minutes), fee: form.fee ? parseFloat(form.fee) : null,
          insurance_estimate: form.insurance_estimate ? parseFloat(form.insurance_estimate) : null,
          procedure_codes: form.procedure_codes ? form.procedure_codes.split(',').map(s => s.trim()) : [],
        }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Appointment</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => f('patient_id', e.target.value)}><option value="">Select patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Provider</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.provider_name} onChange={e => f('provider_name', e.target.value)}>{PROVIDERS.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Appointment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_type} onChange={e => f('appointment_type', e.target.value)}>{APPT_TYPES_DENTAL.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_date} onChange={e => f('appointment_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_time} onChange={e => f('appointment_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_minutes} onChange={e => f('duration_minutes', e.target.value)}>{['30','45','60','90','120'].map(d => <option key={d}>{d}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Chair #</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chair_number} onChange={e => f('chair_number', e.target.value)}>{['1','2','3','4','5','6'].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">ADA Procedure Codes</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.procedure_codes} onChange={e => f('procedure_codes', e.target.value)} placeholder="D1110, D0274" /></div>
          <div><label className="text-xs text-gray-500">Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e => f('fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Est.</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_estimate} onChange={e => f('insurance_estimate', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.patient_id} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Book Appointment'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DentalMedicalPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [billing, setBilling] = useState<{ daily: Appointment[]; outstanding: Appointment[]; insurance_pending: Appointment[] } | null>(null);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [patSearch, setPatSearch] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [recallType, setRecallType] = useState('overdue');
  const [aiForm, setAiForm] = useState({ appointment_type: 'cleaning', procedure_codes: '', findings: '' });
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const r = await fetch('/api/admin/dental-medical');
    if (r.ok) setDashboard(await r.json());
  }, []);

  const loadPatients = useCallback(async () => {
    const params = new URLSearchParams();
    if (patSearch) params.set('search', patSearch);
    const r = await fetch(`/api/admin/dental-medical/patients?${params}`);
    if (r.ok) setPatients(await r.json());
  }, [patSearch]);

  const loadSchedule = useCallback(async () => {
    const r = await fetch(`/api/admin/dental-medical/appointments?date=${scheduleDate}`);
    if (r.ok) setAppointments(await r.json());
  }, [scheduleDate]);

  const loadPlans = useCallback(async () => {
    const r = await fetch('/api/admin/dental-medical/treatment-plans');
    if (r.ok) setPlans(await r.json());
  }, []);

  const loadRecalls = useCallback(async () => {
    const r = await fetch(`/api/admin/dental-medical/recalls?type=${recallType}`);
    if (r.ok) setRecalls(await r.json());
  }, [recallType]);

  const loadBilling = useCallback(async () => {
    const r = await fetch('/api/admin/dental-medical/billing');
    if (r.ok) setBilling(await r.json());
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'patients') loadPatients(); }, [tab, loadPatients]);
  useEffect(() => { if (tab === 'schedule') { loadSchedule(); loadPatients(); } }, [tab, scheduleDate, loadSchedule, loadPatients]);
  useEffect(() => { if (tab === 'treatment') { loadPlans(); loadPatients(); } }, [tab, loadPlans, loadPatients]);
  useEffect(() => { if (tab === 'recalls') loadRecalls(); }, [tab, recallType, loadRecalls]);
  useEffect(() => { if (tab === 'billing') loadBilling(); }, [tab, loadBilling]);

  async function updateApptStatus(id: number, status: string) {
    await fetch(`/api/admin/dental-medical/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadSchedule(); loadDashboard();
  }

  async function sendReminder(id: number) {
    await fetch(`/api/admin/dental-medical/recalls/${id}/remind`, { method: 'POST' });
    loadRecalls();
  }

  async function submitToInsurance(id: number) {
    await fetch(`/api/admin/dental-medical/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submitted_to_insurance: true }) });
    loadBilling();
  }

  async function generateNotes() {
    if (!aiForm.appointment_type) return;
    setAiLoading(true); setAiNotes('');
    try {
      const r = await fetch('/api/admin/dental-medical/ai-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aiForm, procedure_codes: aiForm.procedure_codes ? aiForm.procedure_codes.split(',').map(s => s.trim()) : [] }) });
      const data = await r.json();
      setAiNotes(data.notes ?? data.error ?? 'No response');
    } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Dental & Medical Clinic Portal</h1>
        <p className="text-slate-400 text-sm">Multi-provider · Patients · Treatment · Billing · Recalls</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Today's Appointments" value={dashboard.appointments.today_appointments ?? 0} sub={`${dashboard.appointments.remaining_today} remaining`} color="blue" />
              <KpiCard label="Daily Production" value={fmtCad(dashboard.appointments.daily_production)} color="green" />
              <KpiCard label="Overdue Recalls" value={dashboard.recalls.overdue_recalls ?? 0} color={parseInt(String(dashboard.recalls.overdue_recalls)) > 5 ? 'red' : 'amber'} />
              <KpiCard label="Outstanding Balances" value={fmtCad(dashboard.billing.total_outstanding)} sub={`Ins. pending: ${fmtCad(dashboard.appointments.insurance_pending)}`} color="purple" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm font-medium text-gray-600">Practice Overview</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total Patients</span><span className="font-medium">{dashboard.patients.total_patients}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Active Patients</span><span className="font-medium text-green-600">{dashboard.patients.active_patients}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Overdue Recalls</span><span className={`font-medium ${parseInt(String(dashboard.recalls.overdue_recalls)) > 0 ? 'text-red-600' : 'text-green-600'}`}>{dashboard.recalls.overdue_recalls}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Collected Today</span><span className="font-medium">{fmtCad(dashboard.billing.collected_today)}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm font-medium text-gray-600">Quick Actions</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => { setTab('schedule'); }} className="px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100">Today's Schedule</button>
                  <button onClick={() => { setTab('recalls'); }} className="px-3 py-2 bg-amber-50 text-amber-700 rounded text-sm hover:bg-amber-100">Overdue Recalls</button>
                  <button onClick={() => { setTab('billing'); }} className="px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">Billing</button>
                  <button onClick={() => { setTab('ai'); }} className="px-3 py-2 bg-purple-50 text-purple-700 rounded text-sm hover:bg-purple-100">AI Notes</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PATIENTS */}
        {tab === 'patients' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input className="border rounded px-3 py-2 text-sm w-72" placeholder="Search name, phone, AHN…" value={patSearch} onChange={e => setPatSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPatients()} />
              <button onClick={loadPatients} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Search</button>
              <button onClick={() => setShowAddPatient(true)} className="ml-auto px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium">+ New Patient</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','DOB/Age','AHN','Phone','Insurer','Last Visit','Next Recall','Provider','Alerts'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {patients.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{fmtDate(p.date_of_birth)}<br />{age(p.date_of_birth)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.alberta_health_number || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{p.phone || '—'}</td>
                      <td className="px-4 py-2 text-xs">{p.primary_insurer || 'None'}</td>
                      <td className="px-4 py-2 text-xs">{p.last_cleaning_date ? fmtDate(p.last_cleaning_date) : '—'}</td>
                      <td className="px-4 py-2">
                        {p.next_recall_date && new Date(p.next_recall_date) < new Date()
                          ? <Badge label="OVERDUE" color="red" />
                          : <span className="text-xs text-gray-500">{p.next_recall_date ? fmtDate(p.next_recall_date) : '—'}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs">{p.preferred_provider || '—'}</td>
                      <td className="px-4 py-2">
                        {(p.allergies?.length > 0 || p.medical_alerts?.length > 0) && <Badge label="⚠️ Alert" color="red" />}
                      </td>
                    </tr>
                  ))}
                  {patients.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No patients found. Use search or add a new patient.</td></tr>}
                </tbody>
              </table>
            </div>
            {showAddPatient && <AddPatientModal onClose={() => setShowAddPatient(false)} onSaved={() => { setShowAddPatient(false); loadPatients(); }} />}
          </div>
        )}

        {/* SCHEDULE */}
        {tab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input type="date" className="border rounded px-3 py-2 text-sm" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              <button onClick={loadSchedule} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Load</button>
              <button onClick={() => setShowNewAppt(true)} className="ml-auto px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium">+ New Appointment</button>
            </div>
            {/* Chair View */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-20">Time</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Patient</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Type</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Provider</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Chair</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fee</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map(a => (
                    <tr key={a.id} className={`hover:bg-gray-50 ${a.allergies?.length > 0 || a.medical_alerts?.length > 0 ? 'border-l-2 border-red-400' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs">{a.appointment_time || '—'}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{a.patient_name}</p>
                        <p className="text-xs text-gray-400">{a.patient_phone}</p>
                        {(a.allergies?.length > 0) && <p className="text-xs text-red-600">⚠️ {a.allergies.join(', ')}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <p>{a.appointment_type?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400 font-mono">{a.procedure_codes?.join(', ')}</p>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{a.provider_name}</td>
                      <td className="px-4 py-2 text-center font-medium">{a.chair_number}</td>
                      <td className="px-4 py-2">
                        {a.fee ? <><p>{fmtCad(a.fee)}</p><p className="text-xs text-gray-400">Ins: {fmtCad(a.insurance_estimate)}</p></> : '—'}
                      </td>
                      <td className="px-4 py-2"><Badge label={a.status} color={apptStatusColor(a.status)} /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {a.status === 'scheduled' && <button onClick={() => updateApptStatus(a.id, 'arrived')} className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">Arrived</button>}
                          {a.status === 'arrived' && <button onClick={() => updateApptStatus(a.id, 'seated')} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Seated</button>}
                          {a.status === 'seated' && <button onClick={() => updateApptStatus(a.id, 'completed')} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Complete</button>}
                          {a.status === 'scheduled' && <button onClick={() => updateApptStatus(a.id, 'no_show')} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">No-Show</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {appointments.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No appointments for this date.</td></tr>}
                </tbody>
              </table>
            </div>
            {showNewAppt && <NewApptModal patients={patients} onClose={() => setShowNewAppt(false)} onSaved={() => { setShowNewAppt(false); loadSchedule(); loadDashboard(); }} />}
          </div>
        )}

        {/* TREATMENT PLANS */}
        {tab === 'treatment' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <h2 className="font-semibold text-slate-800">Treatment Plans</h2>
              <button onClick={loadPlans} className="ml-auto px-3 py-2 bg-gray-700 text-white rounded text-sm">Refresh</button>
            </div>
            <div className="space-y-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{plan.title}</p>
                      <p className="text-sm text-gray-500">{plan.patient_name} — {plan.provider}</p>
                    </div>
                    <div className="text-right">
                      <Badge label={plan.status} color={plan.status === 'accepted' ? 'green' : plan.status === 'declined' ? 'red' : plan.status === 'in_progress' ? 'blue' : 'gray'} />
                      <p className="text-xs text-gray-400 mt-1">Priority: {plan.priority}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Total Fee</p><p className="font-medium">{fmtCad(plan.total_estimated_fee)}</p></div>
                    <div><p className="text-xs text-gray-400">Insurance</p><p className="font-medium text-teal-700">{fmtCad(plan.insurance_coverage_estimate)}</p></div>
                    <div><p className="text-xs text-gray-400">Patient Portion</p><p className="font-medium text-amber-700">{fmtCad(plan.patient_responsibility)}</p></div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-teal-500 rounded-full" style={{ width: plan.item_count > 0 ? `${(parseInt(String(plan.items_completed)) / parseInt(String(plan.item_count))) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-gray-500">{plan.items_completed}/{plan.item_count} complete</span>
                    {plan.status === 'proposed' && (
                      <div className="flex gap-2">
                        <button onClick={async () => { await fetch(`/api/admin/dental-medical/treatment-plans/${plan.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status:'accepted'}) }); loadPlans(); }} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs">Accept</button>
                        <button onClick={async () => { await fetch(`/api/admin/dental-medical/treatment-plans/${plan.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status:'declined'}) }); loadPlans(); }} className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs">Decline</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {plans.length === 0 && <p className="text-center text-gray-400 py-12">No treatment plans found.</p>}
            </div>
          </div>
        )}

        {/* RECALLS */}
        {tab === 'recalls' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[['overdue','Overdue'],['upcoming','Upcoming (30d)'],['all','All']].map(([v, l]) => (
                  <button key={v} onClick={() => setRecallType(v)} className={`px-3 py-1.5 rounded text-sm ${recallType === v ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Phone','Recall Type','Due Date','Provider','Status','Actions'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {recalls.map(r => {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(r.due_date).getTime()) / 86400000);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{r.patient_name}</td>
                        <td className="px-4 py-2 text-gray-500">{r.patient_phone || '—'}</td>
                        <td className="px-4 py-2">{r.recall_type?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2">
                          <p>{fmtDate(r.due_date)}</p>
                          {daysOverdue > 0 && <Badge label={`${daysOverdue}d overdue`} color={daysOverdue > 30 ? 'red' : 'amber'} />}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{r.preferred_provider || '—'}</td>
                        <td className="px-4 py-2"><Badge label={r.status} color={r.status === 'booked' ? 'green' : r.status === 'reminded' ? 'blue' : 'gray'} /></td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            {!r.reminder_sent && <button onClick={() => sendReminder(r.id)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Send Reminder</button>}
                            {r.reminder_sent && !r.booked && <button onClick={() => setTab('schedule')} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Book Appt</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {recalls.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No recalls in this category.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BILLING */}
        {tab === 'billing' && billing && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Today's Production</h3>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Patient','Type','Fee','Insurance','Patient Portion','Submitted'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {billing.daily.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{a.patient_name}</td>
                        <td className="px-4 py-2">{a.appointment_type?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 font-medium">{fmtCad(a.fee)}</td>
                        <td className="px-4 py-2 text-teal-700">{fmtCad(a.insurance_estimate)}</td>
                        <td className="px-4 py-2 text-amber-700">{fmtCad(a.patient_portion)}</td>
                        <td className="px-4 py-2">
                          {a.submitted_to_insurance ? <Badge label="Submitted" color="green" /> : <button onClick={() => submitToInsurance(a.id)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Submit</button>}
                        </td>
                      </tr>
                    ))}
                    {billing.daily.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">No completed appointments today.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Outstanding Balances</h3>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Patient','Appointment Date','Type','Fee','Paid','Outstanding'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {billing.outstanding.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{a.patient_name}</td>
                        <td className="px-4 py-2 text-gray-500">{fmtDate(a.appointment_date)}</td>
                        <td className="px-4 py-2">{a.appointment_type?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2">{fmtCad(a.fee)}</td>
                        <td className="px-4 py-2 text-green-700">{fmtCad(a.patient_paid ?? 0)}</td>
                        <td className="px-4 py-2 font-medium text-red-700">{fmtCad(a.outstanding)}</td>
                      </tr>
                    ))}
                    {billing.outstanding.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">No outstanding balances.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AI CLINICAL NOTES */}
        {tab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold text-slate-800 mb-1">AI Clinical Notes Generator</h3>
              <p className="text-xs text-amber-600 mb-4">⚠️ For provider review and editing only. Not for direct use as clinical documentation.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="text-xs text-gray-500">Appointment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.appointment_type} onChange={e => setAiForm(p => ({ ...p, appointment_type: e.target.value }))}>{APPT_TYPES_DENTAL.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Procedure Codes</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={aiForm.procedure_codes} onChange={e => setAiForm(p => ({ ...p, procedure_codes: e.target.value }))} placeholder="D1110, D0274" /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Clinical Findings</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={4} value={aiForm.findings} onChange={e => setAiForm(p => ({ ...p, findings: e.target.value }))} placeholder="Describe clinical findings, patient complaints, examination results…" /></div>
              </div>
              <button onClick={generateNotes} disabled={aiLoading} className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate SOAP Notes'}</button>
              {aiNotes && (
                <div className="mt-4">
                  <pre className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-sans border">{aiNotes}</pre>
                  <p className="text-xs text-gray-400 mt-2">AI-generated. Provider must review, verify, and edit before saving to patient record.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
