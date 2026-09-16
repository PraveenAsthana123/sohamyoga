'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','owners','appointments','vaccinations','prescriptions','ai-support'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', patients: 'Patients', owners: 'Owners', appointments: 'Appointments', vaccinations: 'Vaccinations', prescriptions: 'Prescriptions', 'ai-support': 'AI Clinical Support' };

const SPECIES_LIST = ['dog','cat','bird','rabbit','reptile','fish','hamster','guinea_pig','horse','other'];
const SPECIES_EMOJI: Record<string, string> = { dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇', reptile: '🦎', fish: '🐟', hamster: '🐹', guinea_pig: '🐾', horse: '🐴', other: '🐾' };
const APPT_TYPES = ['wellness','sick_visit','surgery','dental','vaccination','follow_up','euthanasia','grooming','boarding','other'];
const APPT_STATUSES = ['scheduled','confirmed','checked_in','in_progress','completed','cancelled','no_show'];

interface DashData { appointments_today: number; patients_active: number; vaccinations_due_30d: number; revenue_mtd: number; }
interface Owner { id: number; first_name: string; last_name: string; email: string; phone: string; city: string; pet_count: number; }
interface Patient { id: number; owner_id: number; owner_first: string; owner_last: string; owner_phone: string; name: string; species: string; breed: string; age_years: number; sex: string; spayed_neutered: boolean; weight_kg: number; allergies: string; current_medications: string; status: string; }
interface Appointment { id: number; patient_id: number; patient_name: string; species: string; breed: string; owner_first: string; owner_last: string; owner_phone: string; appointment_type: string; scheduled_at: string; vet_name: string; status: string; chief_complaint: string; diagnosis: string; treatment_notes: string; total_amount: number; weight_kg: number; }
interface Vaccination { id: number; patient_id: number; patient_name: string; species: string; owner_first: string; owner_last: string; owner_phone: string; vaccine_name: string; administered_date: string; next_due_date: string; administered_by: string; }
interface Prescription { id: number; patient_id: number; patient_name: string; species: string; medication_name: string; dosage: string; frequency: string; duration_days: number; refills_remaining: number; prescribed_date: string; dispensed: boolean; prescribed_by: string; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDT(d: string) { if (!d) return '—'; const dt = new Date(d); return `${dt.toLocaleDateString('en-CA')} ${dt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`; }
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{cap(label)}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function apptStatusColor(s: string): string {
  const m: Record<string, string> = { scheduled: 'blue', confirmed: 'teal', checked_in: 'purple', in_progress: 'amber', completed: 'green', cancelled: 'gray', no_show: 'red' };
  return m[s] ?? 'gray';
}
function apptTypeColor(t: string): string {
  const m: Record<string, string> = { wellness: 'green', sick_visit: 'amber', surgery: 'red', dental: 'blue', vaccination: 'teal', follow_up: 'purple', euthanasia: 'gray', grooming: 'orange', boarding: 'blue', other: 'gray' };
  return m[t] ?? 'gray';
}

// ── Add Owner Modal ───────────────────────────────────────────────────────────
function AddOwnerModal({ onClose, onSaved }: { onClose: () => void; onSaved: (ownerId: number) => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', address: '', city: 'Calgary', province: 'AB', preferred_contact: 'phone' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.phone) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/veterinary-clinic/owners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { const d = await res.json(); onSaved(d.id); }
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Owner</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Preferred Contact</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_contact} onChange={e => f('preferred_contact', e.target.value)}><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option></select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Add Owner'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Patient Modal ─────────────────────────────────────────────────────────
function AddPatientModal({ owners, onClose, onSaved }: { owners: Owner[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ owner_id: '', name: '', species: 'dog', breed: '', color: '', date_of_birth: '', sex: 'female', spayed_neutered: false, weight_kg: '', microchip_number: '', allergies: '', current_medications: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.owner_id || !form.name || !form.species) return;
    setSaving(true);
    try {
      await fetch('/api/admin/veterinary-clinic/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, owner_id: parseInt(form.owner_id), weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Patient</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Owner *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.owner_id} onChange={e => f('owner_id', e.target.value)}><option value="">— select owner —</option>{owners.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name} ({o.phone})</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Patient Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Species *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.species} onChange={e => f('species', e.target.value)}>{SPECIES_LIST.map(s => <option key={s} value={s}>{SPECIES_EMOJI[s]} {cap(s)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Breed</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.breed} onChange={e => f('breed', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Color</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.color} onChange={e => f('color', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Sex</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.sex} onChange={e => f('sex', e.target.value)}><option value="female">Female</option><option value="male">Male</option><option value="unknown">Unknown</option></select></div>
          <div><label className="text-xs text-gray-500">Weight (kg)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.weight_kg} onChange={e => f('weight_kg', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Microchip #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.microchip_number} onChange={e => f('microchip_number', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="sn" checked={form.spayed_neutered} onChange={e => f('spayed_neutered', e.target.checked)} /><label htmlFor="sn" className="text-sm">Spayed / Neutered</label></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Known Allergies</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.allergies} onChange={e => f('allergies', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Current Medications</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_medications} onChange={e => f('current_medications', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Appointment Modal ─────────────────────────────────────────────────────
function AddAppointmentModal({ patients, owners, onClose, onSaved }: { patients: Patient[]; owners: Owner[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patient_id: '', owner_id: '', appointment_type: 'wellness', scheduled_at: '', vet_name: '', chief_complaint: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.owner_id || !form.scheduled_at) return;
    setSaving(true);
    try {
      await fetch('/api/admin/veterinary-clinic/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), owner_id: parseInt(form.owner_id) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Book Appointment</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => { const p = patients.find(x => x.id === parseInt(e.target.value)); f('patient_id', e.target.value); if (p) f('owner_id', p.owner_id.toString()); }}><option value="">— select patient —</option>{patients.map(p => <option key={p.id} value={p.id}>{SPECIES_EMOJI[p.species]} {p.name} ({p.owner_first} {p.owner_last})</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Owner *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.owner_id} onChange={e => f('owner_id', e.target.value)}><option value="">— select owner —</option>{owners.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Appointment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_type} onChange={e => f('appointment_type', e.target.value)}>{APPT_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Date & Time *</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.scheduled_at} onChange={e => f('scheduled_at', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Veterinarian</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Dr. Name" value={form.vet_name} onChange={e => f('vet_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Chief Complaint</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.chief_complaint} onChange={e => f('chief_complaint', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Book Appointment'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Appointment Modal ────────────────────────────────────────────────
function CompleteApptModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ diagnosis: '', treatment_notes: '', total_amount: '', follow_up_needed: false, follow_up_date: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/veterinary-clinic/appointments/${appt.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed', diagnosis: form.diagnosis, treatment_notes: form.treatment_notes, total_amount: form.total_amount ? parseFloat(form.total_amount) : null, follow_up_needed: form.follow_up_needed, follow_up_date: form.follow_up_date || null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">{SPECIES_EMOJI[appt.species]} {appt.patient_name} — {appt.owner_first} {appt.owner_last}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Diagnosis</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.diagnosis} onChange={e => f('diagnosis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Treatment Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.treatment_notes} onChange={e => f('treatment_notes', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Total Amount ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_amount} onChange={e => f('total_amount', e.target.value)} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="fu" checked={form.follow_up_needed} onChange={e => f('follow_up_needed', e.target.checked)} /><label htmlFor="fu" className="text-sm">Follow-up needed</label></div>
          {form.follow_up_needed && <div><label className="text-xs text-gray-500">Follow-up Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.follow_up_date} onChange={e => f('follow_up_date', e.target.value)} /></div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Complete & Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function VeterinaryClinicPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [vaccDue, setVaccDue] = useState<Vaccination[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [completeAppt, setCompleteAppt] = useState<Appointment | null>(null);
  const [apptDate, setApptDate] = useState(new Date().toISOString().slice(0, 10));
  const [patientSearch, setPatientSearch] = useState('');
  const [vaccTab, setVaccTab] = useState<'history' | 'due'>('history');
  const [rxPatientId, setRxPatientId] = useState('');
  const [aiForm, setAiForm] = useState({ patient_id: '', species: 'dog', breed: '', age: '', symptoms: '', weight_kg: '', current_medications: '' });
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [addVaccForm, setAddVaccForm] = useState({ patient_id: '', vaccine_name: '', administered_date: new Date().toISOString().slice(0, 10), next_due_date: '', administered_by: '', batch_number: '' });
  const [addRxForm, setAddRxForm] = useState({ patient_id: '', medication_name: '', dosage: '', frequency: '', duration_days: '', refills_remaining: '0', prescribed_by: '' });
  const [showAddVacc, setShowAddVacc] = useState(false);
  const [showAddRx, setShowAddRx] = useState(false);

  const loadDash = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/veterinary-clinic');
    if (res.ok) setDash(await res.json());
    setLoading(false);
  }, []);
  const loadPatients = useCallback(async () => {
    const url = patientSearch ? `/api/admin/veterinary-clinic/patients?search=${encodeURIComponent(patientSearch)}` : '/api/admin/veterinary-clinic/patients';
    const res = await fetch(url);
    if (res.ok) setPatients(await res.json());
  }, [patientSearch]);
  const loadOwners = useCallback(async () => {
    const res = await fetch('/api/admin/veterinary-clinic/owners');
    if (res.ok) setOwners(await res.json());
  }, []);
  const loadAppointments = useCallback(async () => {
    const res = await fetch(`/api/admin/veterinary-clinic/appointments?date=${apptDate}`);
    if (res.ok) setAppointments(await res.json());
  }, [apptDate]);
  const loadVaccinations = useCallback(async () => {
    const res = await fetch('/api/admin/veterinary-clinic/vaccinations');
    if (res.ok) setVaccinations(await res.json());
  }, []);
  const loadVaccDue = useCallback(async () => {
    const res = await fetch('/api/admin/veterinary-clinic/vaccinations/due');
    if (res.ok) setVaccDue(await res.json());
  }, []);
  const loadPrescriptions = useCallback(async () => {
    const url = rxPatientId ? `/api/admin/veterinary-clinic/prescriptions?patient_id=${rxPatientId}` : '/api/admin/veterinary-clinic/prescriptions';
    const res = await fetch(url);
    if (res.ok) setPrescriptions(await res.json());
  }, [rxPatientId]);

  useEffect(() => { loadDash(); loadOwners(); loadPatients(); }, [loadDash, loadOwners, loadPatients]);
  useEffect(() => { if (tab === 'appointments') loadAppointments(); }, [tab, loadAppointments, apptDate]);
  useEffect(() => { if (tab === 'vaccinations') { loadVaccinations(); loadVaccDue(); } }, [tab, loadVaccinations, loadVaccDue]);
  useEffect(() => { if (tab === 'prescriptions') loadPrescriptions(); }, [tab, loadPrescriptions, rxPatientId]);

  async function updateApptStatus(id: number, status: string) {
    await fetch(`/api/admin/veterinary-clinic/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadAppointments(); loadDash();
  }

  async function dispenseRx(id: number) {
    await fetch(`/api/admin/veterinary-clinic/prescriptions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dispensed: true }) });
    loadPrescriptions();
  }

  async function addVaccination() {
    if (!addVaccForm.patient_id || !addVaccForm.vaccine_name || !addVaccForm.administered_date) return;
    await fetch('/api/admin/veterinary-clinic/vaccinations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...addVaccForm, patient_id: parseInt(addVaccForm.patient_id) }) });
    setShowAddVacc(false); setAddVaccForm(p => ({ ...p, patient_id: '', vaccine_name: '', batch_number: '', next_due_date: '' }));
    loadVaccinations(); loadVaccDue(); loadDash();
  }

  async function addPrescription() {
    if (!addRxForm.patient_id || !addRxForm.medication_name || !addRxForm.dosage || !addRxForm.frequency) return;
    await fetch('/api/admin/veterinary-clinic/prescriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...addRxForm, patient_id: parseInt(addRxForm.patient_id), duration_days: addRxForm.duration_days ? parseInt(addRxForm.duration_days) : null, refills_remaining: parseInt(addRxForm.refills_remaining) }) });
    setShowAddRx(false); loadPrescriptions();
  }

  async function generateAiSupport() {
    if (!aiForm.species || !aiForm.symptoms) return;
    setAiLoading(true);
    const patient = patients.find(p => p.id === parseInt(aiForm.patient_id));
    const payload = { species: aiForm.species || patient?.species, breed: aiForm.breed || patient?.breed, age: aiForm.age || (patient?.age_years ? String(Math.round(patient.age_years)) : ''), symptoms: aiForm.symptoms, weight_kg: aiForm.weight_kg || patient?.weight_kg, current_medications: aiForm.current_medications || patient?.current_medications, patient_name: patient?.name };
    const res = await fetch('/api/admin/veterinary-clinic/ai-diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { const d = await res.json(); setAiOutput(d.notes); setAiUsed(d.ai_used); }
    setAiLoading(false);
  }

  const todayAppts = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Veterinary Clinic Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Calgary Small Animal Practice Management</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading && <p className="text-gray-400 text-sm">Loading…</p>}
            {dash && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Appointments Today" value={dash.appointments_today} color="blue" />
                  <KpiCard label="Active Patients" value={dash.patients_active} color="green" />
                  <KpiCard label="Vaccinations Due (30d)" value={dash.vaccinations_due_30d} color={dash.vaccinations_due_30d > 5 ? 'amber' : 'teal'} />
                  <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="purple" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Today&apos;s Appointments</h3>
                    <div className="space-y-2">
                      {todayAppts.slice(0, 6).map(a => (
                        <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                          <div><p className="text-sm font-medium">{SPECIES_EMOJI[a.species]} {a.patient_name}</p><p className="text-xs text-gray-400">{fmtDT(a.scheduled_at)} · {a.vet_name || '—'}</p></div>
                          <div className="flex gap-1"><Badge label={a.appointment_type} color={apptTypeColor(a.appointment_type)} /><Badge label={a.status} color={apptStatusColor(a.status)} /></div>
                        </div>
                      ))}
                      {!todayAppts.length && <p className="text-sm text-gray-400">No appointments today.</p>}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Vaccinations Due This Week</h3>
                    {vaccDue.slice(0, 5).map(v => (
                      <div key={v.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <div><p className="text-sm font-medium">{SPECIES_EMOJI[v.species]} {v.patient_name}</p><p className="text-xs text-gray-400">{v.vaccine_name} · {v.owner_first} {v.owner_last}</p></div>
                        <span className="text-xs text-amber-600 font-medium">Due {fmtDate(v.next_due_date)}</span>
                      </div>
                    ))}
                    {!vaccDue.length && <p className="text-sm text-gray-400">No vaccinations due in 7 days.</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Patients ── */}
        {tab === 'patients' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Patients ({patients.length})</h2>
              <input className="border rounded px-2 py-1.5 text-sm" placeholder="Search name or owner…" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPatients()} />
              <button onClick={loadPatients} className="px-3 py-1.5 border rounded text-sm text-gray-600">Search</button>
              <button onClick={() => setShowAddPatient(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium ml-auto">+ Add Patient</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Patient','Species/Breed','Age','Weight','Owner','S/N','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patients.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3"><span className="mr-1">{SPECIES_EMOJI[p.species]}</span>{cap(p.species)}{p.breed ? ` · ${p.breed}` : ''}</td>
                      <td className="px-4 py-3">{p.age_years ? `${Math.round(p.age_years)} yr` : '—'}</td>
                      <td className="px-4 py-3">{p.weight_kg ? `${p.weight_kg}kg` : '—'}</td>
                      <td className="px-4 py-3"><p>{p.owner_first} {p.owner_last}</p><p className="text-xs text-gray-400">{p.owner_phone}</p></td>
                      <td className="px-4 py-3">{p.spayed_neutered ? <Badge label="Yes" color="green" /> : <Badge label="No" color="gray" />}</td>
                      <td className="px-4 py-3"><Badge label={p.status} color={p.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!patients.length && <p className="text-center text-gray-400 py-8">No patients found.</p>}
            </div>
            {showAddPatient && <AddPatientModal owners={owners} onClose={() => setShowAddPatient(false)} onSaved={() => { setShowAddPatient(false); loadPatients(); loadDash(); }} />}
          </div>
        )}

        {/* ── Owners ── */}
        {tab === 'owners' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Owners ({owners.length})</h2>
              <button onClick={() => setShowAddOwner(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Add Owner</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Owner','Phone','Email','City','Pets'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {owners.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{o.first_name} {o.last_name}</td>
                      <td className="px-4 py-3">{o.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{o.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{o.city}</td>
                      <td className="px-4 py-3"><Badge label={`${o.pet_count} pet${Number(o.pet_count) !== 1 ? 's' : ''}`} color="blue" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!owners.length && <p className="text-center text-gray-400 py-8">No owners found.</p>}
            </div>
            {showAddOwner && <AddOwnerModal onClose={() => setShowAddOwner(false)} onSaved={() => { setShowAddOwner(false); loadOwners(); }} />}
          </div>
        )}

        {/* ── Appointments ── */}
        {tab === 'appointments' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Appointments</h2>
              <input type="date" className="border rounded px-2 py-1.5 text-sm" value={apptDate} onChange={e => setApptDate(e.target.value)} />
              <button onClick={() => setShowAddAppt(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium ml-auto">+ Book Appointment</button>
            </div>
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="bg-white rounded-xl border p-4">
                  <div className="flex flex-wrap gap-3 items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{SPECIES_EMOJI[a.species]}</span>
                        <div>
                          <p className="font-semibold text-slate-800">{a.patient_name}</p>
                          <p className="text-xs text-gray-400">{a.breed} · Owner: {a.owner_first} {a.owner_last} ({a.owner_phone})</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge label={a.appointment_type} color={apptTypeColor(a.appointment_type)} />
                      <Badge label={a.status} color={apptStatusColor(a.status)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2">
                    <span>{fmtDT(a.scheduled_at)}</span>
                    {a.vet_name && <span>Dr: {a.vet_name}</span>}
                    {a.weight_kg && <span>Weight: {a.weight_kg}kg</span>}
                  </div>
                  {a.chief_complaint && <p className="text-sm text-gray-600 mb-2">Complaint: {a.chief_complaint}</p>}
                  {a.diagnosis && <p className="text-sm text-blue-700 mb-1">Dx: {a.diagnosis}</p>}
                  {a.total_amount && <p className="text-sm font-semibold text-green-700">Invoice: {fmtCad(a.total_amount)}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {a.status === 'scheduled' && <button onClick={() => updateApptStatus(a.id, 'confirmed')} className="text-xs px-3 py-1 bg-teal-100 text-teal-700 rounded">Confirm</button>}
                    {['scheduled','confirmed'].includes(a.status) && <button onClick={() => updateApptStatus(a.id, 'checked_in')} className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded">Check In</button>}
                    {['confirmed','checked_in'].includes(a.status) && <button onClick={() => setCompleteAppt(a)} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded">Complete</button>}
                    {!['completed','cancelled','no_show'].includes(a.status) && <button onClick={() => updateApptStatus(a.id, 'cancelled')} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded">Cancel</button>}
                    {!['completed','cancelled','no_show'].includes(a.status) && <button onClick={() => updateApptStatus(a.id, 'no_show')} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded">No Show</button>}
                  </div>
                </div>
              ))}
              {!appointments.length && <p className="text-center text-gray-400 py-12">No appointments for this date.</p>}
            </div>
            {showAddAppt && <AddAppointmentModal patients={patients} owners={owners} onClose={() => setShowAddAppt(false)} onSaved={() => { setShowAddAppt(false); loadAppointments(); loadDash(); }} />}
            {completeAppt && <CompleteApptModal appt={completeAppt} onClose={() => setCompleteAppt(null)} onSaved={() => { setCompleteAppt(null); loadAppointments(); loadDash(); }} />}
          </div>
        )}

        {/* ── Vaccinations ── */}
        {tab === 'vaccinations' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Vaccinations</h2>
              <div className="flex rounded-lg border overflow-hidden text-sm">
                <button onClick={() => setVaccTab('history')} className={`px-4 py-1.5 ${vaccTab === 'history' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>History</button>
                <button onClick={() => setVaccTab('due')} className={`px-4 py-1.5 ${vaccTab === 'due' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}>Due Soon ({vaccDue.length})</button>
              </div>
              <button onClick={() => setShowAddVacc(true)} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium ml-auto">+ Add Vaccination</button>
            </div>
            {vaccTab === 'history' && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>{['Patient','Owner','Vaccine','Administered','Next Due','Administered By'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vaccinations.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{SPECIES_EMOJI[v.species]} {v.patient_name}</td>
                        <td className="px-4 py-3 text-gray-500">{v.owner_first} {v.owner_last}</td>
                        <td className="px-4 py-3"><Badge label={v.vaccine_name} color="teal" /></td>
                        <td className="px-4 py-3">{fmtDate(v.administered_date)}</td>
                        <td className="px-4 py-3">{v.next_due_date ? <span className={new Date(v.next_due_date) <= new Date(Date.now() + 30*864e5) ? 'text-amber-600 font-medium' : ''}>{fmtDate(v.next_due_date)}</span> : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{v.administered_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!vaccinations.length && <p className="text-center text-gray-400 py-8">No vaccination records.</p>}
              </div>
            )}
            {vaccTab === 'due' && (
              <div className="space-y-3">
                {vaccDue.map(v => (
                  <div key={v.id} className="bg-white rounded-xl border p-4 flex justify-between items-center">
                    <div><p className="font-semibold">{SPECIES_EMOJI[v.species]} {v.patient_name}</p><p className="text-sm text-gray-500">{v.vaccine_name} · Owner: {v.owner_first} {v.owner_last} · {v.owner_phone}</p></div>
                    <div className="text-right"><p className="text-sm font-medium text-amber-600">Due: {fmtDate(v.next_due_date)}</p><button className="text-xs text-blue-600 underline mt-1">Send Reminder</button></div>
                  </div>
                ))}
                {!vaccDue.length && <p className="text-center text-gray-400 py-12">No vaccinations due in the next 30 days.</p>}
              </div>
            )}
            {showAddVacc && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="font-bold mb-4">Record Vaccination</h3>
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addVaccForm.patient_id} onChange={e => setAddVaccForm(p => ({ ...p, patient_id: e.target.value }))}><option value="">— select —</option>{patients.map(p => <option key={p.id} value={p.id}>{SPECIES_EMOJI[p.species]} {p.name}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Vaccine *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="DHPP, Rabies, FVRCP…" value={addVaccForm.vaccine_name} onChange={e => setAddVaccForm(p => ({ ...p, vaccine_name: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Administered Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addVaccForm.administered_date} onChange={e => setAddVaccForm(p => ({ ...p, administered_date: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Next Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addVaccForm.next_due_date} onChange={e => setAddVaccForm(p => ({ ...p, next_due_date: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Administered By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addVaccForm.administered_by} onChange={e => setAddVaccForm(p => ({ ...p, administered_by: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Batch Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={addVaccForm.batch_number} onChange={e => setAddVaccForm(p => ({ ...p, batch_number: e.target.value }))} /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowAddVacc(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
                    <button onClick={addVaccination} className="px-4 py-2 rounded bg-teal-600 text-white text-sm">Record</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Prescriptions ── */}
        {tab === 'prescriptions' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Prescriptions</h2>
              <select className="border rounded px-2 py-1.5 text-sm" value={rxPatientId} onChange={e => setRxPatientId(e.target.value)}><option value="">All Patients</option>{patients.map(p => <option key={p.id} value={p.id}>{SPECIES_EMOJI[p.species]} {p.name}</option>)}</select>
              <button onClick={() => setShowAddRx(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium ml-auto">+ Add Prescription</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Patient','Medication','Dosage','Frequency','Duration','Refills','Dispensed','Action'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {prescriptions.map(rx => (
                    <tr key={rx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{SPECIES_EMOJI[rx.species]} {rx.patient_name}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{rx.medication_name}</td>
                      <td className="px-4 py-3 text-gray-600">{rx.dosage}</td>
                      <td className="px-4 py-3 text-gray-600">{rx.frequency}</td>
                      <td className="px-4 py-3">{rx.duration_days ? `${rx.duration_days}d` : '—'}</td>
                      <td className="px-4 py-3">{rx.refills_remaining}</td>
                      <td className="px-4 py-3">{rx.dispensed ? <Badge label="Dispensed" color="green" /> : <Badge label="Pending" color="amber" />}</td>
                      <td className="px-4 py-3">{!rx.dispensed && <button onClick={() => dispenseRx(rx.id)} className="text-xs text-blue-600 underline">Dispense</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!prescriptions.length && <p className="text-center text-gray-400 py-8">No prescriptions found.</p>}
            </div>
            {showAddRx && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="font-bold mb-4">Add Prescription</h3>
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addRxForm.patient_id} onChange={e => setAddRxForm(p => ({ ...p, patient_id: e.target.value }))}><option value="">— select —</option>{patients.map(p => <option key={p.id} value={p.id}>{SPECIES_EMOJI[p.species]} {p.name}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Medication *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addRxForm.medication_name} onChange={e => setAddRxForm(p => ({ ...p, medication_name: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Dosage *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. 250mg" value={addRxForm.dosage} onChange={e => setAddRxForm(p => ({ ...p, dosage: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Frequency *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. twice daily" value={addRxForm.frequency} onChange={e => setAddRxForm(p => ({ ...p, frequency: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500">Duration (days)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addRxForm.duration_days} onChange={e => setAddRxForm(p => ({ ...p, duration_days: e.target.value }))} /></div>
                      <div><label className="text-xs text-gray-500">Refills</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addRxForm.refills_remaining} onChange={e => setAddRxForm(p => ({ ...p, refills_remaining: e.target.value }))} /></div>
                    </div>
                    <div><label className="text-xs text-gray-500">Prescribed By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={addRxForm.prescribed_by} onChange={e => setAddRxForm(p => ({ ...p, prescribed_by: e.target.value }))} /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowAddRx(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
                    <button onClick={addPrescription} className="px-4 py-2 rounded bg-purple-600 text-white text-sm">Add Prescription</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Clinical Support ── */}
        {tab === 'ai-support' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-1">AI Clinical Decision Support</h2>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">This tool provides clinical decision support only. All outputs must be reviewed and confirmed by the attending veterinarian before any treatment is administered.</p>
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Select Patient (optional — auto-fills fields)</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.patient_id} onChange={e => {
                    const p = patients.find(x => x.id === parseInt(e.target.value));
                    setAiForm(prev => ({ ...prev, patient_id: e.target.value, species: p?.species || prev.species, breed: p?.breed || prev.breed, age: p?.age_years ? String(Math.round(p.age_years)) : prev.age, weight_kg: p?.weight_kg ? String(p.weight_kg) : prev.weight_kg, current_medications: p?.current_medications || prev.current_medications }));
                  }}>
                    <option value="">— or fill manually —</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{SPECIES_EMOJI[p.species]} {p.name} ({p.species})</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Species *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.species} onChange={e => setAiForm(p => ({ ...p, species: e.target.value }))}>{SPECIES_LIST.map(s => <option key={s} value={s}>{SPECIES_EMOJI[s]} {cap(s)}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Breed</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.breed} onChange={e => setAiForm(p => ({ ...p, breed: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Age (years)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.age} onChange={e => setAiForm(p => ({ ...p, age: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Weight (kg)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.weight_kg} onChange={e => setAiForm(p => ({ ...p, weight_kg: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Presenting Symptoms *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} placeholder="Describe symptoms, duration, onset…" value={aiForm.symptoms} onChange={e => setAiForm(p => ({ ...p, symptoms: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Current Medications</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.current_medications} onChange={e => setAiForm(p => ({ ...p, current_medications: e.target.value }))} /></div>
              </div>
              <button onClick={generateAiSupport} disabled={aiLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Clinical Notes'}</button>
              {aiOutput && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">{aiUsed ? 'Generated by Ollama llama3.2' : 'Generated with fallback template'}</p>
                  <textarea readOnly className="w-full border rounded p-3 text-sm font-mono bg-gray-50 h-96 resize-none" value={aiOutput} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
