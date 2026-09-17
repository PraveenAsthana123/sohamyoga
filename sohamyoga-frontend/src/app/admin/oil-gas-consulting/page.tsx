'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'clients', 'projects', 'consultants', 'aer', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', clients: 'Clients', projects: 'Projects', consultants: 'Consultants', aer: 'AER Submissions', ai: 'AI Tools' };

interface DashData { active_projects: number; consultants_deployed: number; revenue_mtd: number; proposals_pending: number; hours_billed_mtd: number; aer_submissions_pending: number; }
interface OGClient { id: number; company_name: string; sector: string; indigenous_consultation_required: boolean; aer_licensee_id: string; primary_commodity: string; contact_name: string; contact_email: string; city: string; }
interface OGProject { id: number; project_name: string; client_name: string; project_type: string; status: string; contract_value: number; billed_to_date: number; aer_application_number: string; tier_applicable: boolean; start_date: string; end_date: string; lead_consultant: string; }
interface Consultant { id: number; name: string; email: string; discipline: string; designation: string; availability: string; day_rate: number; current_project: string; }
interface AerSubmission { id: number; project_name: string; submission_type: string; status: string; submitted_date: string; decision_date: string; aer_reference: string; notes: string; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', indigo: 'bg-indigo-100 text-indigo-700', slate: 'bg-slate-100 text-slate-600' };
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

function sectorColor(s: string): string {
  return { upstream: 'blue', midstream: 'teal', downstream: 'purple', oilsands: 'amber' }[s] ?? 'gray';
}

function projectTypeColor(t: string): string {
  const m: Record<string, string> = { environmental_assessment: 'green', facility_design: 'blue', regulatory_filing: 'orange', pipeline_integrity: 'teal', well_abandonment: 'gray', reclamation: 'purple', indigenous_engagement: 'amber', aer_application: 'red' };
  return m[t] ?? 'gray';
}

function availabilityColor(a: string): string {
  return { available: 'green', on_project: 'amber', unavailable: 'red' }[a] ?? 'gray';
}

function aerStatusColor(s: string): string {
  const m: Record<string, string> = { draft: 'gray', submitted: 'blue', under_review: 'amber', additional_info: 'orange', approved: 'green', rejected: 'red' };
  return m[s] ?? 'gray';
}

const AER_STATUS_STEPS = ['draft', 'submitted', 'under_review', 'additional_info', 'approved'];

export default function OilGasConsultingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashData | null>(null);
  const [clients, setClients] = useState<OGClient[]>([]);
  const [projects, setProjects] = useState<OGProject[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [aerSubmissions, setAerSubmissions] = useState<AerSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // AI state
  const [aiProjectType, setAiProjectType] = useState('environmental_assessment');
  const [aiArea, setAiArea] = useState('Peace River');
  const [aiCommodity, setAiCommodity] = useState('crude oil');
  const [aiRegSummary, setAiRegSummary] = useState('');
  const [aiRegLoading, setAiRegLoading] = useState(false);
  const [aiProposalType, setAiProposalType] = useState('pipeline_integrity');
  const [aiProposalClient, setAiProposalClient] = useState('');
  const [aiProposal, setAiProposal] = useState('');
  const [aiProposalLoading, setAiProposalLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/admin/oil-gas-consulting');
    const d = await res.json();
    setDashboard(d);
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/oil-gas-consulting/clients');
    const d = await res.json();
    setClients(d.clients ?? []);
    setLoading(false);
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/oil-gas-consulting/projects');
    const d = await res.json();
    setProjects(d.projects ?? []);
    setLoading(false);
  }, []);

  const loadConsultants = useCallback(async () => {
    const res = await fetch('/api/admin/oil-gas-consulting/consultants');
    const d = await res.json();
    setConsultants(d.consultants ?? []);
  }, []);

  const loadAerSubmissions = useCallback(async () => {
    const res = await fetch('/api/admin/oil-gas-consulting/aer-submissions');
    const d = await res.json();
    setAerSubmissions(d.submissions ?? d.aer_submissions ?? []);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'clients') loadClients(); }, [tab, loadClients]);
  useEffect(() => { if (tab === 'projects') loadProjects(); }, [tab, loadProjects]);
  useEffect(() => { if (tab === 'consultants') loadConsultants(); }, [tab, loadConsultants]);
  useEffect(() => { if (tab === 'aer') loadAerSubmissions(); }, [tab, loadAerSubmissions]);

  async function generateRegSummary() {
    setAiRegLoading(true); setAiRegSummary('');
    try {
      const res = await fetch('/api/admin/oil-gas-consulting/ai-regulatory-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_type: aiProjectType, area: aiArea, commodity: aiCommodity }) });
      const d = await res.json();
      setAiRegSummary(d.summary ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiRegSummary(String(e)); } finally { setAiRegLoading(false); }
  }

  async function generateProposal() {
    setAiProposalLoading(true); setAiProposal('');
    try {
      const res = await fetch('/api/admin/oil-gas-consulting/ai-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_type: aiProposalType, client_name: aiProposalClient }) });
      const d = await res.json();
      setAiProposal(d.proposal ?? d.outline ?? d.text ?? d.error ?? 'No response');
    } catch (e) { setAiProposal(String(e)); } finally { setAiProposalLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Oil & Gas Consulting — Alberta</h1>
        <p className="text-sm text-gray-500 mt-1">Clients · Projects · Consultants · AER Submissions · AI Regulatory Tools</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Active Projects" value={dashboard.active_projects} color="blue" />
                <KpiCard label="Consultants Deployed" value={dashboard.consultants_deployed} color="green" />
                <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="amber" />
                <KpiCard label="Proposals Pending" value={dashboard.proposals_pending} color="purple" />
                <KpiCard label="Hours Billed MTD" value={dashboard.hours_billed_mtd?.toLocaleString() ?? '—'} color="teal" />
                <KpiCard label="AER Submissions Pending" value={dashboard.aer_submissions_pending} color="red" />
              </div>
            ) : <p className="text-sm text-gray-400">Loading dashboard…</p>}
          </div>
        )}

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div className="space-y-4">
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Company', 'Sector', 'Commodity', 'AER Licensee ID', 'Indigenous Consultation', 'Contact'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.company_name}<div className="text-xs text-gray-400">{c.city}</div></td>
                        <td className="px-4 py-3"><Badge label={c.sector} color={sectorColor(c.sector)} /></td>
                        <td className="px-4 py-3 text-gray-600">{c.primary_commodity ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.aer_licensee_id ?? '—'}</td>
                        <td className="px-4 py-3">{c.indigenous_consultation_required ? <Badge label="Required" color="orange" /> : <span className="text-gray-400 text-xs">Not required</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-500"><div>{c.contact_name}</div><div>{c.contact_email}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clients.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No clients found.</p>}
              </div>
            )}
          </div>
        )}

        {/* PROJECTS */}
        {tab === 'projects' && (
          <div className="space-y-4">
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <div className="space-y-3">
                {projects.map(p => {
                  const billed = p.billed_to_date ?? 0;
                  const contract = p.contract_value ?? 1;
                  const pct = Math.min(100, Math.round((billed / contract) * 100));
                  return (
                    <div key={p.id} className="bg-white rounded-xl border p-5">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800">{p.project_name}</h3>
                          <p className="text-sm text-gray-500">{p.client_name} · {p.lead_consultant ?? '—'}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge label={p.project_type?.replace(/_/g, ' ') ?? '—'} color={projectTypeColor(p.project_type)} />
                          <Badge label={p.status?.replace(/_/g, ' ') ?? '—'} color="blue" />
                          {p.tier_applicable && <Badge label="TIER" color="teal" />}
                        </div>
                      </div>
                      {p.aer_application_number && <p className="text-xs text-gray-500 mb-2">AER App: <span className="font-mono">{p.aer_application_number}</span></p>}
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div><span className="text-gray-400 text-xs">Contract Value</span><div className="font-medium">{fmtCad(p.contract_value)}</div></div>
                        <div><span className="text-gray-400 text-xs">Billed to Date</span><div className="font-medium">{fmtCad(p.billed_to_date)}</div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Billed vs Contract</span><span>{pct}%</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${pct >= 90 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No projects found.</p>}
              </div>
            )}
          </div>
        )}

        {/* CONSULTANTS */}
        {tab === 'consultants' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name', 'Discipline', 'Designation', 'Day Rate', 'Availability', 'Current Project'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {consultants.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}<div className="text-xs text-gray-400">{c.email}</div></td>
                    <td className="px-4 py-3"><Badge label={c.discipline?.replace(/_/g, ' ') ?? '—'} color="blue" /></td>
                    <td className="px-4 py-3 font-medium text-gray-700">{c.designation ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{c.day_rate ? fmtCad(c.day_rate) + '/day' : '—'}</td>
                    <td className="px-4 py-3"><Badge label={c.availability?.replace('_', ' ') ?? '—'} color={availabilityColor(c.availability)} /></td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{c.current_project ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {consultants.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No consultants found.</p>}
          </div>
        )}

        {/* AER SUBMISSIONS */}
        {tab === 'aer' && (
          <div className="space-y-3">
            {aerSubmissions.map(sub => {
              const stepIdx = AER_STATUS_STEPS.indexOf(sub.status);
              return (
                <div key={sub.id} className="bg-white rounded-xl border p-5">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold">{sub.project_name}</h3>
                      {sub.aer_reference && <p className="text-xs text-gray-500 font-mono">AER Ref: {sub.aer_reference}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge label={sub.submission_type?.replace(/_/g, ' ') ?? '—'} color="blue" />
                      <Badge label={sub.status?.replace(/_/g, ' ') ?? '—'} color={aerStatusColor(sub.status)} />
                    </div>
                  </div>
                  {/* Pipeline */}
                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                    {AER_STATUS_STEPS.map((step, i) => (
                      <div key={step} className="flex items-center gap-1">
                        <div className={`px-2 py-0.5 rounded text-xs font-medium ${i <= stepIdx ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{step.replace(/_/g, ' ')}</div>
                        {i < AER_STATUS_STEPS.length - 1 && <span className="text-gray-300">→</span>}
                      </div>
                    ))}
                    {sub.status === 'rejected' && <div className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">rejected</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-xs text-gray-400">Submitted</span><div>{fmtDate(sub.submitted_date)}</div></div>
                    <div><span className="text-xs text-gray-400">Decision Date</span><div>{fmtDate(sub.decision_date)}</div></div>
                  </div>
                  {sub.notes && <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">{sub.notes}</p>}
                </div>
              );
            })}
            {aerSubmissions.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No AER submissions found.</p>}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regulatory Summary */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Regulatory Summary Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate an AER regulatory pathway summary based on project type, area, and commodity.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Project Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiProjectType} onChange={e => setAiProjectType(e.target.value)}>
                    {['environmental_assessment', 'facility_design', 'regulatory_filing', 'pipeline_integrity', 'well_abandonment', 'reclamation', 'aer_application'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Area / Region</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiArea} onChange={e => setAiArea(e.target.value)} placeholder="e.g. Peace River, Fort McMurray, Red Deer…" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Primary Commodity</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiCommodity} onChange={e => setAiCommodity(e.target.value)} placeholder="e.g. crude oil, natural gas, bitumen…" />
                </div>
              </div>
              <button onClick={generateRegSummary} disabled={aiRegLoading} className="w-full py-2 bg-amber-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiRegLoading ? 'Generating…' : 'Generate Regulatory Summary'}</button>
              {aiRegSummary && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">AER Regulatory Pathway</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiRegSummary)} className="text-xs text-amber-700 border border-amber-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiRegSummary}</pre>
                </div>
              )}
            </div>

            {/* Proposal Outline */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Proposal Outline Generator</h2>
              <p className="text-xs text-gray-500 mb-4">Generate a structured consulting proposal outline for a client engagement.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">Project Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiProposalType} onChange={e => setAiProposalType(e.target.value)}>
                    {['pipeline_integrity', 'environmental_assessment', 'well_abandonment', 'reclamation', 'facility_design', 'regulatory_filing'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Client Name (optional)</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiProposalClient} onChange={e => setAiProposalClient(e.target.value)} placeholder="Client company name…" />
                </div>
              </div>
              <button onClick={generateProposal} disabled={aiProposalLoading} className="w-full py-2 bg-amber-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiProposalLoading ? 'Generating…' : 'Generate Proposal Outline'}</button>
              {aiProposal && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-semibold">Proposal Outline</h3>
                    <button onClick={() => navigator.clipboard.writeText(aiProposal)} className="text-xs text-amber-700 border border-amber-200 px-2 py-1 rounded">Copy</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiProposal}</pre>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
