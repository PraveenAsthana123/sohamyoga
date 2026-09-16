'use client';

import { useEffect, useState, useCallback } from 'react';

const TABS = ['Dashboard', 'Patients', 'Schedule', 'Appointments', 'Insurance Claims', 'AI Intake Assistant'] as const;
type Tab = typeof TABS[number];

const SERVICE_TYPES = ['consultation','follow_up','chiropractic','physiotherapy','dental_cleaning','dental_exam','dental_xray','optometry','psychology','naturopathy','massage','lab_work','vaccination','home_care'];
const CLAIM_STATUSES = ['pending','submitted','approved','paid','rejected','partial'];
const INSURERS = ['Blue Cross','Manulife','Sun Life','Green Shield','Great-West Life','Desjardins','Intact','Other'];
const PROVINCES = ['AB','BC','ON','QC','MB','SK','NS','NB','PE','NL','YT','NT','NU'];

interface Stats {
  active_patients: string; today_appointments: string; revenue_today: string; pending_claims_value: string;
}
interface Patient {
  id: number; name: string; email: string; phone: string; province: string;
  insurance_provider: string; status: string; preferred_provider: string;
  date_of_birth: string; health_card_number: string; created_at: string;
  last_visit?: string; appointment_count?: string;
  allergies?: string[]; medications?: string[]; conditions?: string[];
}
interface Appointment {
  id: number; patient_name: string; patient_phone: string; provider_name: string;
  service_type: string; appointment_date: string; duration_minutes: number;
  status: string; fee?: string; insurance_covered?: string; patient_paid?: string;
  follow_up_required?: boolean; follow_up_date?: string; notes?: string; treatment_notes?: string;
  insurance_provider?: string;
}
interface Claim {
  id: number; patient_name: string; insurer: string; policy_number: string;
  claim_amount: string; approved_amount?: string; status: string;
  submitted_date?: string; payment_date?: string; patient_id: number; appointment_id?: number;
}
interface FollowUp {
  id: number; follow_up_date: string; patient_name: string; provider_name: string;
}
interface DashData {
  stats: Stats; todayAppointments: Appointment[]; pendingClaims: { cnt: string; total: string };
  followUps: FollowUp[]; patients: Patient[];
}

function Badge({ text, color }: { text: string; color: string }) {
  const map: Record<string, string> = {
    green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700', red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600', purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[color] || map.gray}`}>{text}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${map[color] || map.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function statusColor(s: string): string {
  if (['completed','approved','paid','active'].includes(s)) return 'green';
  if (['scheduled','confirmed'].includes(s)) return 'blue';
  if (['pending','submitted'].includes(s)) return 'yellow';
  if (['cancelled','rejected','no_show','inactive'].includes(s)) return 'red';
  return 'gray';
}

export default function HealthcareProviderPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState<Record<string, Appointment[]>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Modals
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showBookAppt, setShowBookAppt] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [showComplete, setShowComplete] = useState<Appointment | null>(null);
  const [expandPatient, setExpandPatient] = useState<number | null>(null);
  const [expandedPatientData, setExpandedPatientData] = useState<{ appointments: Appointment[]; claims: Claim[]; patient: Patient } | null>(null);

  // Filters
  const [apptFilter, setApptFilter] = useState({ status: '', service_type: '', provider: '' });
  const [claimFilter, setClaimFilter] = useState({ insurer: '', status: '' });
  const [patientSearch, setPatientSearch] = useState('');

  // AI Intake
  const [intakeForm, setIntakeForm] = useState({ symptoms: '', age: '', existing_conditions: '' });
  const [intakeResult, setIntakeResult] = useState('');
  const [intakeLoading, setIntakeLoading] = useState(false);

  // Forms
  const [patientForm, setPatientForm] = useState({ name: '', email: '', phone: '', date_of_birth: '', health_card_number: '', province: 'AB', alberta_health_number: '', emergency_contact: '', emergency_phone: '', allergies: '', medications: '', conditions: '', insurance_provider: '', insurance_policy_number: '', insurance_group_number: '', preferred_provider: '', notes: '' });
  const [apptForm, setApptForm] = useState({ patient_id: '', provider_name: '', service_type: '', appointment_date: '', duration_minutes: '30', notes: '' });
  const [claimForm, setClaimForm] = useState({ patient_id: '', appointment_id: '', insurer: '', policy_number: '', claim_amount: '', notes: '' });
  const [completeForm, setCompleteForm] = useState({ treatment_notes: '', fee: '', insurance_covered: '', patient_paid: '', follow_up_required: false, follow_up_date: '' });

  const fetchDash = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/healthcare-provider');
    const d = await r.json();
    setDash(d);
    setLoading(false);
  }, []);

  const fetchPatients = useCallback(async () => {
    const q = patientSearch ? `&q=${encodeURIComponent(patientSearch)}` : '';
    const r = await fetch(`/api/admin/healthcare-provider/patients?${q}`);
    const d = await r.json();
    setPatients(d.patients || []);
  }, [patientSearch]);

  const fetchAppointments = useCallback(async () => {
    const p = new URLSearchParams();
    if (apptFilter.status) p.set('status', apptFilter.status);
    if (apptFilter.service_type) p.set('service_type', apptFilter.service_type);
    if (apptFilter.provider) p.set('provider', apptFilter.provider);
    const r = await fetch(`/api/admin/healthcare-provider/appointments?${p}`);
    const d = await r.json();
    setAppointments(d.appointments || []);
  }, [apptFilter]);

  const fetchClaims = useCallback(async () => {
    const p = new URLSearchParams();
    if (claimFilter.insurer) p.set('insurer', claimFilter.insurer);
    if (claimFilter.status) p.set('status', claimFilter.status);
    const r = await fetch(`/api/admin/healthcare-provider/claims?${p}`);
    const d = await r.json();
    setClaims(d.claims || []);
  }, [claimFilter]);

  const fetchSchedule = useCallback(async () => {
    const r = await fetch(`/api/admin/healthcare-provider/schedule?date=${scheduleDate}`);
    const d = await r.json();
    setSchedule(d.schedule || {});
  }, [scheduleDate]);

  useEffect(() => { fetchDash(); }, [fetchDash]);
  useEffect(() => { if (tab === 'Patients') fetchPatients(); }, [tab, fetchPatients]);
  useEffect(() => { if (tab === 'Appointments') fetchAppointments(); }, [tab, fetchAppointments]);
  useEffect(() => { if (tab === 'Insurance Claims') fetchClaims(); }, [tab, fetchClaims]);
  useEffect(() => { if (tab === 'Schedule') fetchSchedule(); }, [tab, fetchSchedule, scheduleDate]);

  async function expandPatientDetail(id: number) {
    if (expandPatient === id) { setExpandPatient(null); return; }
    setExpandPatient(id);
    const r = await fetch(`/api/admin/healthcare-provider/patients/${id}`);
    const d = await r.json();
    setExpandedPatientData(d);
  }

  async function createPatient() {
    const body = { ...patientForm, allergies: patientForm.allergies.split(',').map(s => s.trim()).filter(Boolean), medications: patientForm.medications.split(',').map(s => s.trim()).filter(Boolean), conditions: patientForm.conditions.split(',').map(s => s.trim()).filter(Boolean) };
    const r = await fetch('/api/admin/healthcare-provider/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { setMsg('Patient added.'); setShowAddPatient(false); fetchPatients(); }
    else { const d = await r.json(); setMsg(d.error || 'Error'); }
  }

  async function bookAppointment() {
    const r = await fetch('/api/admin/healthcare-provider/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...apptForm, patient_id: Number(apptForm.patient_id), duration_minutes: Number(apptForm.duration_minutes) }) });
    if (r.ok) { setMsg('Appointment booked.'); setShowBookAppt(false); fetchSchedule(); fetchAppointments(); }
    else { const d = await r.json(); setMsg(d.error || 'Error'); }
  }

  async function submitClaim() {
    const r = await fetch('/api/admin/healthcare-provider/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...claimForm, patient_id: Number(claimForm.patient_id), claim_amount: Number(claimForm.claim_amount) }) });
    if (r.ok) { setMsg('Claim submitted.'); setShowClaim(false); fetchClaims(); fetchDash(); }
    else { const d = await r.json(); setMsg(d.error || 'Error'); }
  }

  async function completeAppointment() {
    if (!showComplete) return;
    const r = await fetch(`/api/admin/healthcare-provider/appointments/${showComplete.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...completeForm, fee: Number(completeForm.fee), insurance_covered: Number(completeForm.insurance_covered), patient_paid: Number(completeForm.patient_paid) }) });
    if (r.ok) { setMsg('Appointment completed.'); setShowComplete(null); fetchAppointments(); fetchDash(); }
    else { const d = await r.json(); setMsg(d.error || 'Error'); }
  }

  async function updateClaimStatus(id: number, action: string) {
    const r = await fetch(`/api/admin/healthcare-provider/claims/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (r.ok) { setMsg(`Claim ${action}d.`); fetchClaims(); fetchDash(); }
  }

  async function cancelAppointment(id: number) {
    await fetch(`/api/admin/healthcare-provider/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
    setMsg('Appointment cancelled.'); fetchAppointments(); fetchSchedule();
  }

  async function runIntake() {
    setIntakeLoading(true);
    setIntakeResult('');
    const r = await fetch('/api/admin/healthcare-provider/ai-intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symptoms: intakeForm.symptoms, age: Number(intakeForm.age) || undefined, existing_conditions: intakeForm.existing_conditions.split(',').map(s => s.trim()).filter(Boolean) }) });
    const d = await r.json();
    setIntakeResult(d.result || 'No response');
    setIntakeLoading(false);
  }

  const fmt = (s: string) => new Date(s).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' });
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-CA') : '—';
  const fmtCad = (v?: string | number) => v ? `$${Number(v).toFixed(2)}` : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Healthcare Provider Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Canadian clinic management — clinics, chiro, physio, dental, optometry, psychology, naturopathy, massage</p>
      </div>

      {msg && (
        <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 flex justify-between">
          {msg} <button onClick={() => setMsg('')} className="text-blue-600 font-bold">×</button>
        </div>
      )}

      <div className="px-6 mt-4 flex gap-1 flex-wrap border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-t ${tab === t ? 'bg-white border border-b-white text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            {loading && <p className="text-sm text-gray-400">Loading…</p>}
            {dash && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Active Patients" value={dash.stats.active_patients} color="blue" />
                  <KpiCard label="Today's Appointments" value={dash.stats.today_appointments} color="green" />
                  <KpiCard label="Revenue Today" value={fmtCad(dash.stats.revenue_today)} color="amber" />
                  <KpiCard label="Pending Claims" value={fmtCad(dash.stats.pending_claims_value)} sub={`${dash.pendingClaims?.cnt || 0} claims`} color="rose" />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Today's Schedule</h3>
                    {dash.todayAppointments.length === 0 ? <p className="text-sm text-gray-400">No appointments today</p> : (
                      <div className="space-y-2">
                        {dash.todayAppointments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <div className="text-sm font-medium text-gray-800">{a.patient_name}</div>
                              <div className="text-xs text-gray-500">{fmt(a.appointment_date)} · {a.service_type.replace(/_/g, ' ')} · {a.provider_name || 'TBD'}</div>
                            </div>
                            <Badge text={a.status} color={statusColor(a.status)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Follow-ups Due (Next 7 Days)</h3>
                    {dash.followUps.length === 0 ? <p className="text-sm text-gray-400">No upcoming follow-ups</p> : (
                      <div className="space-y-2">
                        {dash.followUps.map(f => (
                          <div key={f.id} className="flex justify-between p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-sm font-medium text-gray-800">{f.patient_name}</div>
                            <div className="text-xs text-gray-500">{fmtDate(f.follow_up_date)} · {f.provider_name || 'TBD'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PATIENTS */}
        {tab === 'Patients' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search name, email, health card…" className="border rounded px-3 py-2 text-sm w-64" />
              <button onClick={fetchPatients} className="px-3 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200">Search</button>
              <button onClick={() => setShowAddPatient(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Patient</button>
            </div>

            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','DOB','Health Card','Insurance','Last Visit','Provider','Status',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <>
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}<div className="text-xs text-gray-400">{p.email}</div></td>
                        <td className="px-4 py-3 text-gray-600">{p.date_of_birth ? fmtDate(p.date_of_birth) : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.health_card_number || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.insurance_provider || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.last_visit ? fmtDate(p.last_visit) : 'Never'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.preferred_provider || '—'}</td>
                        <td className="px-4 py-3"><Badge text={p.status} color={statusColor(p.status)} /></td>
                        <td className="px-4 py-3">
                          <button onClick={() => expandPatientDetail(p.id)} className="text-blue-600 text-xs hover:underline">{expandPatient === p.id ? 'Collapse' : 'Expand'}</button>
                        </td>
                      </tr>
                      {expandPatient === p.id && expandedPatientData && (
                        <tr key={`${p.id}-expand`}>
                          <td colSpan={8} className="px-4 py-4 bg-blue-50">
                            <div className="grid md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="font-medium text-gray-700 mb-2">Conditions & Allergies</div>
                                <div className="text-xs text-gray-600">Conditions: {expandedPatientData.patient.conditions?.join(', ') || 'None'}</div>
                                <div className="text-xs text-gray-600">Allergies: {expandedPatientData.patient.allergies?.join(', ') || 'None'}</div>
                                <div className="text-xs text-gray-600">Medications: {expandedPatientData.patient.medications?.join(', ') || 'None'}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-700 mb-2">Recent Appointments ({expandedPatientData.appointments.length})</div>
                                {expandedPatientData.appointments.slice(0,3).map(a => (
                                  <div key={a.id} className="text-xs text-gray-600 mb-1">{fmtDate(a.appointment_date)} — {a.service_type.replace(/_/g,' ')} <Badge text={a.status} color={statusColor(a.status)} /></div>
                                ))}
                              </div>
                              <div>
                                <div className="font-medium text-gray-700 mb-2">Claims ({expandedPatientData.claims.length})</div>
                                {expandedPatientData.claims.slice(0,3).map(c => (
                                  <div key={c.id} className="text-xs text-gray-600 mb-1">{c.insurer} — {fmtCad(c.claim_amount)} <Badge text={c.status} color={statusColor(c.status)} /></div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {patients.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No patients found</p>}
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {tab === 'Schedule' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
              <button onClick={fetchSchedule} className="px-3 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200">View</button>
              <button onClick={() => setShowBookAppt(true)} className="ml-auto px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">+ Book Appointment</button>
            </div>

            {Object.keys(schedule).length === 0 ? (
              <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">No appointments scheduled for {scheduleDate}</div>
            ) : (
              Object.entries(schedule).map(([provider, appts]) => (
                <div key={provider} className="bg-white rounded-lg border">
                  <div className="px-4 py-3 border-b bg-gray-50 font-medium text-gray-800">{provider}</div>
                  <div className="divide-y">
                    {(appts as Appointment[]).map(a => (
                      <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{a.patient_name}</div>
                          <div className="text-xs text-gray-500">{fmt(a.appointment_date)} · {a.duration_minutes}min · {a.service_type.replace(/_/g,' ')}</div>
                          {a.notes && <div className="text-xs text-gray-400 mt-0.5">{a.notes}</div>}
                        </div>
                        <Badge text={a.status} color={statusColor(a.status)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'Appointments' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <select value={apptFilter.status} onChange={e => setApptFilter(f => ({ ...f, status: e.target.value }))} className="border rounded px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {['scheduled','confirmed','arrived','completed','no_show','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={apptFilter.service_type} onChange={e => setApptFilter(f => ({ ...f, service_type: e.target.value }))} className="border rounded px-3 py-2 text-sm">
                <option value="">All Services</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <input value={apptFilter.provider} onChange={e => setApptFilter(f => ({ ...f, provider: e.target.value }))} placeholder="Provider name…" className="border rounded px-3 py-2 text-sm w-44" />
              <button onClick={fetchAppointments} className="px-3 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200">Filter</button>
            </div>

            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Provider','Service','Date','Duration','Status','Fees','Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.patient_name}<div className="text-xs text-gray-400">{a.patient_phone}</div></td>
                      <td className="px-4 py-3 text-gray-600">{a.provider_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{a.service_type.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(a.appointment_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{a.duration_minutes}min</td>
                      <td className="px-4 py-3"><Badge text={a.status} color={statusColor(a.status)} /></td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.status === 'completed' ? (
                          <div className="text-xs">
                            <div>Fee: {fmtCad(a.fee)}</div>
                            <div>Ins: {fmtCad(a.insurance_covered)}</div>
                            <div>Paid: {fmtCad(a.patient_paid)}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 flex gap-1 flex-wrap">
                        {a.status === 'scheduled' || a.status === 'confirmed' ? (
                          <>
                            <button onClick={() => { setShowComplete(a); setCompleteForm({ treatment_notes: '', fee: '', insurance_covered: '', patient_paid: '', follow_up_required: false, follow_up_date: '' }); }} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200">Complete</button>
                            <button onClick={() => cancelAppointment(a.id)} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200">Cancel</button>
                          </>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {appointments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No appointments</p>}
            </div>
          </div>
        )}

        {/* INSURANCE CLAIMS */}
        {tab === 'Insurance Claims' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <select value={claimFilter.insurer} onChange={e => setClaimFilter(f => ({ ...f, insurer: e.target.value }))} className="border rounded px-3 py-2 text-sm">
                <option value="">All Insurers</option>
                {INSURERS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={claimFilter.status} onChange={e => setClaimFilter(f => ({ ...f, status: e.target.value }))} className="border rounded px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={fetchClaims} className="px-3 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200">Filter</button>
              <button onClick={() => setShowClaim(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Submit Claim</button>
            </div>

            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Insurer','Policy #','Claimed','Approved','Status','Submitted','Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {claims.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.patient_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.insurer || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.policy_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtCad(c.claim_amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtCad(c.approved_amount)}</td>
                      <td className="px-4 py-3"><Badge text={c.status} color={statusColor(c.status)} /></td>
                      <td className="px-4 py-3 text-gray-600">{c.submitted_date ? fmtDate(c.submitted_date) : '—'}</td>
                      <td className="px-4 py-3 flex gap-1 flex-wrap">
                        {c.status === 'submitted' && <button onClick={() => updateClaimStatus(c.id, 'approve')} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Approve</button>}
                        {c.status === 'approved' && <button onClick={() => updateClaimStatus(c.id, 'paid')} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Mark Paid</button>}
                        {c.status === 'pending' && <button onClick={() => updateClaimStatus(c.id, 'submit')} className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Submit</button>}
                        {['pending','submitted'].includes(c.status) && <button onClick={() => updateClaimStatus(c.id, 'reject')} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Reject</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {claims.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No claims</p>}
            </div>
          </div>
        )}

        {/* AI INTAKE ASSISTANT */}
        {tab === 'AI Intake Assistant' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">AI Patient Intake Assessment</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Presenting Symptoms *</label>
                  <textarea value={intakeForm.symptoms} onChange={e => setIntakeForm(f => ({ ...f, symptoms: e.target.value }))} rows={3} placeholder="Describe the patient's chief complaint and symptoms…" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Patient Age</label>
                    <input value={intakeForm.age} onChange={e => setIntakeForm(f => ({ ...f, age: e.target.value }))} type="number" placeholder="e.g. 45" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Existing Conditions (comma-separated)</label>
                    <input value={intakeForm.existing_conditions} onChange={e => setIntakeForm(f => ({ ...f, existing_conditions: e.target.value }))} placeholder="diabetes, hypertension…" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <button onClick={runIntake} disabled={intakeLoading || !intakeForm.symptoms} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                  {intakeLoading ? 'Analyzing…' : 'Generate Intake Assessment'}
                </button>
              </div>
            </div>

            {intakeResult && (
              <div className="bg-white rounded-lg border p-5">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">AI Intake Assessment</h3>
                  <button onClick={() => setShowBookAppt(true)} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Create Appointment</button>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{intakeResult}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD PATIENT MODAL */}
      {showAddPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Patient</h3>
              <button onClick={() => setShowAddPatient(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['name','Full Name *'],['email','Email'],['phone','Phone'],['date_of_birth','Date of Birth'],['health_card_number','Health Card #'],['alberta_health_number','Alberta Health Number (AHN)'],['emergency_contact','Emergency Contact'],['emergency_phone','Emergency Phone'],['insurance_provider','Insurance Provider'],['insurance_policy_number','Policy #'],['insurance_group_number','Group #'],['preferred_provider','Preferred Provider']].map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                  <input value={(patientForm as Record<string,string>)[k]} onChange={e => setPatientForm(f => ({ ...f, [k]: e.target.value }))} type={k === 'date_of_birth' ? 'date' : 'text'} className="w-full border rounded px-3 py-1.5 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
                <select value={patientForm.province} onChange={e => setPatientForm(f => ({ ...f, province: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Allergies (comma-separated)</label>
                <input value={patientForm.allergies} onChange={e => setPatientForm(f => ({ ...f, allergies: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Medications (comma-separated)</label>
                <input value={patientForm.medications} onChange={e => setPatientForm(f => ({ ...f, medications: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Medical Conditions (comma-separated)</label>
                <input value={patientForm.conditions} onChange={e => setPatientForm(f => ({ ...f, conditions: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={patientForm.notes} onChange={e => setPatientForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddPatient(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={createPatient} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add Patient</button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK APPOINTMENT MODAL */}
      {showBookAppt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900">Book Appointment</h3>
              <button onClick={() => setShowBookAppt(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Patient ID *</label>
                <input value={apptForm.patient_id} onChange={e => setApptForm(f => ({ ...f, patient_id: e.target.value }))} placeholder="Enter patient ID" className="w-full border rounded px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-0.5">Look up patient ID from the Patients tab</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider Name</label>
                <input value={apptForm.provider_name} onChange={e => setApptForm(f => ({ ...f, provider_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Type *</label>
                <select value={apptForm.service_type} onChange={e => setApptForm(f => ({ ...f, service_type: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time *</label>
                <input type="datetime-local" value={apptForm.appointment_date} onChange={e => setApptForm(f => ({ ...f, appointment_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes)</label>
                <select value={apptForm.duration_minutes} onChange={e => setApptForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  {[15,20,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowBookAppt(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={bookAppointment} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">Book</button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT CLAIM MODAL */}
      {showClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900">Submit Insurance Claim</h3>
              <button onClick={() => setShowClaim(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3 text-sm">
              {[['patient_id','Patient ID *'],['appointment_id','Appointment ID'],['policy_number','Policy #'],['claim_amount','Claim Amount ($) *']].map(([k,lbl]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                  <input value={(claimForm as Record<string,string>)[k]} onChange={e => setClaimForm(f => ({ ...f, [k]: e.target.value }))} type={k === 'claim_amount' ? 'number' : 'text'} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Insurer</label>
                <select value={claimForm.insurer} onChange={e => setClaimForm(f => ({ ...f, insurer: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {INSURERS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={claimForm.notes} onChange={e => setClaimForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowClaim(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={submitClaim} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Submit Claim</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE APPOINTMENT MODAL */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900">Complete Appointment</h3>
              <button onClick={() => setShowComplete(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Patient: <strong>{showComplete.patient_name}</strong> · {showComplete.service_type.replace(/_/g,' ')}</p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Notes</label>
                <textarea value={completeForm.treatment_notes} onChange={e => setCompleteForm(f => ({ ...f, treatment_notes: e.target.value }))} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[['fee','Total Fee ($)'],['insurance_covered','Insurance ($)'],['patient_paid','Patient Paid ($)']].map(([k,lbl]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                    <input value={(completeForm as Record<string,string|boolean>)[k] as string} onChange={e => setCompleteForm(f => ({ ...f, [k]: e.target.value }))} type="number" step="0.01" className="w-full border rounded px-3 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fu" checked={completeForm.follow_up_required} onChange={e => setCompleteForm(f => ({ ...f, follow_up_required: e.target.checked }))} />
                <label htmlFor="fu" className="text-xs font-medium text-gray-600">Follow-up Required</label>
              </div>
              {completeForm.follow_up_required && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
                  <input type="date" value={completeForm.follow_up_date} onChange={e => setCompleteForm(f => ({ ...f, follow_up_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowComplete(null)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={completeAppointment} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
