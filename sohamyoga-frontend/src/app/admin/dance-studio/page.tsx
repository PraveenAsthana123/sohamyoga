'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'students', 'classes', 'instructors', 'exams', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', students: 'Students', classes: 'Classes', instructors: 'Instructors', exams: 'Exams', ai: 'AI Tools' };

interface DashData { total_students: number; active_classes: number; enrollment_this_month: number; recital_registrations: number; revenue_mtd: number; costume_deposits_collected: number; }
interface Student { id: number; first_name: string; last_name: string; dance_styles: string[]; current_level: string; exam_track: boolean; competition_team: boolean; liability_waiver_signed: boolean; parent_name: string; parent_email: string; parent_phone: string; status: string; }
interface DanceClass { id: number; name: string; dance_style: string; level: string; instructor_name: string; day_of_week: string; start_time: string; end_time: string; current_enrollment: number; max_capacity: number; monthly_fee: number; term: string; is_active: boolean; }
interface Instructor { id: number; name: string; email: string; dance_styles: string[]; certifications: string[]; years_experience: number; employment_type: string; vulnerable_sector_check_date: string; status: string; }
interface Exam { id: number; student_name: string; exam_type: string; exam_level: string; exam_date: string; result: string; mark_pct: number; examiner_name: string; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtTime(t: string) { return t ? t.slice(0, 5) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', gold: 'bg-yellow-100 text-yellow-700', silver: 'bg-slate-100 text-slate-600', pink: 'bg-pink-100 text-pink-700' };
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

function styleColor(s: string): string {
  const m: Record<string, string> = { ballet: 'purple', jazz: 'pink', tap: 'amber', contemporary: 'teal', hip_hop: 'blue', lyrical: 'green', acrobatics: 'orange', ballroom: 'gold', competitive: 'red' };
  return m[s] ?? 'gray';
}

function examResultColor(r: string): string {
  return { distinction: 'gold', merit: 'silver', pass: 'green', fail: 'red', pending: 'gray' }[r] ?? 'gray';
}

export default function DanceStudioPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<DanceClass[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // AI state
  const [aiStyle, setAiStyle] = useState('ballet');
  const [aiLevel, setAiLevel] = useState('primary');
  const [aiAgeGroup, setAiAgeGroup] = useState('6-8 years');
  const [aiDesc, setAiDesc] = useState('');
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [aiRecitalNotes, setAiRecitalNotes] = useState('');
  const [aiRecitalLoading, setAiRecitalLoading] = useState(false);
  const [recitalInput, setRecitalInput] = useState('');

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/admin/dance-studio');
    setDashboard(await res.json());
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (studentSearch) params.set('search', studentSearch);
    const res = await fetch(`/api/admin/dance-studio/students?${params}`);
    const d = await res.json();
    setStudents(d.students ?? []);
    setLoading(false);
  }, [studentSearch]);

  const loadClasses = useCallback(async () => {
    const res = await fetch('/api/admin/dance-studio/classes');
    const d = await res.json();
    setClasses(d.classes ?? []);
  }, []);

  const loadInstructors = useCallback(async () => {
    const res = await fetch('/api/admin/dance-studio/instructors');
    const d = await res.json();
    setInstructors(d.instructors ?? []);
  }, []);

  const loadExams = useCallback(async () => {
    const res = await fetch('/api/admin/dance-studio/exams');
    const d = await res.json();
    setExams(d.exams ?? []);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'students') loadStudents(); }, [tab, loadStudents]);
  useEffect(() => { if (tab === 'classes') loadClasses(); }, [tab, loadClasses]);
  useEffect(() => { if (tab === 'instructors') loadInstructors(); }, [tab, loadInstructors]);
  useEffect(() => { if (tab === 'exams') loadExams(); }, [tab, loadExams]);

  async function generateClassDesc() {
    setAiDescLoading(true); setAiDesc('');
    try {
      const res = await fetch('/api/admin/dance-studio/ai-class-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style: aiStyle, level: aiLevel, age_group: aiAgeGroup }) });
      const d = await res.json();
      setAiDesc(d.description ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiDesc(String(e)); } finally { setAiDescLoading(false); }
  }

  async function generateRecitalNotes() {
    setAiRecitalLoading(true); setAiRecitalNotes('');
    try {
      const res = await fetch('/api/admin/dance-studio/ai-recital-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recital_info: recitalInput }) });
      const d = await res.json();
      setAiRecitalNotes(d.notes ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiRecitalNotes(String(e)); } finally { setAiRecitalLoading(false); }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Dance Studio Management Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Students · Classes · Instructors · Exams · Recitals · AI Tools</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Total Students" value={dashboard.total_students} color="purple" />
                <KpiCard label="Active Classes" value={dashboard.active_classes} color="blue" />
                <KpiCard label="Enrolled This Month" value={dashboard.enrollment_this_month} color="green" />
                <KpiCard label="Recital Registrations" value={dashboard.recital_registrations} color="teal" />
                <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="amber" />
                <KpiCard label="Costume Deposits" value={fmtCad(dashboard.costume_deposits_collected)} color="red" />
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading dashboard…</p>
            )}
          </div>
        )}

        {/* STUDENTS */}
        {tab === 'students' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input className="border rounded px-3 py-2 text-sm flex-1 min-w-48" placeholder="Search by name…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadStudents()} />
              <button onClick={loadStudents} className="px-3 py-2 text-sm bg-gray-100 rounded">Search</button>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name', 'Dance Styles', 'Level', 'Exam Track', 'Competition', 'Waiver', 'Parent Contact'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(s.dance_styles ?? []).map(style => <Badge key={style} label={style.replace('_', ' ')} color={styleColor(style)} />)}
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge label={s.current_level ?? '—'} color="blue" /></td>
                        <td className="px-4 py-3">{s.exam_track ? <Badge label="Exam Track" color="gold" /> : <span className="text-gray-400 text-xs">—</span>}</td>
                        <td className="px-4 py-3">{s.competition_team ? <Badge label="Competition" color="purple" /> : <span className="text-gray-400 text-xs">—</span>}</td>
                        <td className="px-4 py-3">{s.liability_waiver_signed ? <span className="text-green-600 font-medium">✓ Signed</span> : <span className="text-red-500 font-medium">✗ Missing</span>}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          <div>{s.parent_name}</div>
                          <div>{s.parent_email}</div>
                          <div>{s.parent_phone}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No students found.</p>}
              </div>
            )}
          </div>
        )}

        {/* CLASSES */}
        {tab === 'classes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => {
              const pct = c.max_capacity > 0 ? Math.min(100, Math.round((c.current_enrollment / c.max_capacity) * 100)) : 0;
              return (
                <div key={c.id} className="bg-white rounded-xl border p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge label={c.dance_style?.replace('_', ' ') ?? '—'} color={styleColor(c.dance_style)} />
                  </div>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Badge label={c.level ?? '—'} color="blue" />
                    <Badge label={c.term ?? '—'} color="teal" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">Instructor: {c.instructor_name ?? '—'}</p>
                  <p className="text-sm text-gray-500 mb-1">{c.day_of_week ? c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1) : '—'} · {fmtTime(c.start_time)}–{fmtTime(c.end_time)}</p>
                  <p className="text-sm text-gray-500 mb-3">Monthly Fee: {c.monthly_fee ? fmtCad(c.monthly_fee) : '—'}</p>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Enrollment</span><span>{c.current_enrollment}/{c.max_capacity}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              );
            })}
            {classes.length === 0 && <p className="text-center text-gray-400 py-8 text-sm col-span-3">No classes found.</p>}
          </div>
        )}

        {/* INSTRUCTORS */}
        {tab === 'instructors' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name', 'Dance Styles', 'Certifications', 'Employment', 'VSC Date', 'Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {instructors.map(i => {
                  const vscDate = i.vulnerable_sector_check_date ? new Date(i.vulnerable_sector_check_date) : null;
                  const vscExpired = vscDate ? (new Date().getTime() - vscDate.getTime()) > (3 * 365 * 24 * 60 * 60 * 1000) : false;
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{i.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(i.dance_styles ?? []).map(s => <Badge key={s} label={s.replace('_', ' ')} color={styleColor(s)} />)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(i.certifications ?? []).map(c => <Badge key={c} label={c} color="purple" />)}
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge label={i.employment_type} color="blue" /></td>
                      <td className="px-4 py-3">
                        {vscDate ? (
                          <span className={vscExpired ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {fmtDate(i.vulnerable_sector_check_date)} {vscExpired && '⚠ Expired'}
                          </span>
                        ) : <span className="text-red-500">⚠ Not on file</span>}
                      </td>
                      <td className="px-4 py-3"><Badge label={i.status} color={i.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {instructors.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No instructors found.</p>}
          </div>
        )}

        {/* EXAMS */}
        {tab === 'exams' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Student', 'Exam Type', 'Level', 'Date', 'Examiner', 'Mark %', 'Result'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {exams.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.student_name}</td>
                    <td className="px-4 py-3"><Badge label={e.exam_type} color="purple" /></td>
                    <td className="px-4 py-3 text-gray-500">{e.exam_level ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(e.exam_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{e.examiner_name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{e.mark_pct != null ? `${e.mark_pct}%` : '—'}</td>
                    <td className="px-4 py-3"><Badge label={e.result} color={examResultColor(e.result)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exams.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No exam records found.</p>}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class Description Generator */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Class Description Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate a marketing description for a dance class based on style, level, and age group.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Dance Style</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiStyle} onChange={e => setAiStyle(e.target.value)}>
                    {['ballet', 'jazz', 'tap', 'contemporary', 'hip_hop', 'lyrical', 'acrobatics', 'ballroom', 'competitive'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Level</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiLevel} onChange={e => setAiLevel(e.target.value)}>
                    {['preschool', 'primary', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'advanced', 'adult', 'beginner'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Age Group</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiAgeGroup} onChange={e => setAiAgeGroup(e.target.value)} placeholder="e.g. 6-8 years, teens, adults…" />
                </div>
              </div>
              <button onClick={generateClassDesc} disabled={aiDescLoading} className="w-full py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiDescLoading ? 'Generating…' : 'Generate Class Description'}</button>
              {aiDesc && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">Generated Description</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiDesc)} className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiDesc}</p>
                </div>
              )}
            </div>

            {/* Recital Program Notes Generator */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Recital Program Notes Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate program notes for a recital piece or performance.</p>
              <div className="mb-4">
                <label className="text-xs text-gray-500">Recital / Performance Details</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm mt-1" rows={5} value={recitalInput} onChange={e => setRecitalInput(e.target.value)} placeholder="Describe the piece, dancers, choreography, music, theme…" />
              </div>
              <button onClick={generateRecitalNotes} disabled={aiRecitalLoading || !recitalInput.trim()} className="w-full py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiRecitalLoading ? 'Generating…' : 'Generate Program Notes'}</button>
              {aiRecitalNotes && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">Generated Notes</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiRecitalNotes)} className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiRecitalNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
