'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'members', 'classes', 'belt-tests', 'instructors', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', members: 'Members', classes: 'Classes', 'belt-tests': 'Belt Tests', instructors: 'Instructors', ai: 'AI Tools' };

interface DashData { total_members: number; active_memberships: number; classes_today: number; belt_tests_this_month: number; revenue_mtd: number; expiring_memberships_30d: number; }
interface Member { id: number; first_name: string; last_name: string; email: string; phone: string; discipline: string; belt_rank: string; stripes: number; membership_expiry: string; competition_team: boolean; waiver_signed: boolean; membership_status: string; }
interface MartialClass { id: number; name: string; discipline: string; level: string; day_of_week: string; start_time: string; end_time: string; class_type: string; current_enrollment: number; max_capacity: number; instructor_name: string; }
interface BeltTest { id: number; member_name: string; current_rank: string; testing_for_rank: string; test_date: string; result: string; requirements_met: string[]; promotion_date: string; notes: string; }
interface Instructor { id: number; name: string; email: string; disciplines: string[]; highest_rank: string; first_aid_cert_expiry: string; vulnerable_sector_check_date: string; employment_type: string; status: string; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtTime(t: string) { return t ? t.slice(0, 5) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', yellow: 'bg-yellow-100 text-yellow-700', slate: 'bg-slate-100 text-slate-600', indigo: 'bg-indigo-100 text-indigo-700' };
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

function disciplineColor(d: string): string {
  const m: Record<string, string> = { bjj: 'blue', muay_thai: 'red', wrestling: 'amber', boxing: 'orange', karate: 'purple', judo: 'indigo', mma: 'teal', kickboxing: 'green', taekwondo: 'yellow' };
  return m[d] ?? 'gray';
}

function classTypeColor(t: string): string {
  return { gi: 'blue', no_gi: 'teal', striking: 'red', grappling: 'purple', sparring: 'orange', conditioning: 'green' }[t] ?? 'gray';
}

function beltResultColor(r: string): string {
  return { pass: 'green', fail: 'red', pending: 'gray' }[r] ?? 'gray';
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function MartialArtsPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [classes, setClasses] = useState<MartialClass[]>([]);
  const [beltTests, setBeltTests] = useState<BeltTest[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // AI state
  const [aiDiscipline, setAiDiscipline] = useState('bjj');
  const [aiRank, setAiRank] = useState('white belt');
  const [aiGoals, setAiGoals] = useState('improve guard retention and submissions');
  const [aiPlan, setAiPlan] = useState('');
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiCurriculumDiscipline, setAiCurriculumDiscipline] = useState('muay_thai');
  const [aiCurriculumLevel, setAiCurriculumLevel] = useState('beginner');
  const [aiCurriculum, setAiCurriculum] = useState('');
  const [aiCurriculumLoading, setAiCurriculumLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/admin/martial-arts');
    const d = await res.json();
    setDashboard(d);
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (memberSearch) params.set('search', memberSearch);
    const res = await fetch(`/api/admin/martial-arts/members?${params}`);
    const d = await res.json();
    setMembers(d.members ?? []);
    setLoading(false);
  }, [memberSearch]);

  const loadClasses = useCallback(async () => {
    const res = await fetch('/api/admin/martial-arts/classes');
    const d = await res.json();
    setClasses(d.classes ?? []);
  }, []);

  const loadBeltTests = useCallback(async () => {
    const res = await fetch('/api/admin/martial-arts/belt-tests');
    const d = await res.json();
    setBeltTests(d.belt_tests ?? d.tests ?? []);
  }, []);

  const loadInstructors = useCallback(async () => {
    const res = await fetch('/api/admin/martial-arts/instructors');
    const d = await res.json();
    setInstructors(d.instructors ?? []);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab, loadMembers]);
  useEffect(() => { if (tab === 'classes') loadClasses(); }, [tab, loadClasses]);
  useEffect(() => { if (tab === 'belt-tests') loadBeltTests(); }, [tab, loadBeltTests]);
  useEffect(() => { if (tab === 'instructors') loadInstructors(); }, [tab, loadInstructors]);

  async function generateTrainingPlan() {
    setAiPlanLoading(true); setAiPlan('');
    try {
      const res = await fetch('/api/admin/martial-arts/ai-training-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discipline: aiDiscipline, belt_rank: aiRank, goals: aiGoals }) });
      const d = await res.json();
      setAiPlan(d.plan ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiPlan(String(e)); } finally { setAiPlanLoading(false); }
  }

  async function generateCurriculum() {
    setAiCurriculumLoading(true); setAiCurriculum('');
    try {
      const res = await fetch('/api/admin/martial-arts/ai-class-curriculum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discipline: aiCurriculumDiscipline, level: aiCurriculumLevel }) });
      const d = await res.json();
      setAiCurriculum(d.curriculum ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiCurriculum(String(e)); } finally { setAiCurriculumLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Martial Arts & MMA Gym Management</h1>
        <p className="text-sm text-gray-500 mt-1">Members · Classes · Belt Tests · Instructors · AI Training Tools</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Total Members" value={dashboard.total_members} color="blue" />
                <KpiCard label="Active Memberships" value={dashboard.active_memberships} color="green" />
                <KpiCard label="Classes Today" value={dashboard.classes_today} color="purple" />
                <KpiCard label="Belt Tests This Month" value={dashboard.belt_tests_this_month} color="amber" />
                <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="teal" />
                <KpiCard label="Expiring in 30d" value={dashboard.expiring_memberships_30d} color="red" />
              </div>
            ) : <p className="text-sm text-gray-400">Loading dashboard…</p>}
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input className="border rounded px-3 py-2 text-sm flex-1 min-w-48" placeholder="Search by name or email…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMembers()} />
              <button onClick={loadMembers} className="px-3 py-2 text-sm bg-gray-100 rounded">Search</button>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name', 'Discipline', 'Belt Rank', 'Membership Expiry', 'Competition', 'Waiver'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {members.map(m => {
                      const days = daysUntil(m.membership_expiry);
                      return (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{m.first_name} {m.last_name}<div className="text-xs text-gray-400">{m.email}</div></td>
                          <td className="px-4 py-3"><Badge label={m.discipline?.replace('_', ' ') ?? '—'} color={disciplineColor(m.discipline)} /></td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{m.belt_rank ?? '—'}</span>
                            {m.stripes > 0 && <span className="ml-1 text-xs text-amber-600">({m.stripes} stripe{m.stripes !== 1 ? 's' : ''})</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={days <= 30 ? 'text-red-600 font-medium' : days <= 60 ? 'text-amber-600' : 'text-gray-500'}>{fmtDate(m.membership_expiry)}</span>
                            {days <= 30 && <span className="ml-1 text-xs text-red-500">({days}d)</span>}
                          </td>
                          <td className="px-4 py-3">{m.competition_team ? <Badge label="Team" color="red" /> : <span className="text-gray-400 text-xs">—</span>}</td>
                          <td className="px-4 py-3">{m.waiver_signed ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {members.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No members found.</p>}
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
                    <Badge label={c.discipline?.replace('_', ' ') ?? '—'} color={disciplineColor(c.discipline)} />
                  </div>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Badge label={c.level ?? '—'} color="blue" />
                    <Badge label={c.class_type?.replace('_', '-') ?? '—'} color={classTypeColor(c.class_type)} />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">Instructor: {c.instructor_name ?? '—'}</p>
                  <p className="text-sm text-gray-500 mb-3">{c.day_of_week ? c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1) : '—'} · {fmtTime(c.start_time)}–{fmtTime(c.end_time)}</p>
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

        {/* BELT TESTS */}
        {tab === 'belt-tests' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Member', 'Current Rank', 'Testing For', 'Test Date', 'Requirements', 'Result', 'Promotion Date'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {beltTests.map(bt => (
                  <tr key={bt.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{bt.member_name}</td>
                    <td className="px-4 py-3 text-gray-600">{bt.current_rank ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{bt.testing_for_rank ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(bt.test_date)}</td>
                    <td className="px-4 py-3">
                      {(bt.requirements_met ?? []).length > 0 ? (
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          {bt.requirements_met.slice(0, 3).map((r, i) => <li key={i} className="flex items-center gap-1"><span className="text-green-500">✓</span>{r}</li>)}
                          {bt.requirements_met.length > 3 && <li className="text-gray-400">+{bt.requirements_met.length - 3} more</li>}
                        </ul>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3"><Badge label={bt.result ?? 'pending'} color={beltResultColor(bt.result ?? 'pending')} /></td>
                    <td className="px-4 py-3 text-gray-500">{bt.result === 'pass' ? fmtDate(bt.promotion_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {beltTests.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No belt tests found.</p>}
          </div>
        )}

        {/* INSTRUCTORS */}
        {tab === 'instructors' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name', 'Disciplines', 'Highest Rank', 'First Aid Expiry', 'VSC Date', 'Employment', 'Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {instructors.map(i => {
                  const faExpiry = i.first_aid_cert_expiry ? new Date(i.first_aid_cert_expiry) : null;
                  const faExpired = faExpiry ? faExpiry.getTime() < Date.now() : false;
                  const faDue = faExpiry ? daysUntil(i.first_aid_cert_expiry) <= 60 : false;
                  const vscExpired = i.vulnerable_sector_check_date ? (Date.now() - new Date(i.vulnerable_sector_check_date).getTime()) > (3 * 365 * 24 * 60 * 60 * 1000) : false;
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{i.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(i.disciplines ?? []).map(d => <Badge key={d} label={d.replace('_', ' ')} color={disciplineColor(d)} />)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{i.highest_rank ?? '—'}</td>
                      <td className="px-4 py-3">
                        {faExpiry ? (
                          <span className={faExpired ? 'text-red-600 font-medium' : faDue ? 'text-amber-600' : 'text-green-600'}>
                            {fmtDate(i.first_aid_cert_expiry)} {faExpired && '⚠ Expired'}{!faExpired && faDue && '⚠ Expiring'}
                          </span>
                        ) : <span className="text-red-500">⚠ Not on file</span>}
                      </td>
                      <td className="px-4 py-3">
                        {i.vulnerable_sector_check_date ? (
                          <span className={vscExpired ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {fmtDate(i.vulnerable_sector_check_date)} {vscExpired && '⚠ Expired'}
                          </span>
                        ) : <span className="text-red-500">⚠ Not on file</span>}
                      </td>
                      <td className="px-4 py-3"><Badge label={i.employment_type} color="blue" /></td>
                      <td className="px-4 py-3"><Badge label={i.status} color={i.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {instructors.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No instructors found.</p>}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Training Plan Generator */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Training Plan Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate a periodized training plan based on discipline, rank, and goals.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Discipline</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiDiscipline} onChange={e => setAiDiscipline(e.target.value)}>
                    {['bjj', 'muay_thai', 'boxing', 'wrestling', 'mma', 'karate', 'judo', 'kickboxing', 'taekwondo'].map(d => <option key={d} value={d}>{d.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Belt / Rank</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiRank} onChange={e => setAiRank(e.target.value)} placeholder="e.g. white belt, 3-stripe blue belt…" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Goals</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiGoals} onChange={e => setAiGoals(e.target.value)} placeholder="e.g. competition prep, self-defense, fitness…" />
                </div>
              </div>
              <button onClick={generateTrainingPlan} disabled={aiPlanLoading} className="w-full py-2 bg-red-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiPlanLoading ? 'Generating…' : 'Generate Training Plan'}</button>
              {aiPlan && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">Generated Plan</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiPlan)} className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiPlan}</pre>
                </div>
              )}
            </div>

            {/* Class Curriculum Generator */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Class Curriculum Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate a structured class curriculum for a discipline and skill level.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Discipline</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiCurriculumDiscipline} onChange={e => setAiCurriculumDiscipline(e.target.value)}>
                    {['bjj', 'muay_thai', 'boxing', 'wrestling', 'mma', 'karate', 'judo', 'kickboxing', 'taekwondo'].map(d => <option key={d} value={d}>{d.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Level</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiCurriculumLevel} onChange={e => setAiCurriculumLevel(e.target.value)}>
                    {['beginner', 'intermediate', 'advanced', 'kids', 'competition'].map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={generateCurriculum} disabled={aiCurriculumLoading} className="w-full py-2 bg-red-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiCurriculumLoading ? 'Generating…' : 'Generate Curriculum'}</button>
              {aiCurriculum && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">Generated Curriculum</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiCurriculum)} className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiCurriculum}</pre>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
