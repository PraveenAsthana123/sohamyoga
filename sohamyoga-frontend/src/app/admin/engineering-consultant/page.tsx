"use client";
import { useEffect, useState } from "react";

const TABS = ["Dashboard", "Clients", "Projects", "Deliverables", "AI Studio"] as const;
type Tab = typeof TABS[number];

const DISCIPLINES = ["civil", "structural", "mechanical", "electrical", "environmental", "geotechnical", "project_management"] as const;
type Discipline = typeof DISCIPLINES[number];

interface Client {
  id: string; company: string; contact_person: string; email: string; phone: string;
  company_type: "municipal" | "private" | "developer"; disciplines: Discipline[];
  active_projects: number; credit_terms: string;
}
interface Project {
  id: string; project_number: string; title: string; discipline: Discipline; client: string;
  contract_value: number; contract_type: string; status: string; hours_budget: number;
  hours_actual: number; deliverables: number; pe_stamp_required: boolean; assigned_pe: string;
  permit_required: boolean; location: string; start_date: string; end_date: string;
}
interface Deliverable {
  id: string; project_id: string; project_title: string; type: string; revision: string;
  status: "pending" | "draft" | "internal_review" | "client_review" | "approved" | "issued_for_construction";
  due_date: string;
}

const FALLBACK_CLIENTS: Client[] = [
  { id: "1", company: "City of Calgary", contact_person: "Mark Jensen", email: "mjensen@calgary.ca", phone: "403-555-0101", company_type: "municipal", disciplines: ["civil", "structural"], active_projects: 3, credit_terms: "Net 30" },
  { id: "2", company: "Skyline Developers Inc.", contact_person: "Priya Shah", email: "pshah@skyline.ca", phone: "403-555-0202", company_type: "developer", disciplines: ["structural", "mechanical"], active_projects: 2, credit_terms: "Net 45" },
];
const FALLBACK_PROJECTS: Project[] = [
  { id: "1", project_number: "2026-001", title: "Bridge Rehabilitation Study", discipline: "structural", client: "City of Calgary", contract_value: 185000, contract_type: "Fixed Price", status: "active", hours_budget: 620, hours_actual: 410, deliverables: 4, pe_stamp_required: true, assigned_pe: "Dr. A. Patel, P.Eng.", permit_required: true, location: "Calgary, AB", start_date: "2026-02-01", end_date: "2026-10-31" },
  { id: "2", project_number: "2026-002", title: "Mixed-Use Tower Structural Review", discipline: "structural", client: "Skyline Developers Inc.", contract_value: 92000, contract_type: "T&M", status: "active", hours_budget: 320, hours_actual: 195, deliverables: 6, pe_stamp_required: true, assigned_pe: "Dr. A. Patel, P.Eng.", permit_required: false, location: "Edmonton, AB", start_date: "2026-04-15", end_date: "2026-11-30" },
];
const FALLBACK_DELIVERABLES: Deliverable[] = [
  { id: "1", project_id: "1", project_title: "Bridge Rehabilitation Study", type: "Structural Report", revision: "A", status: "client_review", due_date: "2026-09-20" },
  { id: "2", project_id: "1", project_title: "Bridge Rehabilitation Study", type: "Drawings Package", revision: "B", status: "internal_review", due_date: "2026-09-28" },
  { id: "3", project_id: "2", project_title: "Mixed-Use Tower Structural Review", type: "Foundation Report", revision: "A", status: "approved", due_date: "2026-09-15" },
];

const STATUS_COLORS: Record<Deliverable["status"], string> = {
  pending: "bg-gray-100 text-gray-600", draft: "bg-blue-100 text-blue-700",
  internal_review: "bg-yellow-100 text-yellow-700", client_review: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700", issued_for_construction: "bg-emerald-100 text-emerald-800",
};
const TYPE_COLORS: Record<string, string> = {
  municipal: "bg-blue-100 text-blue-700", private: "bg-purple-100 text-purple-700", developer: "bg-orange-100 text-orange-700",
};
const DISC_COLORS: Record<Discipline, string> = {
  civil: "bg-sky-100 text-sky-700", structural: "bg-indigo-100 text-indigo-700", mechanical: "bg-orange-100 text-orange-700",
  electrical: "bg-yellow-100 text-yellow-700", environmental: "bg-green-100 text-green-700",
  geotechnical: "bg-amber-100 text-amber-700", project_management: "bg-gray-100 text-gray-700",
};

export default function EngineeringConsultantPage() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [projFilter, setProjFilter] = useState({ discipline: "", status: "", pe_stamp: false });
  const [delProjFilter, setDelProjFilter] = useState("");
  const [aiTab, setAiTab] = useState<"sow" | "report">("sow");
  const [aiInputs, setAiInputs] = useState({ discipline: "", project_type: "", scope_description: "", project_title: "", purpose: "" });
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [newClient, setNewClient] = useState({ company: "", contact_person: "", email: "", phone: "", company_type: "private" as Client["company_type"], disciplines: [] as Discipline[] });
  const [newProject, setNewProject] = useState({ project_number: "", title: "", discipline: "structural" as Discipline, client: "", contract_value: "", contract_type: "Fixed Price", start_date: "", end_date: "", hours_budget: "", pe_stamp_required: false, assigned_pe: "", permit_required: false, location: "" });
  const [newDeliverable, setNewDeliverable] = useState({ project_id: "", type: "", revision: "A", status: "pending" as Deliverable["status"], due_date: "" });

  useEffect(() => {
    fetch("/api/admin/engineering-consultant", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        setClients(d?.clients ?? FALLBACK_CLIENTS);
        setProjects(d?.projects ?? FALLBACK_PROJECTS);
        setDeliverables(d?.deliverables ?? FALLBACK_DELIVERABLES);
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

  const addClient = () => {
    if (!newClient.company) return;
    setClients(p => [...p, { ...newClient, id: Date.now().toString(), active_projects: 0, credit_terms: "Net 30" }]);
    setShowAddClient(false);
    setNewClient({ company: "", contact_person: "", email: "", phone: "", company_type: "private", disciplines: [] });
  };

  const addProject = () => {
    if (!newProject.title) return;
    setProjects(p => [...p, {
      ...newProject, id: Date.now().toString(), status: "active", hours_actual: 0, deliverables: 0,
      contract_value: parseFloat(newProject.contract_value) || 0,
      hours_budget: parseFloat(newProject.hours_budget) || 0,
    }]);
    setShowAddProject(false);
  };

  const addDeliverable = () => {
    if (!newDeliverable.project_id || !newDeliverable.type) return;
    const proj = projects.find(p => p.id === newDeliverable.project_id);
    setDeliverables(p => [...p, { ...newDeliverable, id: Date.now().toString(), project_title: proj?.title ?? "" }]);
    setShowAddDeliverable(false);
  };

  const toggleDisc = (d: Discipline) => setNewClient(p => ({
    ...p, disciplines: p.disciplines.includes(d) ? p.disciplines.filter(x => x !== d) : [...p.disciplines, d],
  }));

  const filteredProjects = projects.filter(p =>
    (!projFilter.discipline || p.discipline === projFilter.discipline) &&
    (!projFilter.status || p.status === projFilter.status) &&
    (!projFilter.pe_stamp || p.pe_stamp_required)
  );

  const filteredDeliverables = deliverables.filter(d => !delProjFilter || d.project_id === delProjFilter);

  const dueIn14 = deliverables.filter(d => {
    const due = new Date(d.due_date).getTime();
    const now = Date.now();
    return due - now <= 14 * 86400000 && due >= now;
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Engineering Consultant</h1>
        <p className="text-gray-500 mb-6">Project management, clients, deliverables, and P.Eng. stamp tracking</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Active Projects", value: projects.filter(p => p.status === "active").length },
                { label: "Total Contract Value", value: `$${(projects.reduce((s, p) => s + p.contract_value, 0) / 1000).toFixed(0)}k` },
                { label: "Deliverables Due 14d", value: dueIn14.length },
                { label: "P.Eng. Stamp Jobs", value: projects.filter(p => p.pe_stamp_required).length },
                { label: "Total Clients", value: clients.length },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>
            {dueIn14.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h3 className="font-semibold text-orange-800 mb-2">Deliverables Due Within 14 Days</h3>
                {dueIn14.map(d => (
                  <div key={d.id} className="flex justify-between text-sm py-1 border-b border-orange-100 last:border-0">
                    <span className="text-gray-700">{d.project_title} — {d.type} Rev.{d.revision}</span>
                    <span className="font-medium text-orange-700">{d.due_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Clients" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Client Registry</h2>
              <button onClick={() => setShowAddClient(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ Add Client</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>{["Company", "Contact", "Type", "Disciplines", "Active Projects", "Credit Terms"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.company}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.contact_person}<br /><span className="text-xs text-gray-400">{c.email}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.company_type]}`}>{c.company_type}</span></td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{c.disciplines.map(d => <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${DISC_COLORS[d]}`}>{d}</span>)}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.active_projects}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.credit_terms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddClient && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-[520px] shadow-xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">Add Client</h3>
                  {[["Company", "company"], ["Contact Person", "contact_person"], ["Email", "email"], ["Phone", "phone"]].map(([label, key]) => (
                    <div key={key} className="mb-3">
                      <label className="block text-sm text-gray-600 mb-1">{label}</label>
                      <input value={(newClient as unknown as Record<string, string>)[key] ?? ""} onChange={e => setNewClient(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                  <label className="block text-sm text-gray-600 mb-1">Company Type</label>
                  <select value={newClient.company_type} onChange={e => setNewClient(p => ({ ...p, company_type: e.target.value as Client["company_type"] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
                    {["municipal", "private", "developer"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="block text-sm text-gray-600 mb-2">Disciplines</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {DISCIPLINES.map(d => (
                      <button key={d} onClick={() => toggleDisc(d)}
                        className={`text-xs px-2 py-1 rounded-full border ${newClient.disciplines.includes(d) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowAddClient(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={addClient} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add Client</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Projects" && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <select value={projFilter.discipline} onChange={e => setProjFilter(p => ({ ...p, discipline: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Disciplines</option>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={projFilter.status} onChange={e => setProjFilter(p => ({ ...p, status: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {["active", "on_hold", "completed"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={projFilter.pe_stamp} onChange={e => setProjFilter(p => ({ ...p, pe_stamp: e.target.checked }))} />
                P.Eng. Stamp Required
              </label>
              <button onClick={() => setShowAddProject(true)} className="ml-auto px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ New Project</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map(p => (
                <div key={p.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs text-gray-400 font-mono">{p.project_number}</p>
                      <p className="font-semibold text-gray-900">{p.title}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DISC_COLORS[p.discipline]}`}>{p.discipline}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{p.client} · {p.location}</p>
                  <div className="flex gap-4 text-sm mb-3">
                    <span className="text-gray-700 font-medium">${p.contract_value.toLocaleString()}</span>
                    <span className="text-gray-400">{p.contract_type}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Hours: {p.hours_actual}/{p.hours_budget}</span>
                      <span>{p.hours_budget > 0 ? Math.round((p.hours_actual / p.hours_budget) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div className="h-2 bg-indigo-400 rounded-full" style={{ width: `${p.hours_budget > 0 ? Math.min(100, Math.round((p.hours_actual / p.hours_budget) * 100)) : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{p.status}</span>
                    {p.pe_stamp_required && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">P.Eng. Stamp</span>}
                    {p.permit_required && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">Permit Required</span>}
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full">{p.deliverables} deliverables</span>
                  </div>
                </div>
              ))}
            </div>
            {showAddProject && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-[560px] shadow-xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">New Project</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[["Project Number", "project_number"], ["Title", "title"], ["Contract Value ($)", "contract_value"], ["Hours Budget", "hours_budget"], ["Location", "location"], ["Assigned P.Eng.", "assigned_pe"]].map(([label, key]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-600 mb-1">{label}</label>
                        <input value={(newProject as unknown as Record<string, string>)[key] ?? ""}
                          onChange={e => setNewProject(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Client</label>
                      <select value={newProject.client} onChange={e => setNewProject(p => ({ ...p, client: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="">Select client…</option>
                        {clients.map(c => <option key={c.id} value={c.company}>{c.company}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discipline</label>
                      <select value={newProject.discipline} onChange={e => setNewProject(p => ({ ...p, discipline: e.target.value as Discipline }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                      <input type="date" value={newProject.start_date} onChange={e => setNewProject(p => ({ ...p, start_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Date</label>
                      <input type="date" value={newProject.end_date} onChange={e => setNewProject(p => ({ ...p, end_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" checked={newProject.pe_stamp_required} onChange={e => setNewProject(p => ({ ...p, pe_stamp_required: e.target.checked }))} />
                      P.Eng. Stamp Required
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" checked={newProject.permit_required} onChange={e => setNewProject(p => ({ ...p, permit_required: e.target.checked }))} />
                      Permit Required
                    </label>
                  </div>
                  <div className="flex gap-3 justify-end mt-4">
                    <button onClick={() => setShowAddProject(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={addProject} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create Project</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Deliverables" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <select value={delProjFilter} onChange={e => setDelProjFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <button onClick={() => setShowAddDeliverable(true)} className="ml-auto px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ Add Deliverable</button>
            </div>
            <div className="space-y-3">
              {filteredDeliverables.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(d => (
                <div key={d.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{d.project_title}</p>
                    <p className="text-xs text-gray-500">{d.type} · Revision {d.revision}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                    {d.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-gray-400">{d.due_date}</span>
                  {d.status !== "approved" && d.status !== "issued_for_construction" && (
                    <button onClick={() => setDeliverables(p => p.map(x => x.id === d.id ? { ...x, status: "approved" } : x))}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Approve</button>
                  )}
                  {d.status === "approved" && (
                    <button onClick={() => setDeliverables(p => p.map(x => x.id === d.id ? { ...x, status: "issued_for_construction" } : x))}
                      className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">Issue for Construction</button>
                  )}
                </div>
              ))}
            </div>
            {showAddDeliverable && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Add Deliverable</h3>
                  <label className="block text-sm text-gray-600 mb-1">Project</label>
                  <select value={newDeliverable.project_id} onChange={e => setNewDeliverable(p => ({ ...p, project_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <option value="">Select project…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <label className="block text-sm text-gray-600 mb-1">Deliverable Type</label>
                  <input value={newDeliverable.type} onChange={e => setNewDeliverable(p => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="e.g. Structural Report" />
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Revision</label>
                      <select value={newDeliverable.revision} onChange={e => setNewDeliverable(p => ({ ...p, revision: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {["A", "B", "C", "D"].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Due Date</label>
                      <input type="date" value={newDeliverable.due_date} onChange={e => setNewDeliverable(p => ({ ...p, due_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowAddDeliverable(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
                    <button onClick={addDeliverable} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "AI Studio" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex gap-4 mb-5 border-b border-gray-100 pb-4">
              {[["sow", "Scope of Work"], ["report", "Report Introduction"]].map(([key, label]) => (
                <button key={key} onClick={() => setAiTab(key as "sow" | "report")}
                  className={`text-sm px-3 py-1 rounded ${aiTab === key ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                  {label}
                </button>
              ))}
            </div>
            {aiTab === "sow" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Discipline</label>
                    <select value={aiInputs.discipline} onChange={e => setAiInputs(p => ({ ...p, discipline: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select…</option>
                      {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Project Type</label>
                    <input value={aiInputs.project_type} onChange={e => setAiInputs(p => ({ ...p, project_type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Bridge rehabilitation" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Scope Description</label>
                  <textarea value={aiInputs.scope_description} onChange={e => setAiInputs(p => ({ ...p, scope_description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
                </div>
                <button onClick={() => runAi(`Write a professional engineering Scope of Work for a ${aiInputs.discipline} ${aiInputs.project_type} project. Description: ${aiInputs.scope_description}`)}
                  disabled={aiLoading}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                  {aiLoading ? "Generating…" : "Generate Scope of Work"}
                </button>
              </div>
            )}
            {aiTab === "report" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Project Title</label>
                    <input value={aiInputs.project_title} onChange={e => setAiInputs(p => ({ ...p, project_title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Discipline</label>
                    <select value={aiInputs.discipline} onChange={e => setAiInputs(p => ({ ...p, discipline: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select…</option>
                      {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Purpose / Objectives</label>
                  <textarea value={aiInputs.purpose} onChange={e => setAiInputs(p => ({ ...p, purpose: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
                </div>
                <button onClick={() => runAi(`Write a professional engineering report introduction for project: "${aiInputs.project_title}", discipline: ${aiInputs.discipline}, purpose: ${aiInputs.purpose}`)}
                  disabled={aiLoading}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                  {aiLoading ? "Generating…" : "Generate Report Intro"}
                </button>
              </div>
            )}
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
      </div>
    </div>
  );
}
