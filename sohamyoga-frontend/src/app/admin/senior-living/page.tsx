'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'residents', 'assessments', 'incidents', 'medications', 'staff', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', residents: 'Residents', assessments: 'Care Assessments',
  incidents: 'Incidents', medications: 'Medications', staff: 'Staff', ai: 'AI Tools',
};

const UNITS = ['independent', 'assisted', 'memory_care', 'long_term'];
const CARE_LEVELS = [1, 2, 3, 4, 5];
const FUNDING_TYPES = ['private', 'ahs', 'veterans', 'aish'];
const INCIDENT_TYPES = ['fall', 'medication_error', 'behavioral', 'elopement', 'injury', 'other'];
const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'];
const ASSESSMENT_TYPES = ['RAI-MDS', 'fall_risk', 'skin', 'nutrition', 'cognitive', 'pain'];
const STAFF_ROLES = ['RN', 'LPN', 'HCA', 'dietary', 'housekeeping', 'admin', 'activity'];
const SHIFTS = ['day', 'evening', 'night'];
const MED_ROUTES = ['oral', 'topical', 'inhaled', 'injection', 'sublingual'];

interface Resident { id: number; first_name: string; last_name: string; full_name: string; date_of_birth: string; admission_date: string; room_number: string; unit: string; care_level: number; primary_diagnosis: string; secondary_diagnoses: string[]; emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_relation: string; physician_name: string; dnr_status: boolean; aish_recipient: boolean; funding_type: string; daily_rate: number; status: string; notes: string; }
interface Assessment { id: number; resident_id: number; resident_name: string; room_number: string; assessment_type: string; assessed_by: string; assessment_date: string; score: number; risk_level: string; recommendations: string[]; next_assessment_due: string; }
interface Incident { id: number; resident_id: number; resident_name: string; room_number: string; incident_type: string; severity: string; occurred_at: string; location: string; description: string; immediate_action: string; physician_notified: boolean; family_notified: boolean; ahs_reportable: boolean; outcome: string; staff_name: string; }
interface Medication { id: number; resident_id: number; resident_name: string; room_number: string; drug_name: string; dosage: string; route: string; frequency: string; times_of_day: string[]; prescribing_physician: string; controlled_substance: boolean; pharmacy_name: string; is_active: boolean; }
interface StaffMember { id: number; name: string; role: string; certification_number: string; certification_expiry: string; shift: string; status: string; vulnerable_sector_check_date: string; is_active: boolean; }
interface Dashboard { total_residents: number; active_residents: number; avg_occupancy_pct: number; unit_counts: Record<string, number>; staff_on_shift: number; total_staff: number; incident_reports_mtd: number; serious_incidents_mtd: number; medication_rounds_today: number; pending_assessments: number; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDt(d: string) { return d ? new Date(d).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
function fmtCad(n: number) { return n ? `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
function age(dob: string) { if (!dob) return '—'; const d = new Date(dob); const now = new Date(); return `${Math.floor((now.getTime() - d.getTime()) / 31557600000)}`; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-800', rose: 'bg-rose-100 text-rose-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function unitColor(u: string) {
  const m: Record<string, string> = { independent: 'green', assisted: 'blue', memory_care: 'purple', long_term: 'amber' };
  return m[u] ?? 'gray';
}
function severityColor(s: string) {
  const m: Record<string, string> = { minor: 'green', moderate: 'amber', serious: 'orange', critical: 'red' };
  return m[s] ?? 'gray';
}
function riskColor(r: string) {
  const m: Record<string, string> = { low: 'green', medium: 'amber', high: 'red' };
  return m[r] ?? 'gray';
}
function shiftColor(s: string) {
  const m: Record<string, string> = { day: 'blue', evening: 'amber', night: 'purple' };
  return m[s] ?? 'gray';
}
function staffStatusColor(s: string) {
  const m: Record<string, string> = { on_duty: 'green', off_duty: 'gray', on_leave: 'amber' };
  return m[s] ?? 'gray';
}
function careLevelColor(l: number) {
  const m: Record<number, string> = { 1: 'green', 2: 'teal', 3: 'blue', 4: 'amber', 5: 'red' };
  return m[l] ?? 'gray';
}

// ─── Add Resident Modal ────────────────────────────────────────────────────────
function AddResidentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', admission_date: new Date().toISOString().slice(0, 10), room_number: '', unit: 'assisted', care_level: 3, primary_diagnosis: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '', physician_name: '', dnr_status: false, aish_recipient: false, funding_type: 'private', daily_rate: '', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-living/residents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, care_level: Number(form.care_level), daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Resident Admission</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Admission Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.admission_date} onChange={e => f('admission_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Room Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.room_number} onChange={e => f('room_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Unit</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.unit} onChange={e => f('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Care Level (1–5)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.care_level} onChange={e => f('care_level', parseInt(e.target.value, 10))}>{CARE_LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Funding Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.funding_type} onChange={e => f('funding_type', e.target.value)}>{FUNDING_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_diagnosis} onChange={e => f('primary_diagnosis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Physician Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.physician_name} onChange={e => f('physician_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Daily Rate (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.daily_rate} onChange={e => f('daily_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Contact Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_name} onChange={e => f('emergency_contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Contact Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_phone} onChange={e => f('emergency_contact_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Relation</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_relation} onChange={e => f('emergency_contact_relation', e.target.value)} /></div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={form.dnr_status} onChange={e => f('dnr_status', e.target.checked)} /><span className="font-medium text-red-700">DNR</span></label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={form.aish_recipient} onChange={e => f('aish_recipient', e.target.checked)} /><span>AISH Recipient</span></label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.first_name || !form.last_name} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Admit Resident'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Incident Modal ────────────────────────────────────────────────────────
function AddIncidentModal({ residents, onClose, onSaved }: { residents: Resident[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ resident_id: '', incident_type: 'fall', severity: 'minor', occurred_at: new Date().toISOString().slice(0, 16), location: '', witnessed_by: '', description: '', immediate_action: '', physician_notified: false, family_notified: false, ahs_reportable: false, staff_name: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.resident_id || !form.description) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-living/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, resident_id: parseInt(form.resident_id, 10), occurred_at: new Date(form.occurred_at).toISOString() }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Log Incident</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Resident *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.resident_id} onChange={e => f('resident_id', e.target.value)}><option value="">Select resident…</option>{residents.map(r => <option key={r.id} value={r.id}>{r.full_name} — Room {r.room_number}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Incident Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.incident_type} onChange={e => f('incident_type', e.target.value)}>{INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Severity</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.severity} onChange={e => f('severity', e.target.value)}>{SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Date & Time</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.occurred_at} onChange={e => f('occurred_at', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e => f('location', e.target.value)} placeholder="e.g. Room 101A bathroom" /></div>
          <div><label className="text-xs text-gray-500">Staff Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.staff_name} onChange={e => f('staff_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Witnessed By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.witnessed_by} onChange={e => f('witnessed_by', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Immediate Action Taken</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.immediate_action} onChange={e => f('immediate_action', e.target.value)} /></div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={form.physician_notified} onChange={e => f('physician_notified', e.target.checked)} />Physician Notified</label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={form.family_notified} onChange={e => f('family_notified', e.target.checked)} />Family Notified</label>
            <label className="flex items-center gap-1.5 text-sm font-medium text-red-700 cursor-pointer"><input type="checkbox" checked={form.ahs_reportable} onChange={e => f('ahs_reportable', e.target.checked)} />AHS Reportable</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.resident_id || !form.description} className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving…' : 'Log Incident'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Staff Modal ───────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', role: 'HCA', certification_number: '', certification_expiry: '', shift: 'day', status: 'off_duty', vulnerable_sector_check_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name || !form.role) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-living/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, certification_expiry: form.certification_expiry || null, vulnerable_sector_check_date: form.vulnerable_sector_check_date || null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Staff Member</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Full Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Role</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.role} onChange={e => f('role', e.target.value)}>{STAFF_ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Shift</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shift} onChange={e => f('shift', e.target.value)}>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Certification #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.certification_number} onChange={e => f('certification_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Certification Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.certification_expiry} onChange={e => f('certification_expiry', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Vulnerable Sector Check Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vulnerable_sector_check_date} onChange={e => f('vulnerable_sector_check_date', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Staff'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Administer Medication Modal ───────────────────────────────────────────────
function AdministerModal({ med, onClose, onSaved }: { med: Medication; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ administered_by: '', dose_given: med.dosage || '', refused: false, refused_reason: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.administered_by) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/senior-living/medications/${med.id}/administer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, administered_at: new Date().toISOString() }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Administer Medication</h2>
        <p className="text-sm text-gray-500 mb-4">{med.drug_name} {med.dosage} — {med.resident_name}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Administered By *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.administered_by} onChange={e => f('administered_by', e.target.value)} placeholder="Staff name" /></div>
          <div><label className="text-xs text-gray-500">Dose Given</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.dose_given} onChange={e => f('dose_given', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.refused} onChange={e => f('refused', e.target.checked)} /><span className="text-red-600 font-medium">Resident Refused</span></label>
          {form.refused && <div><label className="text-xs text-gray-500">Refusal Reason</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.refused_reason} onChange={e => f('refused_reason', e.target.value)} /></div>}
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.administered_by} className="px-4 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Record Administration'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SeniorLivingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);
  const [showAddIncident, setShowAddIncident] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [adminMed, setAdminMed] = useState<Medication | null>(null);
  const [residentSearch, setResidentSearch] = useState('');
  const [residentUnit, setResidentUnit] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState('');
  const [staffShift, setStaffShift] = useState('');
  const [aiTab, setAiTab] = useState<'care-plan' | 'incident'>('care-plan');
  const [aiInput, setAiInput] = useState({ resident_name: '', diagnoses: '', care_level: '3', unit: 'assisted', incident_type: 'fall', severity: 'minor', occurred_at: '', location: '', description: '', immediate_action: '', staff_name: '', ahs_reportable: false });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDash = useCallback(async () => {
    const r = await fetch('/api/admin/senior-living');
    if (r.ok) setDash(await r.json());
  }, []);

  const loadResidents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (residentSearch) params.set('search', residentSearch);
    if (residentUnit) params.set('unit', residentUnit);
    const r = await fetch(`/api/admin/senior-living/residents?${params}`);
    if (r.ok) setResidents(await r.json());
    setLoading(false);
  }, [residentSearch, residentUnit]);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/senior-living/care-assessments');
    if (r.ok) setAssessments(await r.json());
    setLoading(false);
  }, []);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (incidentSeverity) params.set('severity', incidentSeverity);
    const r = await fetch(`/api/admin/senior-living/incidents?${params}`);
    if (r.ok) setIncidents(await r.json());
    setLoading(false);
  }, [incidentSeverity]);

  const loadMedications = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/senior-living/medications?status=active');
    if (r.ok) setMedications(await r.json());
    setLoading(false);
  }, []);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (staffShift) params.set('shift', staffShift);
    const r = await fetch(`/api/admin/senior-living/staff?${params}`);
    if (r.ok) setStaff(await r.json());
    setLoading(false);
  }, [staffShift]);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => {
    if (tab === 'residents') loadResidents();
    else if (tab === 'assessments') loadAssessments();
    else if (tab === 'incidents') loadIncidents();
    else if (tab === 'medications') loadMedications();
    else if (tab === 'staff') loadStaff();
  }, [tab, loadResidents, loadAssessments, loadIncidents, loadMedications, loadStaff]);

  async function runAi() {
    setAiLoading(true); setAiResult('');
    try {
      if (aiTab === 'care-plan') {
        const r = await fetch('/api/admin/senior-living/ai-care-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resident_name: aiInput.resident_name, diagnoses: aiInput.diagnoses.split(',').map(s => s.trim()).filter(Boolean), care_level: parseInt(aiInput.care_level, 10), unit: aiInput.unit }) });
        const d = await r.json() as { care_plan?: string; error?: string };
        setAiResult(d.care_plan || d.error || 'No response');
      } else {
        const r = await fetch('/api/admin/senior-living/ai-incident-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resident_name: aiInput.resident_name, incident_type: aiInput.incident_type, severity: aiInput.severity, occurred_at: aiInput.occurred_at, location: aiInput.location, description: aiInput.description, immediate_action: aiInput.immediate_action, staff_name: aiInput.staff_name, ahs_reportable: aiInput.ahs_reportable }) });
        const d = await r.json() as { incident_report?: string; error?: string };
        setAiResult(d.incident_report || d.error || 'No response');
      }
    } finally { setAiLoading(false); }
  }

  const aif = (k: string, v: unknown) => setAiInput(p => ({ ...p, [k]: v }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">Senior Living & Assisted Care</h1>
          <p className="text-slate-300 text-sm mt-0.5">AHS Continuing Care · CCHSS Standards · Alberta</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Active Residents" value={dash.active_residents} sub={`of ${dash.total_residents} total`} color="blue" />
              <KpiCard label="Occupancy" value={`${dash.avg_occupancy_pct}%`} sub="all units" color={dash.avg_occupancy_pct > 90 ? 'amber' : 'green'} />
              <KpiCard label="Staff On Shift" value={dash.staff_on_shift} sub={`of ${dash.total_staff} active`} color="teal" />
              <KpiCard label="Incidents MTD" value={dash.incident_reports_mtd} sub={`${dash.serious_incidents_mtd} serious/critical`} color={dash.serious_incidents_mtd > 0 ? 'red' : 'green'} />
              <KpiCard label="Med Rounds Today" value={dash.medication_rounds_today} color="purple" />
              <KpiCard label="Assessments Due" value={dash.pending_assessments} color={dash.pending_assessments > 0 ? 'amber' : 'green'} />
            </div>
            {/* Unit breakdown */}
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Unit Occupancy</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['independent', 20], ['assisted', 40], ['memory_care', 20], ['long_term', 30]].map(([u, cap]) => {
                  const count = dash.unit_counts[u as string] ?? 0;
                  const pct = Math.round((count / (cap as number)) * 100);
                  return (
                    <div key={u} className="text-center">
                      <Badge label={(u as string).replace('_', ' ')} color={unitColor(u as string)} />
                      <div className="mt-2 text-2xl font-bold">{count}<span className="text-sm text-gray-400">/{cap}</span></div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{pct}% full</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {dash.pending_assessments > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center gap-3">
                <span className="text-amber-600 text-xl">⚠</span>
                <div>
                  <p className="font-medium text-amber-800">{dash.pending_assessments} care assessment{dash.pending_assessments > 1 ? 's' : ''} overdue</p>
                  <p className="text-sm text-amber-700">Review the Care Assessments tab and schedule urgent RAI-MDS and fall-risk reviews.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESIDENTS */}
        {tab === 'residents' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <input className="border rounded px-3 py-1.5 text-sm w-56" placeholder="Search name, room, diagnosis…" value={residentSearch} onChange={e => { setResidentSearch(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') loadResidents(); }} />
              <select className="border rounded px-3 py-1.5 text-sm" value={residentUnit} onChange={e => { setResidentUnit(e.target.value); }}>
                <option value="">All Units</option>
                {UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
              </select>
              <button onClick={loadResidents} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Filter</button>
              <div className="ml-auto">
                <button onClick={() => setShowAddResident(true)} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Admit Resident</button>
              </div>
            </div>
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <div className="overflow-x-auto bg-white rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Resident</th>
                      <th className="px-4 py-3 text-left">Age</th>
                      <th className="px-4 py-3 text-left">Room</th>
                      <th className="px-4 py-3 text-left">Unit</th>
                      <th className="px-4 py-3 text-left">Level</th>
                      <th className="px-4 py-3 text-left">Diagnosis</th>
                      <th className="px-4 py-3 text-left">Funding</th>
                      <th className="px-4 py-3 text-left">Flags</th>
                      <th className="px-4 py-3 text-left">Daily Rate</th>
                      <th className="px-4 py-3 text-left">Physician</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {residents.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.full_name}</td>
                        <td className="px-4 py-3 text-gray-600">{age(r.date_of_birth)}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{r.room_number || '—'}</td>
                        <td className="px-4 py-3"><Badge label={r.unit.replace('_', ' ')} color={unitColor(r.unit)} /></td>
                        <td className="px-4 py-3"><Badge label={`Lvl ${r.care_level}`} color={careLevelColor(r.care_level)} /></td>
                        <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{r.primary_diagnosis || '—'}</td>
                        <td className="px-4 py-3"><Badge label={r.funding_type.toUpperCase()} color={r.funding_type === 'aish' ? 'purple' : r.funding_type === 'veterans' ? 'teal' : r.funding_type === 'ahs' ? 'blue' : 'gray'} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {r.dnr_status && <Badge label="DNR" color="red" />}
                            {r.aish_recipient && <Badge label="AISH" color="purple" />}
                            {r.unit === 'memory_care' && <Badge label="Memory" color="purple" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{fmtCad(r.daily_rate)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{r.physician_name || '—'}</td>
                      </tr>
                    ))}
                    {residents.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No residents found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {showAddResident && <AddResidentModal onClose={() => setShowAddResident(false)} onSaved={() => { setShowAddResident(false); loadResidents(); loadDash(); }} />}
          </div>
        )}

        {/* CARE ASSESSMENTS */}
        {tab === 'assessments' && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Care Assessments</h2>
            </div>
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <div className="overflow-x-auto bg-white rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Resident</th>
                      <th className="px-4 py-3 text-left">Room</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Risk</th>
                      <th className="px-4 py-3 text-left">Assessed By</th>
                      <th className="px-4 py-3 text-left">Next Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assessments.map(a => {
                      const isOverdue = a.next_assessment_due && new Date(a.next_assessment_due) < new Date();
                      return (
                        <tr key={a.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 font-medium">{a.resident_name}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{a.room_number}</td>
                          <td className="px-4 py-3"><Badge label={a.assessment_type} color="blue" /></td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(a.assessment_date)}</td>
                          <td className="px-4 py-3 font-medium">{a.score ?? '—'}</td>
                          <td className="px-4 py-3"><Badge label={a.risk_level || '—'} color={riskColor(a.risk_level)} /></td>
                          <td className="px-4 py-3 text-gray-600">{a.assessed_by}</td>
                          <td className="px-4 py-3">
                            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}>{fmtDate(a.next_assessment_due)}{isOverdue && ' ⚠ OVERDUE'}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {assessments.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No assessments recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* INCIDENTS */}
        {tab === 'incidents' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <select className="border rounded px-3 py-1.5 text-sm" value={incidentSeverity} onChange={e => setIncidentSeverity(e.target.value)}>
                <option value="">All Severities</option>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadIncidents} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Filter</button>
              <div className="ml-auto">
                <button onClick={() => setShowAddIncident(true)} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">+ Log Incident</button>
              </div>
            </div>
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <div className="overflow-x-auto bg-white rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Resident</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Severity</th>
                      <th className="px-4 py-3 text-left">When</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Staff</th>
                      <th className="px-4 py-3 text-left">Notifications</th>
                      <th className="px-4 py-3 text-left">AHS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {incidents.map(inc => (
                      <tr key={inc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{inc.resident_name}</td>
                        <td className="px-4 py-3"><Badge label={inc.incident_type.replace('_', ' ')} color="blue" /></td>
                        <td className="px-4 py-3"><Badge label={inc.severity} color={severityColor(inc.severity)} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{fmtDt(inc.occurred_at)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{inc.location || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{inc.staff_name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {inc.physician_notified && <Badge label="MD" color="teal" />}
                            {inc.family_notified && <Badge label="Family" color="green" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">{inc.ahs_reportable ? <Badge label="AHS Required" color="red" /> : <span className="text-gray-400 text-xs">—</span>}</td>
                      </tr>
                    ))}
                    {incidents.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No incidents recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {showAddIncident && <AddIncidentModal residents={residents.length ? residents : []} onClose={() => setShowAddIncident(false)} onSaved={() => { setShowAddIncident(false); loadIncidents(); loadDash(); }} />}
          </div>
        )}

        {/* MEDICATIONS */}
        {tab === 'medications' && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Active Medications</h2>
            </div>
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <div className="overflow-x-auto bg-white rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Resident</th>
                      <th className="px-4 py-3 text-left">Room</th>
                      <th className="px-4 py-3 text-left">Drug</th>
                      <th className="px-4 py-3 text-left">Dosage</th>
                      <th className="px-4 py-3 text-left">Route</th>
                      <th className="px-4 py-3 text-left">Frequency</th>
                      <th className="px-4 py-3 text-left">Times</th>
                      <th className="px-4 py-3 text-left">Flags</th>
                      <th className="px-4 py-3 text-left">Physician</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {medications.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{m.resident_name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{m.room_number}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{m.drug_name}</td>
                        <td className="px-4 py-3 text-gray-600">{m.dosage || '—'}</td>
                        <td className="px-4 py-3"><Badge label={m.route} color="gray" /></td>
                        <td className="px-4 py-3 text-gray-600">{m.frequency || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{(m.times_of_day || []).join(', ') || '—'}</td>
                        <td className="px-4 py-3">{m.controlled_substance && <Badge label="Controlled" color="red" />}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{m.prescribing_physician || '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setAdminMed(m)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Administer</button>
                        </td>
                      </tr>
                    ))}
                    {medications.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No active medications</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {adminMed && <AdministerModal med={adminMed} onClose={() => setAdminMed(null)} onSaved={() => { setAdminMed(null); loadMedications(); }} />}
          </div>
        )}

        {/* STAFF */}
        {tab === 'staff' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <select className="border rounded px-3 py-1.5 text-sm" value={staffShift} onChange={e => setStaffShift(e.target.value)}>
                <option value="">All Shifts</option>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadStaff} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Filter</button>
              <div className="ml-auto">
                <button onClick={() => setShowAddStaff(true)} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Add Staff</button>
              </div>
            </div>
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <div className="overflow-x-auto bg-white rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Shift</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Certification #</th>
                      <th className="px-4 py-3 text-left">Cert Expiry</th>
                      <th className="px-4 py-3 text-left">VS Check Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staff.map(s => {
                      const certExpiring = s.certification_expiry && new Date(s.certification_expiry) < new Date(Date.now() + 90 * 86400000);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3"><Badge label={s.role} color={s.role === 'RN' ? 'blue' : s.role === 'LPN' ? 'teal' : 'gray'} /></td>
                          <td className="px-4 py-3"><Badge label={s.shift} color={shiftColor(s.shift)} /></td>
                          <td className="px-4 py-3"><Badge label={s.status.replace('_', ' ')} color={staffStatusColor(s.status)} /></td>
                          <td className="px-4 py-3 font-mono text-gray-600 text-xs">{s.certification_number || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={certExpiring ? 'text-red-600 font-semibold' : 'text-gray-600'}>{fmtDate(s.certification_expiry)}{certExpiring && ' ⚠'}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(s.vulnerable_sector_check_date)}</td>
                        </tr>
                      );
                    })}
                    {staff.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No staff found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {showAddStaff && <AddStaffModal onClose={() => setShowAddStaff(false)} onSaved={() => { setShowAddStaff(false); loadStaff(); loadDash(); }} />}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex gap-2">
              <button onClick={() => { setAiTab('care-plan'); setAiResult(''); }} className={`px-4 py-2 text-sm rounded border ${aiTab === 'care-plan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}>Care Plan Generator</button>
              <button onClick={() => { setAiTab('incident'); setAiResult(''); }} className={`px-4 py-2 text-sm rounded border ${aiTab === 'incident' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700'}`}>Incident Report Writer</button>
            </div>
            {aiTab === 'care-plan' && (
              <div className="bg-white rounded-lg border p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">AHS Individualized Care Plan Generator</h3>
                <p className="text-xs text-gray-500">Generates person-centred care plan goals per CCHSS/RAI-MDS standards using Ollama AI.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Resident Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.resident_name} onChange={e => aif('resident_name', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Unit</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.unit} onChange={e => aif('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Care Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.care_level} onChange={e => aif('care_level', e.target.value)}>{CARE_LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}</select></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Diagnoses (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.diagnoses} onChange={e => aif('diagnoses', e.target.value)} placeholder="e.g. Moderate Dementia, Hypertension, Type 2 Diabetes" /></div>
                </div>
                <button onClick={runAi} disabled={aiLoading || !aiInput.diagnoses} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Care Plan'}</button>
              </div>
            )}
            {aiTab === 'incident' && (
              <div className="bg-white rounded-lg border p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">AHS Incident Report Writer</h3>
                <p className="text-xs text-gray-500">Drafts a formal AHS-style incident narrative. Review all clinical details before submission.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Resident Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.resident_name} onChange={e => aif('resident_name', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Staff Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.staff_name} onChange={e => aif('staff_name', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Incident Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.incident_type} onChange={e => aif('incident_type', e.target.value)}>{INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Severity</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.severity} onChange={e => aif('severity', e.target.value)}>{SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Date & Time</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.occurred_at} onChange={e => aif('occurred_at', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiInput.location} onChange={e => aif('location', e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">What Happened *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={aiInput.description} onChange={e => aif('description', e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Immediate Action Taken</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={aiInput.immediate_action} onChange={e => aif('immediate_action', e.target.value)} /></div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-red-700"><input type="checkbox" checked={aiInput.ahs_reportable} onChange={e => aif('ahs_reportable', e.target.checked)} />AHS Reportable Event (mandatory 24h notification)</label></div>
                </div>
                <button onClick={runAi} disabled={aiLoading || !aiInput.description} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Report'}</button>
              </div>
            )}
            {aiResult && (
              <div className="bg-white rounded-lg border p-5">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">AI Output</h3>
                  <button onClick={() => navigator.clipboard.writeText(aiResult)} className="text-xs text-blue-600 hover:underline">Copy</button>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">{aiResult}</pre>
                <p className="text-xs text-amber-600 mt-3">⚠ AI-generated content — review all clinical values with the care team before use in official documentation.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
