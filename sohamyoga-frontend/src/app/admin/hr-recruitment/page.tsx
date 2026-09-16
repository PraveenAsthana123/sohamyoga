"use client";
import { useEffect, useState } from "react";

const TABS = ["Dashboard", "Job Postings", "Applicant Pipeline", "Interviews", "Employees", "AI Hiring Suite", "Compliance"] as const;
type Tab = typeof TABS[number];

const PIPELINE_STAGES = ["New", "Screening", "Phone Screen", "Interview", "Assessment", "Offer", "Hired", "Rejected"] as const;
const JOB_PLATFORMS = ["Job Bank Canada", "Indeed", "LinkedIn", "Workopolis", "Monster", "Glassdoor", "Eluta", "Kijiji Jobs"] as const;
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "temporary", "seasonal"] as const;

interface Job { id: string; title: string; department: string; employment_type: string; location: string; remote_ok: boolean; salary_min: number; salary_max: number; salary_type: string; applications_count: number; platforms: string[]; status: string; days_open: number; noc_code: string; closing_date: string; }
interface Applicant { id: string; job_id: string; name: string; current_title: string; years_experience: number; rating: number; source: string; applied_at: string; stage: string; }
interface Interview { id: string; applicant: string; job: string; type: string; datetime: string; interviewer: string; location: string; completed: boolean; feedback?: string; rating?: number; recommendation?: string; }
interface Employee { id: string; name: string; department: string; title: string; employment_type: string; start_date: string; salary: number; vacation_used: number; vacation_total: number; status: string; }

const FALLBACK_JOBS: Job[] = [
  { id: "1", title: "Senior Yoga Instructor", department: "Programs", employment_type: "full_time", location: "Calgary, AB", remote_ok: false, salary_min: 55000, salary_max: 72000, salary_type: "annual", applications_count: 23, platforms: ["Indeed", "LinkedIn", "Job Bank Canada"], status: "active", days_open: 12, noc_code: "5254", closing_date: "2026-10-01" },
  { id: "2", title: "Marketing Coordinator", department: "Marketing", employment_type: "full_time", location: "Calgary, AB", remote_ok: true, salary_min: 48000, salary_max: 60000, salary_type: "annual", applications_count: 41, platforms: ["LinkedIn", "Indeed", "Glassdoor"], status: "active", days_open: 7, noc_code: "1123", closing_date: "2026-09-30" },
];
const FALLBACK_APPLICANTS: Applicant[] = [
  { id: "1", job_id: "1", name: "Anika Sharma", current_title: "Yoga Instructor", years_experience: 6, rating: 4, source: "LinkedIn", applied_at: "2026-09-10", stage: "Interview" },
  { id: "2", job_id: "1", name: "David Park", current_title: "Fitness Coach", years_experience: 4, rating: 3, source: "Indeed", applied_at: "2026-09-09", stage: "Phone Screen" },
  { id: "3", job_id: "2", name: "Mei Chen", current_title: "Marketing Assistant", years_experience: 2, rating: 5, source: "LinkedIn", applied_at: "2026-09-12", stage: "Screening" },
];
const FALLBACK_INTERVIEWS: Interview[] = [
  { id: "1", applicant: "Anika Sharma", job: "Senior Yoga Instructor", type: "Panel", datetime: "2026-09-18T10:00", interviewer: "Sandra K.", location: "Calgary Office", completed: false },
  { id: "2", applicant: "Mei Chen", job: "Marketing Coordinator", type: "Video Call", datetime: "2026-09-17T14:00", interviewer: "Tom R.", location: "Zoom", completed: false },
];
const FALLBACK_EMPLOYEES: Employee[] = [
  { id: "1", name: "Sandra Kim", department: "Programs", title: "Head Instructor", employment_type: "full_time", start_date: "2023-03-01", salary: 78000, vacation_used: 8, vacation_total: 15, status: "active" },
  { id: "2", name: "Tom Rivera", department: "Marketing", title: "Marketing Manager", employment_type: "full_time", start_date: "2024-01-15", salary: 72000, vacation_used: 5, vacation_total: 10, status: "active" },
];

const STAGE_COLORS: Record<string, string> = {
  New: "bg-gray-100", Screening: "bg-blue-50", "Phone Screen": "bg-cyan-50", Interview: "bg-yellow-50",
  Assessment: "bg-orange-50", Offer: "bg-purple-50", Hired: "bg-green-50", Rejected: "bg-red-50",
};

export default function HrRecruitmentPage() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [aiSection, setAiSection] = useState<"jd" | "screen" | "questions" | "offer">("jd");
  const [aiInputs, setAiInputs] = useState({ title: "", dept: "", requirements: "", applicant: "", focus: "", name: "", salary: "", start: "" });
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", department: "", employment_type: "full_time", location: "", remote_ok: false, salary_min: "", salary_max: "", salary_type: "annual", description: "", requirements: "", noc_code: "", closing_date: "", platforms: [] as string[] });
  const [newEmployee, setNewEmployee] = useState({ name: "", department: "", title: "", employment_type: "full_time", start_date: "", salary: "", vacation_total: "10" });

  useEffect(() => {
    fetch("/api/admin/hr-recruitment", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        setJobs(d?.jobs ?? FALLBACK_JOBS);
        setApplicants(d?.applicants ?? FALLBACK_APPLICANTS);
        setInterviews(d?.interviews ?? FALLBACK_INTERVIEWS);
        setEmployees(d?.employees ?? FALLBACK_EMPLOYEES);
        setLoading(false);
      });
  }, []);

  const runAi = async (prompt: string) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const d = await res.json();
      setAiResult(d.result || d.text || JSON.stringify(d));
    } catch {
      setAiResult("Unable to reach AI service.");
    }
    setAiLoading(false);
  };

  const advanceApplicant = (id: string) => {
    setApplicants(prev => prev.map(a => {
      if (a.id !== id) return a;
      const idx = PIPELINE_STAGES.indexOf(a.stage as typeof PIPELINE_STAGES[number]);
      const next = PIPELINE_STAGES[Math.min(idx + 1, PIPELINE_STAGES.length - 1)];
      return { ...a, stage: next };
    }));
  };

  const postJob = () => {
    if (!newJob.title) return;
    setJobs(p => [...p, { ...newJob, id: Date.now().toString(), applications_count: 0, status: "active", days_open: 0, salary_min: parseFloat(newJob.salary_min) || 0, salary_max: parseFloat(newJob.salary_max) || 0 }]);
    setShowPostJob(false);
  };

  const addEmployee = () => {
    if (!newEmployee.name) return;
    setEmployees(p => [...p, { ...newEmployee, id: Date.now().toString(), salary: parseFloat(newEmployee.salary) || 0, vacation_used: 0, vacation_total: parseInt(newEmployee.vacation_total) || 10, status: "active" }]);
    setShowAddEmployee(false);
  };

  const filteredApplicants = selectedJob ? applicants.filter(a => a.job_id === selectedJob) : applicants;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">HR & Recruitment</h1>
        <p className="text-gray-500 mb-6">Hiring pipeline, employee records, and Alberta ESC compliance</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200 flex-wrap">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium rounded-t-md ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Open Positions", value: jobs.filter(j => j.status === "active").length },
                { label: "Applicants in Pipeline", value: applicants.length },
                { label: "Interviews This Week", value: interviews.filter(i => !i.completed).length },
                { label: "Total Headcount", value: employees.filter(e => e.status === "active").length },
                { label: "Departments", value: [...new Set(employees.map(e => e.department))].length },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3">Headcount by Department</h3>
              {Object.entries(employees.reduce((acc, e) => {
                acc[e.department] = (acc[e.department] || 0) + 1; return acc;
              }, {} as Record<string, number>)).map(([dept, count]) => (
                <div key={dept} className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-gray-600 w-32">{dept}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full">
                    <div className="h-4 bg-indigo-400 rounded-full" style={{ width: `${(count / employees.length) * 100}%` }} />
                  </div>
                  <span className="text-sm text-gray-700 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Job Postings" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Active Job Postings</h2>
              <button onClick={() => setShowPostJob(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ Post Job</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map(j => (
                <div key={j.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-gray-900">{j.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${j.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{j.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{j.department} · {j.location}{j.remote_ok ? " (Remote OK)" : ""}</p>
                  <p className="text-sm font-medium text-gray-700 mb-2">${j.salary_min.toLocaleString()} – ${j.salary_max.toLocaleString()} {j.salary_type}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {j.platforms.map(p => <span key={p} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{p}</span>)}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{j.applications_count} applications</span>
                    <span>{j.days_open} days open</span>
                    <span>NOC {j.noc_code}</span>
                  </div>
                </div>
              ))}
            </div>
            {showPostJob && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-[580px] shadow-xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">Post Job</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[["Job Title", "title"], ["Department", "department"], ["Location", "location"], ["NOC Code", "noc_code"]].map(([label, key]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-600 mb-1">{label}</label>
                        <input value={(newJob as Record<string, string>)[key] ?? ""} onChange={e => setNewJob(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Employment Type</label>
                      <select value={newJob.employment_type} onChange={e => setNewJob(p => ({ ...p, employment_type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Closing Date</label>
                      <input type="date" value={newJob.closing_date} onChange={e => setNewJob(p => ({ ...p, closing_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Salary Min ($)</label>
                      <input value={newJob.salary_min} onChange={e => setNewJob(p => ({ ...p, salary_min: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Salary Max ($)</label>
                      <input value={newJob.salary_max} onChange={e => setNewJob(p => ({ ...p, salary_max: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <input type="checkbox" checked={newJob.remote_ok} onChange={e => setNewJob(p => ({ ...p, remote_ok: e.target.checked }))} />
                    Remote OK
                  </label>
                  <label className="block text-xs text-gray-600 mb-1">Description</label>
                  <textarea value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none mb-3" />
                  <label className="block text-xs text-gray-600 mb-1">Platforms</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {JOB_PLATFORMS.map(p => (
                      <button key={p} onClick={() => setNewJob(prev => ({ ...prev, platforms: prev.platforms.includes(p) ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p] }))}
                        className={`text-xs px-2 py-1 rounded-full border ${newJob.platforms.includes(p) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowPostJob(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={postJob} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Post Job</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Applicant Pipeline" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Jobs</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <div className="flex gap-3 min-w-max">
                {PIPELINE_STAGES.map(stage => {
                  const stageApps = filteredApplicants.filter(a => a.stage === stage);
                  return (
                    <div key={stage} className={`w-44 rounded-xl p-3 ${STAGE_COLORS[stage] || "bg-gray-50"}`}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">{stage} ({stageApps.length})</p>
                      <div className="space-y-2">
                        {stageApps.map(a => (
                          <div key={a.id} className="bg-white rounded-lg p-2 shadow-sm border border-gray-100 text-xs">
                            <p className="font-medium text-gray-800">{a.name}</p>
                            <p className="text-gray-500">{a.current_title}</p>
                            <p className="text-gray-400">{a.years_experience}y exp</p>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-yellow-400">{"★".repeat(a.rating)}</span>
                              <span className="text-gray-400 text-xs">{a.source}</span>
                            </div>
                            {stage !== "Hired" && stage !== "Rejected" && (
                              <button onClick={() => advanceApplicant(a.id)}
                                className="w-full mt-1 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs hover:bg-indigo-100">
                                Advance →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "Interviews" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Interviews</h2>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>{["Applicant", "Job", "Type", "Date/Time", "Interviewer", "Location", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {interviews.map(i => (
                    <tr key={i.id} className={`border-t border-gray-50 ${i.completed ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{i.applicant}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.job}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{i.type}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.datetime).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.interviewer}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.location}</td>
                      <td className="px-4 py-3">
                        {!i.completed && (
                          <button onClick={() => setInterviews(p => p.map(x => x.id === i.id ? { ...x, completed: true } : x))}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                            Mark Complete
                          </button>
                        )}
                        {i.completed && <span className="text-xs text-gray-400">Done</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Employees" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Employee Records</h2>
              <button onClick={() => setShowAddEmployee(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ Add Employee</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>{["Name", "Department", "Title", "Type", "Start Date", "Salary", "Vacation", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.title}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{e.employment_type.replace(/_/g, " ")}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.start_date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">${e.salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.vacation_used}/{e.vacation_total}d</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddEmployee && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Add Employee</h3>
                  {[["Full Name", "name"], ["Department", "department"], ["Job Title", "title"], ["Annual Salary ($)", "salary"], ["Vacation Days", "vacation_total"]].map(([label, key]) => (
                    <div key={key} className="mb-3">
                      <label className="block text-sm text-gray-600 mb-1">{label}</label>
                      <input value={(newEmployee as Record<string, string>)[key] ?? ""} onChange={e => setNewEmployee(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                  <label className="block text-sm text-gray-600 mb-1">Employment Type</label>
                  <select value={newEmployee.employment_type} onChange={e => setNewEmployee(p => ({ ...p, employment_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
                    {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                  <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={newEmployee.start_date} onChange={e => setNewEmployee(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowAddEmployee(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={addEmployee} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add Employee</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "AI Hiring Suite" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex gap-2 mb-5 flex-wrap">
              {[["jd", "JD Generator"], ["screen", "Applicant Screener"], ["questions", "Interview Questions"], ["offer", "Offer Letter"]].map(([key, label]) => (
                <button key={key} onClick={() => setAiSection(key as typeof aiSection)}
                  className={`text-sm px-3 py-1.5 rounded-lg ${aiSection === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {aiSection === "jd" && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-600 mb-1">Job Title</label><input value={aiInputs.title} onChange={e => setAiInputs(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Department</label><input value={aiInputs.dept} onChange={e => setAiInputs(p => ({ ...p, dept: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <div><label className="block text-xs text-gray-600 mb-1">Key Requirements</label><textarea value={aiInputs.requirements} onChange={e => setAiInputs(p => ({ ...p, requirements: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" /></div>
                <button onClick={() => runAi(`Write a compelling job description for a ${aiInputs.title} in ${aiInputs.dept}. Requirements: ${aiInputs.requirements}`)} disabled={aiLoading} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{aiLoading ? "Generating…" : "Generate JD"}</button>
              </>)}
              {aiSection === "screen" && (<>
                <div><label className="block text-xs text-gray-600 mb-1">Job Requirements</label><textarea value={aiInputs.requirements} onChange={e => setAiInputs(p => ({ ...p, requirements: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" /></div>
                <div><label className="block text-xs text-gray-600 mb-1">Applicant Profile</label><textarea value={aiInputs.applicant} onChange={e => setAiInputs(p => ({ ...p, applicant: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" /></div>
                <button onClick={() => runAi(`Screen this applicant for fit. Job requirements: ${aiInputs.requirements}. Applicant profile: ${aiInputs.applicant}. Give a fit score 1-10 and reasoning.`)} disabled={aiLoading} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{aiLoading ? "Analyzing…" : "Screen Applicant"}</button>
              </>)}
              {aiSection === "questions" && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-600 mb-1">Job Title</label><input value={aiInputs.title} onChange={e => setAiInputs(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Interview Focus</label><input value={aiInputs.focus} onChange={e => setAiInputs(p => ({ ...p, focus: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. technical, leadership, culture" /></div>
                </div>
                <button onClick={() => runAi(`Generate 8 STAR-format interview questions for a ${aiInputs.title} role, focused on ${aiInputs.focus}.`)} disabled={aiLoading} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{aiLoading ? "Generating…" : "Generate Questions"}</button>
              </>)}
              {aiSection === "offer" && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-600 mb-1">Candidate Name</label><input value={aiInputs.name} onChange={e => setAiInputs(p => ({ ...p, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Job Title</label><input value={aiInputs.title} onChange={e => setAiInputs(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Annual Salary ($)</label><input value={aiInputs.salary} onChange={e => setAiInputs(p => ({ ...p, salary: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Start Date</label><input value={aiInputs.start} onChange={e => setAiInputs(p => ({ ...p, start: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <button onClick={() => runAi(`Write a professional offer letter for ${aiInputs.name} for the position of ${aiInputs.title} with a salary of $${aiInputs.salary} starting ${aiInputs.start}.`)} disabled={aiLoading} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{aiLoading ? "Generating…" : "Generate Offer Letter"}</button>
              </>)}
            </div>
            {aiResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500 font-medium">AI Output</p>
                  <button onClick={() => navigator.clipboard.writeText(aiResult)} className="text-xs text-indigo-600 hover:underline">Copy</button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</p>
              </div>
            )}
          </div>
        )}

        {tab === "Compliance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Alberta Employment Standards Code (ESC)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500">Standard</th><th className="px-3 py-2 text-left text-xs text-gray-500">Requirement</th></tr></thead>
                  <tbody>
                    {[
                      ["Minimum Wage", "$15.00/hr (general)"],
                      ["Overtime", "After 8h/day or 44h/wk — 1.5× rate"],
                      ["Vacation (0-5 yrs)", "2 weeks paid vacation (4% earnings)"],
                      ["Vacation (5+ yrs)", "3 weeks paid vacation (6% earnings)"],
                      ["Termination Notice: <2 yrs", "1 week"],
                      ["Termination Notice: 2-4 yrs", "2 weeks"],
                      ["Termination Notice: 4-6 yrs", "4 weeks"],
                      ["Termination Notice: 6-8 yrs", "5 weeks"],
                      ["Termination Notice: 8-10 yrs", "6 weeks"],
                      ["Termination Notice: >10 yrs", "8 weeks"],
                    ].map(([standard, req]) => (
                      <tr key={standard} className="border-t border-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{standard}</td>
                        <td className="px-3 py-2 text-gray-600">{req}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Employment Equity Note</h3>
              <p className="text-sm text-blue-700">Federal contractors and federally regulated employers must comply with the Employment Equity Act. Review your workforce composition annually and set measurable goals for the four designated groups: women, Indigenous peoples, persons with disabilities, and visible minorities.</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3">Record of Employment (ROE) Checklist</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                {["Issue ROE within 5 calendar days of interruption of earnings", "Include all insurable hours and earnings", "Submit electronically to Service Canada or provide paper copy to employee", "Retain copy for 6 years", "Correct ROEs within 30 days if errors found"].map(item => (
                  <li key={item} className="flex gap-2"><span className="text-green-500 mt-0.5">☐</span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
