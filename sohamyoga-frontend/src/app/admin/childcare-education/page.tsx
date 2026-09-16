'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'children', 'attendance', 'staff', 'reports', 'incidents', 'billing', 'waitlist'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', children: 'Children', attendance: 'Attendance',
  staff: 'Staff & Ratios', reports: 'Daily Reports', incidents: 'Incidents',
  billing: 'Billing', waitlist: 'Waitlist',
};

const AGE_GROUPS = ['infant', 'toddler', 'preschool', 'kindergarten', 'school_age'];
const AGE_GROUP_LABELS: Record<string, string> = { infant: 'Infant (<18mo)', toddler: 'Toddler (18mo-3yr)', preschool: 'Preschool (3-4yr)', kindergarten: 'Kindergarten (4-6yr)', school_age: 'School Age (6+)' };
const REQUIRED_RATIOS: Record<string, number> = { infant: 3, toddler: 4, preschool: 8, kindergarten: 15, school_age: 15 };
const CAPACITIES: Record<string, number> = { infant: 6, toddler: 8, preschool: 16, kindergarten: 20, school_age: 20 };
const INCIDENT_TYPES = ['injury', 'illness', 'behavioral', 'allergy_reaction', 'other'];
const MOODS = ['happy', 'calm', 'fussy', 'tired', 'excited'];
const ROLES = ['director', 'ecce_educator', 'ecce_assistant', 'aide', 'cook', 'admin'];

interface Child {
  id: number; name: string; date_of_birth: string; age_group: string; room_name: string;
  parent1_name: string; parent1_email: string; parent1_phone: string; parent2_name: string;
  allergies: string[]; authorized_pickups: string[];
  schedule: string; daily_rate: number; monthly_fee: number;
  subsidy_applied: boolean; subsidy_amount: number; cwelcc_enrolled: boolean;
  status: string; enrollment_date: string;
}
interface AttendanceRow {
  child_id: number; name: string; room_name: string; age_group: string;
  allergies: string[]; authorized_pickups: string[];
  parent1_name: string; parent1_phone: string;
  attendance_id: number | null; sign_in_time: string | null; sign_out_time: string | null;
  signed_in_by: string; present: boolean | null;
}
interface Staff {
  id: number; name: string; role: string; ecce_level: string; certification: string;
  employment_type: string; assigned_room: string; hourly_rate: number;
  first_aid_expiry: string; criminal_record_check_date: string; status: string;
}
interface RatioRow {
  age_group: string; room_name: string; child_count: number; staff_count: number;
  required_ratio: number; required_staff: number; compliant: boolean; ratio_string: string;
}
interface Incident {
  id: number; child_name: string; parent1_name: string; parent1_phone: string;
  incident_date: string; incident_time: string; type: string; description: string;
  action_taken: string; parent_notified: boolean; reported_by: string;
  requires_licensing_report: boolean;
}
interface BillingChild {
  id: number; name: string; age_group: string; monthly_fee: number;
  subsidy_amount: number; cwelcc_deduction: number; parent_responsibility: number;
  cwelcc_enrolled: boolean; subsidy_applied: boolean;
}
interface Dashboard {
  enrolled_by_age: Array<{ age_group: string; enrolled: number }>;
  attendance: { present_today: number };
  staff: { total_staff: number };
  incidents: { incidents_today: number };
  billing: { total_monthly_fees: number; total_subsidy: number; cwelcc_count: number };
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function ageInMonths(dob: string) { const d = new Date(dob); const now = new Date(); return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()); }
function ageLabel(dob: string) { const m = ageInMonths(dob); return m < 24 ? `${m}mo` : `${Math.floor(m/12)}y ${m%12}mo`; }

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

// ─── Add Child Modal (multi-step) ───────────────────────────────────────────
function AddChildModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', date_of_birth: '', age_group: 'toddler', room_name: 'Rainbow Room',
    parent1_name: '', parent1_email: '', parent1_phone: '', parent1_relation: 'Mother',
    parent2_name: '', parent2_email: '', parent2_phone: '', parent2_relation: '',
    allergies: '', medical_conditions: '', medications: '', immunization_up_to_date: 'true',
    schedule: 'full_time', daily_rate: '', monthly_fee: '',
    subsidy_applied: 'false', subsidy_amount: '', cwelcc_enrolled: 'false',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name || !form.date_of_birth) return;
    setSaving(true);
    try {
      await fetch('/api/admin/childcare-education/children', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
          medical_conditions: form.medical_conditions ? form.medical_conditions.split(',').map(s => s.trim()).filter(Boolean) : [],
          medications: form.medications ? form.medications.split(',').map(s => s.trim()).filter(Boolean) : [],
          immunization_up_to_date: form.immunization_up_to_date === 'true',
          subsidy_applied: form.subsidy_applied === 'true',
          cwelcc_enrolled: form.cwelcc_enrolled === 'true',
          daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
          monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : null,
          subsidy_amount: form.subsidy_amount ? parseFloat(form.subsidy_amount) : null,
          schedule_days: ['mon','tue','wed','thu','fri'],
        }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Enroll Child — Step {step}/3</h2>
          <div className="flex gap-1">{[1,2,3].map(s => <div key={s} className={`w-8 h-2 rounded ${s <= step ? 'bg-green-500' : 'bg-gray-200'}`} />)}</div>
        </div>
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Child's Full Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Age Group</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.age_group} onChange={e => f('age_group', e.target.value)}>{AGE_GROUPS.map(g => <option key={g} value={g}>{AGE_GROUP_LABELS[g]}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Room</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.room_name} onChange={e => f('room_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Schedule</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.schedule} onChange={e => f('schedule', e.target.value)}><option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="drop_in">Drop-In</option></select></div>
            <div><label className="text-xs text-gray-500">Allergies (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.allergies} onChange={e => f('allergies', e.target.value)} placeholder="Peanuts, Dairy" /></div>
            <div><label className="text-xs text-gray-500">Medical Conditions</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.medical_conditions} onChange={e => f('medical_conditions', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Immunization Up to Date</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.immunization_up_to_date} onChange={e => f('immunization_up_to_date', e.target.value)}><option value="true">Yes</option><option value="false">No</option></select></div>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 text-xs font-semibold text-gray-600 mt-1">Parent / Guardian 1</div>
            <div><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent1_name} onChange={e => f('parent1_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Relation</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent1_relation} onChange={e => f('parent1_relation', e.target.value)}>{['Mother','Father','Guardian','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent1_email} onChange={e => f('parent1_email', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent1_phone} onChange={e => f('parent1_phone', e.target.value)} /></div>
            <div className="col-span-2 text-xs font-semibold text-gray-600 mt-2">Parent / Guardian 2 (optional)</div>
            <div><label className="text-xs text-gray-500">Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent2_name} onChange={e => f('parent2_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent2_phone} onChange={e => f('parent2_phone', e.target.value)} /></div>
          </div>
        )}
        {step === 3 && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Daily Rate (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.daily_rate} onChange={e => f('daily_rate', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Monthly Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_fee} onChange={e => f('monthly_fee', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">AB Child Care Subsidy</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subsidy_applied} onChange={e => f('subsidy_applied', e.target.value)}><option value="false">Not Applied</option><option value="true">Approved</option></select></div>
            {form.subsidy_applied === 'true' && <div><label className="text-xs text-gray-500">Subsidy Amount (CAD/mo)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subsidy_amount} onChange={e => f('subsidy_amount', e.target.value)} /></div>}
            <div><label className="text-xs text-gray-500">CWELCC Enrolled ($10/day)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cwelcc_enrolled} onChange={e => f('cwelcc_enrolled', e.target.value)}><option value="false">No</option><option value="true">Yes</option></select></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
          </div>
        )}
        <div className="flex justify-between mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-1.5 rounded border text-sm text-gray-600">Back</button>}
            {step < 3 && <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50">Next</button>}
            {step === 3 && <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Enrolling…' : 'Enroll Child'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Incident Modal ─────────────────────────────────────────────────────
function NewIncidentModal({ children, onClose, onSaved }: { children: Child[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ child_id: '', incident_date: new Date().toISOString().split('T')[0], incident_time: new Date().toTimeString().slice(0,5), type: 'injury', description: '', action_taken: '', reported_by: '', witness: '', requires_licensing_report: 'false' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.child_id || !form.description) return;
    setSaving(true);
    try {
      await fetch('/api/admin/childcare-education/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, child_id: parseInt(form.child_id), requires_licensing_report: form.requires_licensing_report === 'true' }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Record Incident</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Child *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.child_id} onChange={e => f('child_id', e.target.value)}><option value="">Select child</option>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.incident_date} onChange={e => f('incident_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.incident_time} onChange={e => f('incident_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.type} onChange={e => f('type', e.target.value)}>{INCIDENT_TYPES.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Requires Licensing Report</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.requires_licensing_report} onChange={e => f('requires_licensing_report', e.target.value)}><option value="false">No</option><option value="true">Yes</option></select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Action Taken</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.action_taken} onChange={e => f('action_taken', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reported By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reported_by} onChange={e => f('reported_by', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Witness</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.witness} onChange={e => f('witness', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.child_id || !form.description} className="px-4 py-1.5 rounded bg-red-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Record Incident'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function ChildcareEducationPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [ratios, setRatios] = useState<RatioRow[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [billing, setBilling] = useState<{ children: BillingChild[]; summary: Record<string, number> } | null>(null);
  const [waitlist, setWaitlist] = useState<Child[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [childFilter, setChildFilter] = useState({ age_group: '', status: 'enrolled' });
  const [showAddChild, setShowAddChild] = useState(false);
  const [showNewIncident, setShowNewIncident] = useState(false);
  const [reportForm, setReportForm] = useState({ child_id: '', mood: 'happy', activities: '', notes: '', nap_start: '', nap_end: '', diaper_changes: '0', meal_breakfast: 'ate well', meal_snack: '', meal_lunch: '', created_by: '' });
  const [reportMsg, setReportMsg] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education');
    if (r.ok) setDashboard(await r.json());
  }, []);

  const loadChildren = useCallback(async () => {
    const params = new URLSearchParams();
    if (childFilter.age_group) params.set('age_group', childFilter.age_group);
    if (childFilter.status) params.set('status', childFilter.status);
    const r = await fetch(`/api/admin/childcare-education/children?${params}`);
    if (r.ok) setChildren(await r.json());
  }, [childFilter]);

  const loadAttendance = useCallback(async () => {
    const r = await fetch(`/api/admin/childcare-education/attendance?date=${attendanceDate}`);
    if (r.ok) setAttendance(await r.json());
  }, [attendanceDate]);

  const loadStaff = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education/staff');
    if (r.ok) setStaff(await r.json());
  }, []);

  const loadRatios = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education/ratios');
    if (r.ok) setRatios(await r.json());
  }, []);

  const loadIncidents = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education/incidents');
    if (r.ok) setIncidents(await r.json());
  }, []);

  const loadBilling = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education/billing');
    if (r.ok) setBilling(await r.json());
  }, []);

  const loadWaitlist = useCallback(async () => {
    const r = await fetch('/api/admin/childcare-education/waitlist');
    if (r.ok) setWaitlist(await r.json());
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'children') loadChildren(); }, [tab, loadChildren]);
  useEffect(() => { if (tab === 'attendance') loadAttendance(); }, [tab, attendanceDate, loadAttendance]);
  useEffect(() => { if (tab === 'staff') { loadStaff(); loadRatios(); } }, [tab, loadStaff, loadRatios]);
  useEffect(() => { if (tab === 'reports') loadChildren(); }, [tab, loadChildren]);
  useEffect(() => { if (tab === 'incidents') { loadIncidents(); loadChildren(); } }, [tab, loadIncidents, loadChildren]);
  useEffect(() => { if (tab === 'billing') loadBilling(); }, [tab, loadBilling]);
  useEffect(() => { if (tab === 'waitlist') loadWaitlist(); }, [tab, loadWaitlist]);

  async function signIn(childId: number) {
    await fetch(`/api/admin/childcare-education/attendance/${childId}/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    loadAttendance();
  }

  async function signOut(childId: number) {
    await fetch(`/api/admin/childcare-education/attendance/${childId}/sign-out`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    loadAttendance();
  }

  async function notifyParent(id: number) {
    await fetch(`/api/admin/childcare-education/incidents/${id}/notify`, { method: 'POST' });
    loadIncidents();
  }

  async function saveReport() {
    if (!reportForm.child_id) return;
    setReportLoading(true);
    setReportMsg('');
    try {
      const meals = { breakfast: reportForm.meal_breakfast, snack: reportForm.meal_snack, lunch: reportForm.meal_lunch };
      await fetch('/api/admin/childcare-education/daily-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: parseInt(reportForm.child_id), meals, mood: reportForm.mood, activities: reportForm.activities ? reportForm.activities.split(',').map(s => s.trim()) : [], nap_start: reportForm.nap_start || null, nap_end: reportForm.nap_end || null, diaper_changes: parseInt(reportForm.diaper_changes), notes: reportForm.notes, created_by: reportForm.created_by || 'Staff' }),
      });
      setReportMsg('Report saved!');
    } finally { setReportLoading(false); }
  }

  async function generateAiMessage() {
    if (!reportForm.child_id) return;
    const child = children.find(c => c.id === parseInt(reportForm.child_id));
    if (!child) return;
    setAiLoading(true); setAiMessage('');
    try {
      const r = await fetch('/api/admin/childcare-education/ai-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_name: child.name, mood: reportForm.mood, activities: reportForm.activities ? reportForm.activities.split(',').map(s => s.trim()) : [], meals: { breakfast: reportForm.meal_breakfast, snack: reportForm.meal_snack, lunch: reportForm.meal_lunch }, nap: reportForm.nap_start ? `${reportForm.nap_start}–${reportForm.nap_end}` : '', notes: reportForm.notes }),
      });
      const data = await r.json();
      setAiMessage(data.message ?? data.error ?? 'No response');
    } finally { setAiLoading(false); }
  }

  const rooms = [...new Set(children.map(c => c.room_name).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Childcare & Education Centre</h1>
        <p className="text-slate-400 text-sm">Alberta Licensed — Children · Attendance · Staff Ratios · Billing · CWELCC</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Present Today" value={dashboard.attendance.present_today ?? 0} color="green" />
              <KpiCard label="Total Staff" value={dashboard.staff.total_staff ?? 0} color="blue" />
              <KpiCard label="Incidents Today" value={dashboard.incidents.incidents_today ?? 0} color={parseInt(String(dashboard.incidents.incidents_today)) > 0 ? 'red' : 'green'} />
              <KpiCard label="CWELCC Enrolled" value={dashboard.billing.cwelcc_count ?? 0} sub="$10/day subsidy" color="teal" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Enrollment by Age Group</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {AGE_GROUPS.map(ag => {
                  const enrolled = dashboard.enrolled_by_age.find(r => r.age_group === ag)?.enrolled ?? 0;
                  const capacity = CAPACITIES[ag] ?? 20;
                  const pct = Math.min((parseInt(String(enrolled)) / capacity) * 100, 100);
                  return (
                    <div key={ag} className="bg-white rounded-lg p-4 border">
                      <p className="text-xs text-gray-500">{AGE_GROUP_LABELS[ag]}</p>
                      <p className="text-2xl font-bold mt-1">{enrolled}</p>
                      <p className="text-xs text-gray-400">/ {capacity} capacity</p>
                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Required ratio: 1:{REQUIRED_RATIOS[ag]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CHILDREN */}
        {tab === 'children' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm" value={childFilter.age_group} onChange={e => setChildFilter(p => ({ ...p, age_group: e.target.value }))}>
                <option value="">All Age Groups</option>
                {AGE_GROUPS.map(g => <option key={g} value={g}>{AGE_GROUP_LABELS[g]}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={childFilter.status} onChange={e => setChildFilter(p => ({ ...p, status: e.target.value }))}>
                <option value="enrolled">Enrolled</option>
                <option value="waitlist">Waitlist</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="">All</option>
              </select>
              <button onClick={loadChildren} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Filter</button>
              <button onClick={() => setShowAddChild(true)} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ Enroll Child</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Age','Room','Parent 1','Schedule','Monthly Fee','Subsidy','CWELCC','Status'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {children.map(c => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${c.allergies?.length > 0 ? 'border-l-2 border-red-400' : ''}`}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{c.name}</p>
                        {c.allergies?.length > 0 && <p className="text-xs text-red-600">⚠️ {c.allergies.join(', ')}</p>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{ageLabel(c.date_of_birth)}<br /><span className="text-gray-400">{AGE_GROUP_LABELS[c.age_group]?.split(' ')[0]}</span></td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{c.room_name || '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        <p>{c.parent1_name}</p>
                        <p className="text-gray-400">{c.parent1_phone}</p>
                      </td>
                      <td className="px-4 py-2"><Badge label={c.schedule?.replace('_', ' ')} color="blue" /></td>
                      <td className="px-4 py-2 font-medium">{c.monthly_fee ? fmtCad(c.monthly_fee) : '—'}</td>
                      <td className="px-4 py-2">{c.subsidy_applied ? <Badge label={fmtCad(c.subsidy_amount)} color="green" /> : <span className="text-xs text-gray-400">None</span>}</td>
                      <td className="px-4 py-2">{c.cwelcc_enrolled ? <Badge label="$10/day" color="teal" /> : '—'}</td>
                      <td className="px-4 py-2"><Badge label={c.status} color={c.status === 'enrolled' ? 'green' : c.status === 'waitlist' ? 'amber' : 'gray'} /></td>
                    </tr>
                  ))}
                  {children.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No children found.</td></tr>}
                </tbody>
              </table>
            </div>
            {showAddChild && <AddChildModal onClose={() => setShowAddChild(false)} onSaved={() => { setShowAddChild(false); loadChildren(); loadDashboard(); }} />}
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input type="date" className="border rounded px-3 py-2 text-sm" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
              <button onClick={loadAttendance} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Load</button>
              <div className="ml-auto text-sm text-gray-600">
                Present: <strong>{attendance.filter(a => a.present).length}</strong> / Total: <strong>{attendance.length}</strong>
              </div>
            </div>
            {rooms.map(room => {
              const roomKids = attendance.filter(a => a.room_name === room);
              if (!roomKids.length) return null;
              return (
                <div key={room} className="bg-white rounded-lg border overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                    <p className="font-medium text-gray-700">{room}</p>
                    <p className="text-xs text-gray-500">{roomKids.filter(k => k.present).length} present / {roomKids.length} enrolled</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b"><tr>{['Child','Age Group','Parent','Allergies','Sign In','Sign Out','Actions'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">
                      {roomKids.map(a => (
                        <tr key={a.child_id} className={`hover:bg-gray-50 ${a.allergies?.length > 0 ? 'border-l-2 border-red-400' : ''}`}>
                          <td className="px-4 py-2 font-medium">{a.name}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{AGE_GROUP_LABELS[a.age_group]?.split('(')[0]}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{a.parent1_name}<br />{a.parent1_phone}</td>
                          <td className="px-4 py-2">{a.allergies?.length > 0 ? <Badge label={a.allergies.join(', ')} color="red" /> : <span className="text-xs text-gray-400">None</span>}</td>
                          <td className="px-4 py-2 font-mono text-xs">{a.sign_in_time || '—'}</td>
                          <td className="px-4 py-2 font-mono text-xs">{a.sign_out_time || '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              {!a.sign_in_time && <button onClick={() => signIn(a.child_id)} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Sign In</button>}
                              {a.sign_in_time && !a.sign_out_time && <button onClick={() => signOut(a.child_id)} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Sign Out</button>}
                              {a.sign_out_time && <Badge label="Completed" color="gray" />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {attendance.length === 0 && <p className="text-center text-gray-400 py-12">No attendance data for this date.</p>}
          </div>
        )}

        {/* STAFF & RATIOS */}
        {tab === 'staff' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Staff:Child Ratio Compliance (Alberta)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ratios.map(r => (
                  <div key={r.room_name} className={`bg-white rounded-lg border-2 p-4 ${r.compliant ? 'border-green-200' : 'border-red-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-800">{r.room_name}</p>
                        <p className="text-xs text-gray-500">{AGE_GROUP_LABELS[r.age_group]}</p>
                      </div>
                      <Badge label={r.compliant ? 'Compliant' : 'Non-Compliant'} color={r.compliant ? 'green' : 'red'} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-400">Children</p><p className="font-bold text-lg">{r.child_count}</p></div>
                      <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-400">Staff</p><p className={`font-bold text-lg ${r.compliant ? 'text-green-600' : 'text-red-600'}`}>{r.staff_count}</p></div>
                      <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-400">Required</p><p className="font-bold text-lg">{r.required_staff}</p></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">AB ratio: {r.ratio_string}</p>
                  </div>
                ))}
                {ratios.length === 0 && <p className="text-gray-400 col-span-3">No ratio data available.</p>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Staff Directory</h3>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Name','Role','ECCE Level','Room','Employment','Hourly Rate','First Aid Expiry','CRC Date','Status'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {staff.map(s => {
                      const firstAidExpiry = s.first_aid_expiry ? new Date(s.first_aid_expiry) : null;
                      const firstAidExpired = firstAidExpiry && firstAidExpiry < new Date();
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{s.name}</td>
                          <td className="px-4 py-2 text-xs">{s.role?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2"><Badge label={s.ecce_level || 'N/A'} color="blue" /></td>
                          <td className="px-4 py-2 text-gray-500">{s.assigned_room || '—'}</td>
                          <td className="px-4 py-2 text-xs">{s.employment_type?.replace('_', ' ')}</td>
                          <td className="px-4 py-2">{s.hourly_rate ? `$${s.hourly_rate}/hr` : '—'}</td>
                          <td className="px-4 py-2">{firstAidExpiry ? <span className={firstAidExpired ? 'text-red-600 font-medium' : 'text-gray-500'}>{fmtDate(s.first_aid_expiry)}{firstAidExpired ? ' ⚠️' : ''}</span> : '—'}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{s.criminal_record_check_date ? fmtDate(s.criminal_record_check_date) : '—'}</td>
                          <td className="px-4 py-2"><Badge label={s.status} color={s.status === 'active' ? 'green' : 'gray'} /></td>
                        </tr>
                      );
                    })}
                    {staff.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No staff found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DAILY REPORTS */}
        {tab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Create Daily Report</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Child *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.child_id} onChange={e => setReportForm(p => ({ ...p, child_id: e.target.value }))}><option value="">Select child</option>{children.filter(c => c.status === 'enrolled').map(c => <option key={c.id} value={c.id}>{c.name} — {c.room_name}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Mood</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.mood} onChange={e => setReportForm(p => ({ ...p, mood: e.target.value }))}>{MOODS.map(m => <option key={m}>{m}</option>)}</select></div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Meals</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['meal_breakfast','Breakfast'],['meal_snack','Snack'],['meal_lunch','Lunch']].map(([k, label]) => (
                      <div key={k}><label className="text-xs text-gray-500">{label}</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm[k as keyof typeof reportForm]} onChange={e => setReportForm(p => ({ ...p, [k]: e.target.value }))}>{['ate well','ate some','didn\'t eat','not offered','half','all'].map(v => <option key={v}>{v}</option>)}</select></div>
                    ))}
                  </div>
                </div>
                <div><label className="text-xs text-gray-500">Nap Start</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.nap_start} onChange={e => setReportForm(p => ({ ...p, nap_start: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Nap End</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.nap_end} onChange={e => setReportForm(p => ({ ...p, nap_end: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Diaper Changes</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.diaper_changes} onChange={e => setReportForm(p => ({ ...p, diaper_changes: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Staff Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.created_by} onChange={e => setReportForm(p => ({ ...p, created_by: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Activities (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.activities} onChange={e => setReportForm(p => ({ ...p, activities: e.target.value }))} placeholder="painting, circle time, outdoor play" /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Notes for Parents</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={reportForm.notes} onChange={e => setReportForm(p => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveReport} disabled={reportLoading || !reportForm.child_id} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50">{reportLoading ? 'Saving…' : 'Save Report'}</button>
                <button onClick={generateAiMessage} disabled={aiLoading || !reportForm.child_id} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading ? 'Generating…' : 'AI Generate Parent Message'}</button>
                {reportMsg && <span className="text-green-600 text-sm self-center">{reportMsg}</span>}
              </div>
              {aiMessage && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">AI-Generated Parent Message:</p>
                  <pre className="p-4 bg-purple-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-sans border border-purple-100">{aiMessage}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INCIDENTS */}
        {tab === 'incidents' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <h2 className="font-semibold text-slate-800">Incident Log</h2>
              <button onClick={() => setShowNewIncident(true)} className="ml-auto px-4 py-2 bg-red-600 text-white rounded text-sm font-medium">+ Record Incident</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Child','Date/Time','Type','Description','Action Taken','Parent Notified','Licensing Report','Actions'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {incidents.map(i => (
                    <tr key={i.id} className={`hover:bg-gray-50 ${i.requires_licensing_report ? 'border-l-2 border-red-500' : ''}`}>
                      <td className="px-4 py-2 font-medium">{i.child_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(i.incident_date)}<br />{i.incident_time}</td>
                      <td className="px-4 py-2"><Badge label={i.type?.replace(/_/g, ' ')} color={i.type === 'injury' ? 'red' : i.type === 'allergy_reaction' ? 'orange' : 'amber'} /></td>
                      <td className="px-4 py-2 text-xs max-w-xs truncate">{i.description}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{i.action_taken || '—'}</td>
                      <td className="px-4 py-2">{i.parent_notified ? <Badge label="Notified" color="green" /> : <Badge label="Pending" color="amber" />}</td>
                      <td className="px-4 py-2">{i.requires_licensing_report ? <Badge label="Required" color="red" /> : '—'}</td>
                      <td className="px-4 py-2">
                        {!i.parent_notified && <button onClick={() => notifyParent(i.id)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Notify Parent</button>}
                      </td>
                    </tr>
                  ))}
                  {incidents.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No incidents recorded.</td></tr>}
                </tbody>
              </table>
            </div>
            {showNewIncident && <NewIncidentModal children={children} onClose={() => setShowNewIncident(false)} onSaved={() => { setShowNewIncident(false); loadIncidents(); }} />}
          </div>
        )}

        {/* BILLING */}
        {tab === 'billing' && billing && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Gross Monthly Fees" value={fmtCad(billing.summary.total_monthly_fees)} color="blue" />
              <KpiCard label="AB Child Care Subsidy" value={fmtCad(billing.summary.total_subsidy)} sub={`${billing.summary.subsidy_count} families`} color="green" />
              <KpiCard label="CWELCC Deduction" value={fmtCad(billing.summary.total_cwelcc)} sub={`${billing.summary.cwelcc_count} enrolled`} color="teal" />
              <KpiCard label="Parent Responsibility" value={fmtCad(billing.summary.total_parent_responsibility)} color="purple" />
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Child','Age Group','Monthly Fee','AB Subsidy','CWELCC','Parent Owes','Programs'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {billing.children.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{AGE_GROUP_LABELS[c.age_group]?.split('(')[0]}</td>
                      <td className="px-4 py-2 font-medium">{fmtCad(c.monthly_fee)}</td>
                      <td className="px-4 py-2 text-green-700">{c.subsidy_applied ? fmtCad(c.subsidy_amount) : '—'}</td>
                      <td className="px-4 py-2 text-teal-700">{c.cwelcc_enrolled ? fmtCad(c.cwelcc_deduction) : '—'}</td>
                      <td className="px-4 py-2 font-bold text-slate-800">{fmtCad(c.parent_responsibility)}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {c.subsidy_applied && <Badge label="Subsidy" color="green" />}
                          {c.cwelcc_enrolled && <Badge label="CWELCC" color="teal" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {billing.children.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No billing data.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-medium text-amber-800">CWELCC $10/day Program</p>
              <p className="text-sm text-amber-700 mt-1">Estimated at 22 working days/month = {fmtCad(220)} deduction per enrolled child. {billing.summary.cwelcc_count} children enrolled.</p>
            </div>
          </div>
        )}

        {/* WAITLIST */}
        {tab === 'waitlist' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <h2 className="font-semibold text-slate-800">Waitlist ({waitlist.length})</h2>
            </div>
            {waitlist.length === 0 ? (
              <p className="text-gray-400 text-center py-12">No children on waitlist.</p>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Child','Age Group','Parent','Contact','Date Added','Days Waiting','Actions'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {waitlist.map((c: Child & { days_on_waitlist?: number }) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2 text-xs">{AGE_GROUP_LABELS[c.age_group]?.split('(')[0] || c.age_group}</td>
                        <td className="px-4 py-2">{c.parent1_name}</td>
                        <td className="px-4 py-2 text-gray-500">{c.parent1_phone || c.parent1_email}</td>
                        <td className="px-4 py-2 text-gray-500">{fmtDate(c.enrollment_date)}</td>
                        <td className="px-4 py-2"><Badge label={`${(c as Child & { days_on_waitlist?: number }).days_on_waitlist ?? 0}d`} color="amber" /></td>
                        <td className="px-4 py-2">
                          <button onClick={async () => { await fetch(`/api/admin/childcare-education/children/${c.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status:'enrolled'}) }); loadWaitlist(); loadDashboard(); }} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Offer Enrollment</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Estimated Availability by Age Group</h3>
              <div className="grid grid-cols-3 gap-3">
                {AGE_GROUPS.slice(0, 3).map(ag => {
                  const enrolled = children.filter(c => c.age_group === ag && c.status === 'enrolled').length;
                  const capacity = CAPACITIES[ag];
                  const available = Math.max(0, capacity - enrolled);
                  return (
                    <div key={ag} className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{AGE_GROUP_LABELS[ag]?.split(' ')[0]}</p>
                      <p className={`text-xl font-bold mt-1 ${available > 0 ? 'text-green-600' : 'text-red-600'}`}>{available}</p>
                      <p className="text-xs text-gray-400">spots available</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
