'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'students', 'lessons', 'instructors', 'vehicles', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  lessons: 'Lessons',
  instructors: 'Instructors',
  vehicles: 'Vehicles',
  ai: 'AI Tools',
};

const PROGRAMS = ['class5_gdl', 'class5_full', 'class1_melt', 'class6_motorcycle', 'refresher'] as const;
const PROGRAM_LABELS: Record<string, string> = {
  class5_gdl: 'Class 5 GDL',
  class5_full: 'Class 5 Full',
  class1_melt: 'Class 1 MELT',
  class6_motorcycle: 'Class 6 Motorcycle',
  refresher: 'Refresher',
};
const PROGRAM_COLORS: Record<string, string> = {
  class5_gdl: 'blue',
  class5_full: 'teal',
  class1_melt: 'purple',
  class6_motorcycle: 'amber',
  refresher: 'gray',
};

interface Dashboard {
  total_students: number; enrolled: number; lessons_this_week: number;
  tests_scheduled: number; pass_rate_pct: number; total_tests: number;
  tests_passed: number; instructors_count: number;
}
interface Student {
  id: string; first_name: string; last_name: string; email: string; phone: string;
  date_of_birth: string; alberta_id: string; program: string;
  lessons_purchased: number; lessons_completed: number;
  theory_test_passed: boolean; road_test_passed: boolean; road_test_attempts: number;
  status: string; notes: string; created_at: string;
}
interface Lesson {
  id: string; student_id: string; student_name: string; student_program: string;
  instructor_id: string; instructor_name: string; vehicle_id: string; vehicle_label: string;
  lesson_date: string; start_time: string; duration_minutes: number; lesson_type: string;
  pickup_location: string; status: string; skills_covered: string[]; instructor_notes: string;
}
interface Instructor {
  id: string; name: string; email: string; phone: string; instructor_cert_number: string;
  cert_expiry: string; license_classes: string[]; hourly_rate: number; status: string;
  notes: string; days_until_cert_expiry: number;
}
interface Vehicle {
  id: string; make: string; model: string; year: number; license_plate: string;
  dual_controls: boolean; vehicle_type: string; insurance_expiry: string;
  registration_expiry: string; condition: string; status: string; notes: string;
  days_until_insurance_expiry: number; days_until_registration_expiry: number;
}

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t: string) { return t ? t.slice(0, 5) : '—'; }

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
    purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ completed, total, label }: { completed: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="w-full">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{completed}/{total} ({pct}%)</div>
    </div>
  );
}

function PassRateGauge({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';
  const ring = pct >= 80 ? 'stroke-green-500' : pct >= 60 ? 'stroke-amber-500' : 'stroke-red-500';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="60" cy="60" r="45" fill="none" className={ring} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)" />
        <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" className={`text-2xl font-bold ${color}`} style={{ fontSize: 22, fontWeight: 700 }}>
          {pct}%
        </text>
      </svg>
      <p className="text-sm text-gray-500 mt-1">Road Test Pass Rate</p>
    </div>
  );
}

function ExpiryAlert({ label, days }: { label: string; days: number | null }) {
  if (days === null) return <span className="text-gray-400 text-xs">No expiry set</span>;
  const color = days < 0 ? 'text-red-600 font-bold' : days < 30 ? 'text-amber-600 font-semibold' : 'text-gray-500';
  const msg = days < 0 ? `EXPIRED ${Math.abs(days)}d ago` : days === 0 ? 'Expires TODAY' : `${days}d`;
  return <span className={`text-xs ${color}`}>{label}: {msg}</span>;
}

function lessonStatusColor(s: string) {
  const m: Record<string, string> = { scheduled: 'blue', completed: 'green', cancelled: 'red', 'no-show': 'amber', rescheduled: 'gray' };
  return m[s] ?? 'gray';
}
function vehicleStatusColor(s: string) {
  return s === 'available' ? 'green' : s === 'in_use' ? 'blue' : s === 'maintenance' ? 'amber' : 'red';
}
function conditionColor(c: string) {
  return c === 'excellent' ? 'green' : c === 'good' ? 'teal' : c === 'fair' ? 'amber' : 'red';
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', alberta_id: '', program: 'class5_gdl', lessons_purchased: '10', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/driving-school/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lessons_purchased: parseInt(form.lessons_purchased) || 0 }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Enrol New Student</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Alberta ID</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.alberta_id} onChange={e => f('alberta_id', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Program</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.program} onChange={e => f('program', e.target.value)}>
              {PROGRAMS.map(p => <option key={p} value={p}>{PROGRAM_LABELS[p]}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Lessons Purchased</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lessons_purchased} onChange={e => f('lessons_purchased', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.first_name || !form.last_name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Enrol Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Lesson Modal ────────────────────────────────────────────────────
function ScheduleLessonModal({ students, instructors, vehicles, onClose, onSaved }: {
  students: Student[]; instructors: Instructor[]; vehicles: Vehicle[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ student_id: '', instructor_id: '', vehicle_id: '', lesson_date: '', start_time: '', duration_minutes: '60', lesson_type: 'in-car', pickup_location: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.student_id || !form.lesson_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/driving-school/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_minutes: parseInt(form.duration_minutes) || 60 }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Schedule Lesson</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Student *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.student_id} onChange={e => f('student_id', e.target.value)}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {PROGRAM_LABELS[s.program] ?? s.program}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Instructor</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.instructor_id} onChange={e => f('instructor_id', e.target.value)}>
              <option value="">Select instructor…</option>
              {instructors.filter(i => i.status === 'active').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Vehicle</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle_id} onChange={e => f('vehicle_id', e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.filter(v => v.status === 'available').map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.license_plate})</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lesson_date} onChange={e => f('lesson_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Start Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_time} onChange={e => f('start_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_minutes} onChange={e => f('duration_minutes', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lesson Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lesson_type} onChange={e => f('lesson_type', e.target.value)}>
              {['in-car','simulator','theory','highway','night','parking','pre-test'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Pickup Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pickup_location} onChange={e => f('pickup_location', e.target.value)} placeholder="Address or landmark" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.student_id || !form.lesson_date} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Instructor Modal ─────────────────────────────────────────────────────
function AddInstructorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', instructor_cert_number: '', cert_expiry: '', hourly_rate: '65', notes: '' });
  const [licenseClasses, setLicenseClasses] = useState<string[]>(['class5']);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const toggleClass = (c: string) => setLicenseClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/driving-school/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, license_classes: licenseClasses, hourly_rate: parseFloat(form.hourly_rate) || null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Instructor</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cert Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.instructor_cert_number} onChange={e => f('instructor_cert_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cert Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cert_expiry} onChange={e => f('cert_expiry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Hourly Rate (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">License Classes</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['class1','class2','class3','class4','class5','class6','class7'].map(c => (
                <button key={c} type="button" onClick={() => toggleClass(c)}
                  className={`px-2 py-0.5 rounded text-xs border ${licenseClasses.includes(c) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Instructor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Vehicle Modal ────────────────────────────────────────────────────────
function AddVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ make: '', model: '', year: new Date().getFullYear().toString(), license_plate: '', dual_controls: true, vehicle_type: 'sedan', insurance_expiry: '', registration_expiry: '', condition: 'good', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.make || !form.model) return;
    setSaving(true);
    try {
      await fetch('/api/admin/driving-school/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, year: parseInt(form.year) || null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Vehicle</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Make *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.make} onChange={e => f('make', e.target.value)} placeholder="Toyota" /></div>
          <div><label className="text-xs text-gray-500">Model *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.model} onChange={e => f('model', e.target.value)} placeholder="Corolla" /></div>
          <div><label className="text-xs text-gray-500">Year</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.year} onChange={e => f('year', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">License Plate</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono uppercase" value={form.license_plate} onChange={e => f('license_plate', e.target.value.toUpperCase())} /></div>
          <div><label className="text-xs text-gray-500">Vehicle Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle_type} onChange={e => f('vehicle_type', e.target.value)}>
              {['sedan','suv','truck','motorcycle','class1_truck'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Condition</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.condition} onChange={e => f('condition', e.target.value)}>
              {['excellent','good','fair','poor'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Insurance Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_expiry} onChange={e => f('insurance_expiry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Registration Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.registration_expiry} onChange={e => f('registration_expiry', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="dual_controls" checked={form.dual_controls} onChange={e => f('dual_controls', e.target.checked)} className="h-4 w-4" />
            <label htmlFor="dual_controls" className="text-sm text-gray-700">Dual Controls Installed (Alberta approved)</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.make || !form.model} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DrivingSchoolAdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showScheduleLesson, setShowScheduleLesson] = useState(false);
  const [showAddInstructor, setShowAddInstructor] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentProgram, setStudentProgram] = useState('');
  const [completingLesson, setCompletingLesson] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState('');
  const [aiForm, setAiForm] = useState({ program: 'class5_gdl', lessons_completed: '0', skill_gaps: '' });
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/driving-school');
      if (r.ok) setDashboard(await r.json());
    } finally { setLoading(false); }
  }, []);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (studentSearch) params.set('search', studentSearch);
    if (studentProgram) params.set('program', studentProgram);
    const r = await fetch(`/api/admin/driving-school/students?${params}`);
    if (r.ok) { const d = await r.json(); setStudents(d.students ?? []); }
  }, [studentSearch, studentProgram]);

  const loadLessons = useCallback(async () => {
    const r = await fetch('/api/admin/driving-school/lessons');
    if (r.ok) { const d = await r.json(); setLessons(d.lessons ?? []); }
  }, []);

  const loadInstructors = useCallback(async () => {
    const r = await fetch('/api/admin/driving-school/instructors');
    if (r.ok) { const d = await r.json(); setInstructors(d.instructors ?? []); }
  }, []);

  const loadVehicles = useCallback(async () => {
    const r = await fetch('/api/admin/driving-school/vehicles');
    if (r.ok) { const d = await r.json(); setVehicles(d.vehicles ?? []); }
  }, []);

  useEffect(() => { loadDashboard(); loadInstructors(); loadVehicles(); }, [loadDashboard, loadInstructors, loadVehicles]);
  useEffect(() => { if (tab === 'students') loadStudents(); }, [tab, loadStudents]);
  useEffect(() => { if (tab === 'lessons') loadLessons(); }, [tab, loadLessons]);

  async function completeLesson(lessonId: string) {
    setCompletingLesson(lessonId);
    try {
      const r = await fetch(`/api/admin/driving-school/lessons/${lessonId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (r.ok) { loadLessons(); loadDashboard(); }
    } finally { setCompletingLesson(null); }
  }

  async function generateAiPlan() {
    setAiLoading(true);
    setAiPlan('');
    try {
      const r = await fetch('/api/admin/driving-school/ai-lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program: aiForm.program, lessons_completed: parseInt(aiForm.lessons_completed) || 0, skill_gaps: aiForm.skill_gaps.split(',').map(s => s.trim()).filter(Boolean) }),
      });
      if (r.ok) { const d = await r.json(); setAiPlan(d.plan ?? ''); }
    } finally { setAiLoading(false); }
  }

  const availableVehicles = vehicles.filter(v => v.status === 'available').length;
  const expiringVehicles = vehicles.filter(v => (v.days_until_insurance_expiry !== null && v.days_until_insurance_expiry <= 30) || (v.days_until_registration_expiry !== null && v.days_until_registration_expiry <= 30));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Driving School — Admin</h1>
            <p className="text-slate-400 text-sm mt-0.5">Alberta Transportation Approved · GDL · MELT · Class 6</p>
          </div>
          <div className="flex gap-3">
            {tab === 'students' && <button onClick={() => setShowAddStudent(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Enrol Student</button>}
            {tab === 'lessons' && <button onClick={() => setShowScheduleLesson(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Schedule Lesson</button>}
            {tab === 'instructors' && <button onClick={() => setShowAddInstructor(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Instructor</button>}
            {tab === 'vehicles' && <button onClick={() => setShowAddVehicle(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Vehicle</button>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div>
            {loading && <p className="text-gray-400 text-sm mb-4">Loading…</p>}
            {dashboard && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <KpiCard label="Total Students" value={dashboard.total_students} sub={`${dashboard.enrolled} enrolled`} color="blue" />
                  <KpiCard label="Lessons This Week" value={dashboard.lessons_this_week} color="teal" />
                  <KpiCard label="Tests Scheduled" value={dashboard.tests_scheduled} color="amber" />
                  <KpiCard label="Active Instructors" value={dashboard.instructors_count} color="purple" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {/* Pass Rate Gauge */}
                  <div className="bg-white rounded-xl border p-6 flex flex-col items-center justify-center">
                    <PassRateGauge pct={dashboard.pass_rate_pct} />
                    <p className="text-xs text-gray-400 mt-2">{dashboard.tests_passed} passed / {dashboard.total_tests} total tests</p>
                  </div>

                  {/* Weekly Schedule */}
                  <div className="bg-white rounded-xl border p-4 col-span-1">
                    <h3 className="font-semibold text-slate-700 mb-3">This Week&apos;s Lessons</h3>
                    {lessons.filter(l => {
                      const d = new Date(l.lesson_date);
                      const now = new Date();
                      const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1);
                      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                      return d >= monday && d <= sunday;
                    }).slice(0, 5).map(l => (
                      <div key={l.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <span className="text-sm font-medium">{l.student_name}</span>
                          <span className="text-xs text-gray-400 ml-2">{fmtDate(l.lesson_date)} {fmtTime(l.start_time)}</span>
                        </div>
                        <Badge label={l.status} color={lessonStatusColor(l.status)} />
                      </div>
                    ))}
                    {!lessons.length && <p className="text-sm text-gray-400">No lessons loaded — click Lessons tab to load.</p>}
                  </div>

                  {/* Vehicle Fleet */}
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Fleet Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Available</span>
                        <span className="font-semibold text-green-600">{availableVehicles}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Fleet</span>
                        <span className="font-semibold">{vehicles.length}</span>
                      </div>
                      {expiringVehicles.length > 0 && (
                        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                          ⚠ {expiringVehicles.length} vehicle(s) with expiring insurance/registration
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Students */}
        {tab === 'students' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search name, email, AB ID…" className="border rounded px-3 py-1.5 text-sm w-64" />
              <select value={studentProgram} onChange={e => setStudentProgram(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
                <option value="">All Programs</option>
                {PROGRAMS.map(p => <option key={p} value={p}>{PROGRAM_LABELS[p]}</option>)}
              </select>
              <button onClick={loadStudents} className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-800">Search</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Student', 'Program', 'Lessons Progress', 'Theory Test', 'Road Test', 'Status', 'Enrolled'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.first_name} {s.last_name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                        {s.alberta_id && <div className="text-xs font-mono text-gray-400">AB: {s.alberta_id}</div>}
                      </td>
                      <td className="px-4 py-3"><Badge label={PROGRAM_LABELS[s.program] ?? s.program} color={PROGRAM_COLORS[s.program] ?? 'gray'} /></td>
                      <td className="px-4 py-3 w-40">
                        <ProgressBar completed={s.lessons_completed} total={s.lessons_purchased} />
                        <div className="text-xs text-gray-400 mt-0.5">{Math.max(0, s.lessons_purchased - s.lessons_completed)} remaining</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={s.theory_test_passed ? 'Passed' : 'Pending'} color={s.theory_test_passed ? 'green' : 'gray'} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={s.road_test_passed ? 'Passed' : s.road_test_attempts > 0 ? `Failed (${s.road_test_attempts}x)` : 'Not taken'} color={s.road_test_passed ? 'green' : s.road_test_attempts > 0 ? 'red' : 'gray'} />
                      </td>
                      <td className="px-4 py-3"><Badge label={s.status} color={s.status === 'enrolled' ? 'blue' : s.status === 'graduated' ? 'green' : 'gray'} /></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.created_at)}</td>
                    </tr>
                  ))}
                  {!students.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lessons */}
        {tab === 'lessons' && (
          <div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Student', 'Date & Time', 'Instructor', 'Vehicle', 'Type', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lessons.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.student_name}</div>
                        <div className="text-xs text-gray-400">{PROGRAM_LABELS[l.student_program] ?? l.student_program}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{fmtDate(l.lesson_date)}</div>
                        <div className="text-xs text-gray-400">{fmtTime(l.start_time)} · {l.duration_minutes}min</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{l.instructor_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.vehicle_label ?? '—'}</td>
                      <td className="px-4 py-3"><Badge label={l.lesson_type ?? '—'} color="gray" /></td>
                      <td className="px-4 py-3"><Badge label={l.status} color={lessonStatusColor(l.status)} /></td>
                      <td className="px-4 py-3">
                        {l.status === 'scheduled' && (
                          <button onClick={() => completeLesson(l.id)} disabled={completingLesson === l.id}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                            {completingLesson === l.id ? '…' : 'Complete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!lessons.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No lessons found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructors */}
        {tab === 'instructors' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instructors.map(i => (
                <div key={i.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-800">{i.name}</div>
                      <div className="text-xs text-gray-400">{i.email}</div>
                      <div className="text-xs text-gray-400">{i.phone}</div>
                    </div>
                    <Badge label={i.status} color={i.status === 'active' ? 'green' : 'gray'} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(i.license_classes ?? []).map(c => <Badge key={c} label={c.toUpperCase()} color="blue" />)}
                  </div>
                  {i.instructor_cert_number && (
                    <div className="text-xs text-gray-500 font-mono mb-1">Cert: {i.instructor_cert_number}</div>
                  )}
                  <ExpiryAlert label="Cert" days={i.days_until_cert_expiry} />
                  {i.hourly_rate && <div className="text-xs text-gray-500 mt-1">${i.hourly_rate}/hr</div>}
                </div>
              ))}
              {!instructors.length && <div className="col-span-3 text-center text-gray-400 py-8">No instructors found</div>}
            </div>
          </div>
        )}

        {/* Vehicles */}
        {tab === 'vehicles' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map(v => (
                <div key={v.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-800">{v.year} {v.make} {v.model}</div>
                      <div className="text-xs font-mono text-gray-500">{v.license_plate}</div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge label={v.status} color={vehicleStatusColor(v.status)} />
                      {v.dual_controls && <Badge label="Dual Controls" color="teal" />}
                    </div>
                  </div>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    <Badge label={v.condition} color={conditionColor(v.condition)} />
                    {v.vehicle_type && <Badge label={v.vehicle_type} color="gray" />}
                  </div>
                  <div className="space-y-1">
                    <ExpiryAlert label="Insurance" days={v.days_until_insurance_expiry} />
                    <br />
                    <ExpiryAlert label="Registration" days={v.days_until_registration_expiry} />
                  </div>
                </div>
              ))}
              {!vehicles.length && <div className="col-span-3 text-center text-gray-400 py-8">No vehicles found</div>}
            </div>
          </div>
        )}

        {/* AI Tools */}
        {tab === 'ai' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Lesson Plan Generator</h2>
              <p className="text-sm text-gray-500 mb-4">Generate a personalized lesson plan using local Ollama (llama3.2) based on student program and skill gaps.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="text-xs text-gray-500">Program</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.program} onChange={e => setAiForm(p => ({ ...p, program: e.target.value }))}>
                    {PROGRAMS.map(p => <option key={p} value={p}>{PROGRAM_LABELS[p]}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Lessons Completed</label>
                  <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.lessons_completed} onChange={e => setAiForm(p => ({ ...p, lessons_completed: e.target.value }))} />
                </div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Skill Gaps (comma-separated)</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. lane changes, parallel parking, highway merging" value={aiForm.skill_gaps} onChange={e => setAiForm(p => ({ ...p, skill_gaps: e.target.value }))} />
                </div>
              </div>
              <button onClick={generateAiPlan} disabled={aiLoading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                {aiLoading ? 'Generating…' : 'Generate Lesson Plan'}
              </button>
              {aiPlan && (
                <div className="mt-4 p-4 bg-gray-50 rounded border text-sm whitespace-pre-wrap text-gray-700">{aiPlan}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddStudent && <AddStudentModal onClose={() => setShowAddStudent(false)} onSaved={() => { setShowAddStudent(false); loadStudents(); loadDashboard(); }} />}
      {showScheduleLesson && <ScheduleLessonModal students={students} instructors={instructors} vehicles={vehicles} onClose={() => setShowScheduleLesson(false)} onSaved={() => { setShowScheduleLesson(false); loadLessons(); loadDashboard(); }} />}
      {showAddInstructor && <AddInstructorModal onClose={() => setShowAddInstructor(false)} onSaved={() => { setShowAddInstructor(false); loadInstructors(); }} />}
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSaved={() => { setShowAddVehicle(false); loadVehicles(); }} />}
    </div>
  );
}
