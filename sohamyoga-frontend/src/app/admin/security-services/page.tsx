'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'shifts', 'guards', 'clients', 'incidents', 'compliance'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', shifts: 'Shifts', guards: 'Guards',
  clients: 'Clients', incidents: 'Incidents', compliance: 'Compliance',
};

const SHIFT_TYPES = ['static', 'mobile_patrol', 'event', 'emergency', 'escort', 'investigation'];
const SHIFT_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'cancelled'];
const INCIDENT_TYPES = ['theft', 'vandalism', 'trespass', 'medical', 'fire', 'suspicious_activity', 'altercation', 'property_damage', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const LICENSE_TYPES = ['basic', 'armed', 'supervisor', 'investigator'];
const CONTRACT_TYPES = ['monthly', 'annual', 'per_event', 'retainer'];
const SERVICE_TYPES = ['static_guard', 'mobile_patrol', 'event_security', 'loss_prevention', 'executive_protection', 'alarm_response'];

interface DashData { shifts_today: number; guards_active_today: number; clients_count: number; incidents_mtd: number; missed_shifts_mtd: number; expiring_licenses_30d: number; today_shifts: Shift[]; }
interface Guard { id: number; first_name: string; last_name: string; email: string; phone: string; license_number: string; license_type: string; license_expiry: string; license_days_remaining: number; first_aid_certified: boolean; first_aid_expiry: string; first_aid_days_remaining: number; certifications: string[]; languages: string[]; status: string; hourly_rate: number; }
interface SecClient { id: number; company_name: string; contact_name: string; contact_email: string; contact_phone: string; city: string; province: string; contract_type: string; service_types: string[]; monthly_value: number; contract_start: string; contract_end: string; site_count: number; status: string; special_instructions: string; }
interface Shift { id: number; client_id: number; guard_id: number; guard_name: string; company_name: string; site_name: string; site_address: string; shift_date: string; start_time: string; end_time: string; shift_type: string; status: string; check_in_time: string; check_out_time: string; hours_worked: number; bill_rate: number; pay_rate: number; incident_reported: boolean; notes: string; }
interface Incident { id: number; client_id: number; guard_id: number; guard_name: string; company_name: string; incident_type: string; severity: string; incident_time: string; location: string; description: string; action_taken: string; police_called: boolean; police_report_number: string; witnesses: string; follow_up_required: boolean; report_submitted: boolean; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t: string) { return t ? t.substring(0, 5) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', slate: 'bg-slate-100 text-slate-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function shiftStatusColor(s: string) {
  const m: Record<string, string> = { scheduled: 'gray', confirmed: 'blue', in_progress: 'green', completed: 'teal', missed: 'red', cancelled: 'slate' };
  return m[s] ?? 'gray';
}
function severityColor(s: string) {
  const m: Record<string, string> = { low: 'green', medium: 'amber', high: 'orange', critical: 'red' };
  return m[s] ?? 'gray';
}
function licenseColor(days: number) {
  if (days < 0) return 'red';
  if (days <= 30) return 'red';
  if (days <= 60) return 'amber';
  return 'green';
}

// ─── Modal: Add Guard ──────────────────────────────────────────────────────────
function AddGuardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', license_number: '', license_type: 'basic', license_expiry: '', first_aid_certified: false, first_aid_expiry: '', hourly_rate: '', languages: 'English', certifications: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/security-services/guards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null, languages: form.languages.split(',').map(s => s.trim()), certifications: form.certifications ? form.certifications.split(',').map(s => s.trim()) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Guard</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">License #</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.license_number} onChange={e => f('license_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">License Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.license_type} onChange={e => f('license_type', e.target.value)}>
              {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">License Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.license_expiry} onChange={e => f('license_expiry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Hourly Rate ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="fa" checked={form.first_aid_certified} onChange={e => f('first_aid_certified', e.target.checked)} /><label htmlFor="fa" className="text-sm">First Aid Certified</label></div>
          {form.first_aid_certified && <div><label className="text-xs text-gray-500">First Aid Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.first_aid_expiry} onChange={e => f('first_aid_expiry', e.target.value)} /></div>}
          <div className="col-span-2"><label className="text-xs text-gray-500">Languages (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.languages} onChange={e => f('languages', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Certifications (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.certifications} onChange={e => f('certifications', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Guard'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Client ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', address: '', city: 'Calgary', province: 'AB', contract_type: 'monthly', service_types: ['static_guard'], monthly_value: '', site_count: '1', special_instructions: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  function toggleService(s: string) { setForm(p => ({ ...p, service_types: p.service_types.includes(s) ? p.service_types.filter(x => x !== s) : [...p.service_types, s] })); }
  async function submit() {
    if (!form.company_name || !form.contact_name || !form.contact_email || !form.contact_phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/security-services/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null, site_count: parseInt(form.site_count) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.company_name} onChange={e => f('company_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.contact_email} onChange={e => f('contact_email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.contact_phone} onChange={e => f('contact_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.contract_type} onChange={e => f('contract_type', e.target.value)}>
              {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Monthly Value ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.monthly_value} onChange={e => f('monthly_value', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Sites</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.site_count} onChange={e => f('site_count', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Services</label>
            <div className="flex flex-wrap gap-2">{SERVICE_TYPES.map(s => <button key={s} onClick={() => toggleService(s)} className={`text-xs px-2 py-1 rounded border ${form.service_types.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>{s.replace(/_/g, ' ')}</button>)}</div>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Special Instructions</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.special_instructions} onChange={e => f('special_instructions', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Shift ──────────────────────────────────────────────────────────
function AddShiftModal({ clients, guards, onClose, onSaved }: { clients: SecClient[]; guards: Guard[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', guard_id: '', site_name: '', site_address: '', shift_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '16:00', shift_type: 'static', bill_rate: '', pay_rate: '', break_minutes: '30', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.site_name || !form.shift_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/security-services/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: form.client_id ? parseInt(form.client_id) : null, guard_id: form.guard_id ? parseInt(form.guard_id) : null, bill_rate: form.bill_rate ? parseFloat(form.bill_rate) : null, pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : null, break_minutes: parseInt(form.break_minutes) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Shift</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Client</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Guard</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.guard_id} onChange={e => f('guard_id', e.target.value)}>
              <option value="">— Select Guard —</option>
              {guards.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Site Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.site_name} onChange={e => f('site_name', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Site Address</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.site_address} onChange={e => f('site_address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.shift_date} onChange={e => f('shift_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.shift_type} onChange={e => f('shift_type', e.target.value)}>
              {SHIFT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Start Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.start_time} onChange={e => f('start_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.end_time} onChange={e => f('end_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Bill Rate ($/hr)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.bill_rate} onChange={e => f('bill_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Pay Rate ($/hr)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.pay_rate} onChange={e => f('pay_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Break (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.break_minutes} onChange={e => f('break_minutes', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Shift'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Incident ───────────────────────────────────────────────────────
function AddIncidentModal({ clients, guards, onClose, onSaved }: { clients: SecClient[]; guards: Guard[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', guard_id: '', incident_type: 'suspicious_activity', severity: 'low', incident_time: new Date().toISOString().slice(0, 16), location: '', description: '', action_taken: '', police_called: false, witnesses: '', follow_up_required: false });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.description || !form.incident_time) return;
    setSaving(true);
    try {
      await fetch('/api/admin/security-services/incidents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: form.client_id ? parseInt(form.client_id) : null, guard_id: form.guard_id ? parseInt(form.guard_id) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">New Incident Report</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Client</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
              <option value="">— Select —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Guard</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.guard_id} onChange={e => f('guard_id', e.target.value)}>
              <option value="">— Select —</option>
              {guards.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Incident Type *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.incident_type} onChange={e => f('incident_type', e.target.value)}>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Severity</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.severity} onChange={e => f('severity', e.target.value)}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Date/Time *</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm" value={form.incident_time} onChange={e => f('incident_time', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.location} onChange={e => f('location', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Action Taken</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.action_taken} onChange={e => f('action_taken', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Witnesses</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.witnesses} onChange={e => f('witnesses', e.target.value)} /></div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.police_called} onChange={e => f('police_called', e.target.checked)} />Police Called</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.follow_up_required} onChange={e => f('follow_up_required', e.target.checked)} />Follow-up Required</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-red-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'File Incident'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SecurityServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [clients, setClients] = useState<SecClient[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddGuard, setShowAddGuard] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddIncident, setShowAddIncident] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [severityFilter, setSeverityFilter] = useState('');

  const loadDash = useCallback(async () => { const r = await fetch('/api/admin/security-services'); setDash(await r.json()); }, []);
  const loadGuards = useCallback(async () => { const r = await fetch('/api/admin/security-services/guards'); setGuards(await r.json()); }, []);
  const loadClients = useCallback(async () => { const r = await fetch('/api/admin/security-services/clients'); setClients(await r.json()); }, []);
  const loadShifts = useCallback(async (date: string) => { const r = await fetch(`/api/admin/security-services/shifts?date=${date}`); setShifts(await r.json()); }, []);
  const loadIncidents = useCallback(async (severity = '') => {
    const url = severity ? `/api/admin/security-services/incidents?severity=${severity}` : '/api/admin/security-services/incidents';
    const r = await fetch(url);
    setIncidents(await r.json());
  }, []);

  useEffect(() => { loadDash(); loadGuards(); loadClients(); }, []);
  useEffect(() => { if (tab === 'shifts') loadShifts(shiftDate); }, [tab, shiftDate]);
  useEffect(() => { if (tab === 'incidents') loadIncidents(severityFilter); }, [tab, severityFilter]);

  async function shiftAction(id: number, action: string, extra: Record<string, unknown> = {}) {
    await fetch(`/api/admin/security-services/shifts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    loadShifts(shiftDate);
    loadDash();
  }

  async function generateAiReport() {
    if (!selectedIncident) return;
    setAiLoading(true);
    try {
      const r = await fetch('/api/admin/security-services/ai-incident-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedIncident),
      });
      const d = await r.json();
      setAiReport(d.report);
    } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Security & Guard Services Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Guard scheduling, client management, incident reporting — Alberta</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── Dashboard ── */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Shifts Today" value={dash.shifts_today} color="blue" />
              <KpiCard label="Guards Active" value={dash.guards_active_today} color="green" />
              <KpiCard label="Active Clients" value={dash.clients_count} color="teal" />
              <KpiCard label="Incidents MTD" value={dash.incidents_mtd} color="amber" />
              <KpiCard label="Missed Shifts MTD" value={dash.missed_shifts_mtd} color="red" />
              <KpiCard label="Licenses Expiring 30d" value={dash.expiring_licenses_30d} sub="Requires attention" color="purple" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h2 className="font-semibold mb-4 text-gray-800">Today's Shift Board</h2>
              {dash.today_shifts.length === 0 ? (
                <p className="text-gray-400 text-sm">No shifts scheduled today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Guard</th><th className="pb-2">Site</th><th className="pb-2">Client</th><th className="pb-2">Time</th><th className="pb-2">Type</th><th className="pb-2">Status</th></tr></thead>
                    <tbody>
                      {dash.today_shifts.map(s => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2">{s.guard_name ?? '—'}</td>
                          <td className="py-2">{s.site_name}</td>
                          <td className="py-2 text-gray-500">{s.company_name ?? '—'}</td>
                          <td className="py-2">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</td>
                          <td className="py-2 capitalize">{s.shift_type.replace(/_/g, ' ')}</td>
                          <td className="py-2"><Badge label={s.status.replace(/_/g, ' ')} color={shiftStatusColor(s.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h2 className="font-semibold mb-3 text-gray-800">Severity Breakdown (MTD)</h2>
              <div className="grid grid-cols-4 gap-3">
                {SEVERITIES.map(s => {
                  const count = incidents.filter(i => i.severity === s).length;
                  return <div key={s} className="text-center p-3 rounded-lg bg-gray-50 border"><Badge label={s} color={severityColor(s)} /><p className="text-2xl font-bold mt-2">{count}</p></div>;
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Shifts ── */}
        {tab === 'shifts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input type="date" className="border rounded px-3 py-1.5 text-sm" value={shiftDate} onChange={e => setShiftDate(e.target.value)} />
                <span className="text-sm text-gray-500">{shifts.length} shifts</span>
              </div>
              <button onClick={() => setShowAddShift(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Shift</button>
            </div>
            <div className="grid gap-3">
              {shifts.map(s => (
                <div key={s.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{s.site_name}</span>
                      <Badge label={s.shift_type.replace(/_/g, ' ')} color="purple" />
                      <Badge label={s.status.replace(/_/g, ' ')} color={shiftStatusColor(s.status)} />
                      {s.incident_reported && <Badge label="Incident" color="red" />}
                    </div>
                    <p className="text-sm text-gray-500">{s.guard_name ?? 'Unassigned'} · {s.company_name ?? '—'} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}</p>
                    {s.hours_worked && <p className="text-xs text-gray-400 mt-0.5">{s.hours_worked}h worked · Bill: {s.bill_rate ? fmtCad(s.bill_rate) + '/hr' : '—'} · Pay: {s.pay_rate ? fmtCad(s.pay_rate) + '/hr' : '—'}</p>}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {s.status === 'scheduled' && <button onClick={() => shiftAction(s.id, 'check_in', { check_in_time: new Date().toTimeString().slice(0, 5) })} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Check In</button>}
                    {s.status === 'in_progress' && <button onClick={() => shiftAction(s.id, 'check_out', { check_out_time: new Date().toTimeString().slice(0, 5) })} className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded">Check Out</button>}
                    {(s.status === 'scheduled' || s.status === 'confirmed') && <button onClick={() => shiftAction(s.id, 'missed')} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded">Missed</button>}
                  </div>
                </div>
              ))}
              {shifts.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No shifts for this date.</div>}
            </div>
          </div>
        )}

        {/* ── Guards ── */}
        {tab === 'guards' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddGuard(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Guard</button>
            </div>
            <div className="grid gap-3">
              {guards.map(g => (
                <div key={g.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{g.first_name} {g.last_name}</span>
                        <Badge label={g.license_type} color="blue" />
                        <Badge label={g.status} color={g.status === 'active' ? 'green' : g.status === 'on_leave' ? 'amber' : 'red'} />
                      </div>
                      <p className="text-sm text-gray-500">{g.phone} · {g.email ?? '—'}</p>
                      <p className="text-sm text-gray-500">License: {g.license_number ?? '—'} · {g.hourly_rate ? fmtCad(g.hourly_rate) + '/hr' : '—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${g.license_days_remaining <= 30 ? 'bg-red-100 text-red-700' : g.license_days_remaining <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        License: {g.license_expiry ? `${g.license_days_remaining}d left` : 'No expiry set'}
                      </div>
                      {g.first_aid_certified && (
                        <div className={`px-2 py-1 rounded text-xs font-medium ${g.first_aid_days_remaining <= 30 ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
                          First Aid: {g.first_aid_expiry ? `${g.first_aid_days_remaining}d left` : 'Certified'}
                        </div>
                      )}
                    </div>
                  </div>
                  {g.languages?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{g.languages.map(l => <Badge key={l} label={l} color="gray" />)}</div>}
                </div>
              ))}
              {guards.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No guards found.</div>}
            </div>
          </div>
        )}

        {/* ── Clients ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddClient(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Client</button>
            </div>
            <div className="grid gap-3">
              {clients.map(c => (
                <div key={c.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{c.company_name}</span>
                        <Badge label={c.contract_type} color="purple" />
                        <Badge label={c.status} color={c.status === 'active' ? 'green' : c.status === 'on_hold' ? 'amber' : 'red'} />
                      </div>
                      <p className="text-sm text-gray-500">{c.contact_name} · {c.contact_email} · {c.contact_phone}</p>
                      <p className="text-sm text-gray-500">{c.city}, {c.province} · {c.site_count} site{c.site_count !== 1 ? 's' : ''}</p>
                      {c.service_types?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{c.service_types.map(s => <Badge key={s} label={s.replace(/_/g, ' ')} color="teal" />)}</div>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{c.monthly_value ? fmtCad(c.monthly_value) : '—'}</p>
                      <p className="text-xs text-gray-400">/ month</p>
                    </div>
                  </div>
                  {c.special_instructions && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">Note: {c.special_instructions}</p>}
                </div>
              ))}
              {clients.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No clients found.</div>}
            </div>
          </div>
        )}

        {/* ── Incidents ── */}
        {tab === 'incidents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select className="border rounded px-3 py-1.5 text-sm" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                  <option value="">All Severities</option>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={() => setShowAddIncident(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ File Incident</button>
            </div>
            <div className="grid gap-3">
              {incidents.map(i => (
                <div key={i.id} className={`bg-white rounded-xl border-l-4 p-4 ${i.severity === 'critical' ? 'border-red-600' : i.severity === 'high' ? 'border-orange-500' : i.severity === 'medium' ? 'border-amber-500' : 'border-green-500'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge label={i.incident_type.replace(/_/g, ' ')} color="gray" />
                        <Badge label={i.severity} color={severityColor(i.severity)} />
                        {i.police_called && <Badge label="Police Called" color="red" />}
                        {i.report_submitted && <Badge label="Report Filed" color="teal" />}
                        {i.follow_up_required && <Badge label="Follow-up" color="amber" />}
                      </div>
                      <p className="text-sm font-medium">{i.company_name ?? '—'} · {i.guard_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{new Date(i.incident_time).toLocaleString('en-CA')} · {i.location ?? '—'}</p>
                      <p className="text-sm text-gray-700 mt-2">{i.description}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedIncident(i); setAiReport(''); }}
                      className="ml-4 text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 whitespace-nowrap"
                    >AI Report</button>
                  </div>
                </div>
              ))}
              {incidents.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No incidents found.</div>}
            </div>

            {/* AI Report Panel */}
            {selectedIncident && (
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">AI Incident Report Generator</h3>
                  <div className="flex gap-2">
                    <button onClick={generateAiReport} disabled={aiLoading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Report'}</button>
                    <button onClick={() => { setSelectedIncident(null); setAiReport(''); }} className="border px-3 py-2 rounded text-sm">Clear</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">Selected: {selectedIncident.incident_type.replace(/_/g, ' ')} · {selectedIncident.severity} · {new Date(selectedIncident.incident_time).toLocaleString('en-CA')}</p>
                {aiReport && <pre className="bg-gray-50 rounded p-4 text-xs whitespace-pre-wrap font-mono border max-h-96 overflow-y-auto">{aiReport}</pre>}
              </div>
            )}
          </div>
        )}

        {/* ── Compliance ── */}
        {tab === 'compliance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-4 text-gray-800">License Expiry Status</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Guard</th><th className="pb-2">License #</th><th className="pb-2">Type</th><th className="pb-2">Expiry</th><th className="pb-2">Days Remaining</th><th className="pb-2">Status</th></tr></thead>
                  <tbody>
                    {guards.sort((a, b) => a.license_days_remaining - b.license_days_remaining).map(g => (
                      <tr key={g.id} className="border-b last:border-0">
                        <td className="py-2">{g.first_name} {g.last_name}</td>
                        <td className="py-2 font-mono text-xs">{g.license_number ?? '—'}</td>
                        <td className="py-2"><Badge label={g.license_type} color="blue" /></td>
                        <td className="py-2">{fmtDate(g.license_expiry)}</td>
                        <td className="py-2">{g.license_expiry ? `${g.license_days_remaining}d` : '—'}</td>
                        <td className="py-2"><Badge label={g.license_days_remaining <= 0 ? 'EXPIRED' : g.license_days_remaining <= 30 ? 'Critical' : g.license_days_remaining <= 60 ? 'Renew Soon' : 'OK'} color={licenseColor(g.license_days_remaining)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-4 text-gray-800">First Aid Certifications</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Guard</th><th className="pb-2">First Aid Certified</th><th className="pb-2">Expiry</th><th className="pb-2">Days Remaining</th></tr></thead>
                  <tbody>
                    {guards.map(g => (
                      <tr key={g.id} className="border-b last:border-0">
                        <td className="py-2">{g.first_name} {g.last_name}</td>
                        <td className="py-2"><Badge label={g.first_aid_certified ? 'Yes' : 'No'} color={g.first_aid_certified ? 'green' : 'gray'} /></td>
                        <td className="py-2">{g.first_aid_certified ? fmtDate(g.first_aid_expiry) : '—'}</td>
                        <td className="py-2">{g.first_aid_certified && g.first_aid_expiry ? <Badge label={`${g.first_aid_days_remaining}d`} color={g.first_aid_days_remaining <= 30 ? 'red' : 'green'} /> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddGuard && <AddGuardModal onClose={() => setShowAddGuard(false)} onSaved={() => { setShowAddGuard(false); loadGuards(); }} />}
      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); loadClients(); }} />}
      {showAddShift && <AddShiftModal clients={clients} guards={guards} onClose={() => setShowAddShift(false)} onSaved={() => { setShowAddShift(false); loadShifts(shiftDate); loadDash(); }} />}
      {showAddIncident && <AddIncidentModal clients={clients} guards={guards} onClose={() => setShowAddIncident(false)} onSaved={() => { setShowAddIncident(false); loadIncidents(severityFilter); }} />}
    </div>
  );
}
