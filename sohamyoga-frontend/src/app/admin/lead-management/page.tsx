'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'leads', 'icp', 'nurture', 'capture', 'ai-scoring'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', leads: 'Lead List', icp: 'ICP Profiles',
  nurture: 'Nurture Sequences', capture: 'Lead Capture', 'ai-scoring': 'AI Scoring',
};

interface Lead { id: number; name: string; email: string; phone?: string; company?: string; source?: string; status: string; score: number; icp_fit?: string; enrichment_data?: Record<string, unknown>; created_at: string; }
interface ICP { id: number; name: string; industry?: string; company_size?: string; pain_points?: string[]; buying_signals?: string[]; }
interface NurtureSeq { id: number; name: string; steps: unknown[]; status: string; }
interface Metrics { total: string; new_leads: string; qualified: string; nurturing: string; converted: string; avg_score: string; }

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', qualified: 'bg-green-100 text-green-700',
  nurturing: 'bg-amber-100 text-amber-700', converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
};
const ICP_FIT_COLORS: Record<string, string> = {
  strong: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', weak: 'bg-red-100 text-red-600',
};

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50', emerald: 'border-l-4 border-emerald-500 bg-emerald-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>{score}</span>;
}

export default function LeadManagementPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [icpProfiles, setIcpProfiles] = useState<ICP[]>([]);
  const [nurture, setNurture] = useState<NurtureSeq[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [scoringLog, setScoringLog] = useState<Array<{ id: number; name: string; score: number; reasoning: string }>>([]);
  const [scoringInProgress, setScoringInProgress] = useState(false);
  const [newIcp, setNewIcp] = useState({ name: '', description: '' });
  const [generatingIcp, setGeneratingIcp] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    const res = await fetch(`/api/admin/lead-management?${params}`).catch(() => null);
    if (res?.ok) { const d = await res.json(); setLeads(d.leads || []); setMetrics(d.metrics || null); }
    setLoading(false);
  }, [search, filterStatus]);

  const fetchIcp = useCallback(async () => {
    const res = await fetch('/api/admin/lead-management/icp').catch(() => null);
    if (res?.ok) { const d = await res.json(); setIcpProfiles(d.profiles || []); }
  }, []);

  const fetchNurture = useCallback(async () => {
    const res = await fetch('/api/admin/lead-management/nurture').catch(() => null);
    if (res?.ok) { const d = await res.json(); setNurture(d.sequences || []); }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { if (tab === 'icp') fetchIcp(); }, [tab, fetchIcp]);
  useEffect(() => { if (tab === 'nurture') fetchNurture(); }, [tab, fetchNurture]);

  const scoreLead = async (id: number, name: string) => {
    const res = await fetch(`/api/admin/lead-management/${id}/score`, { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setScoringLog(prev => [{ id, name, score: d.score, reasoning: d.reasoning }, ...prev]);
      await fetchLeads();
    }
  };

  const enrichLead = async (id: number) => {
    setActionMsg('Enriching...');
    const res = await fetch(`/api/admin/lead-management/${id}/enrich`, { method: 'POST' }).catch(() => null);
    setActionMsg(res?.ok ? 'Enriched successfully' : 'Enrichment failed');
    if (res?.ok) fetchLeads();
    setTimeout(() => setActionMsg(''), 3000);
  };

  const bulkRescore = async () => {
    setScoringInProgress(true);
    setScoringLog([]);
    for (const lead of leads.slice(0, 10)) {
      await scoreLead(lead.id, lead.name);
    }
    setScoringInProgress(false);
  };

  const generateIcp = async () => {
    if (!newIcp.description) return;
    setGeneratingIcp(true);
    const res = await fetch('/api/admin/lead-management/icp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newIcp.description, name: newIcp.name }),
    }).catch(() => null);
    if (res?.ok) { await fetchIcp(); setNewIcp({ name: '', description: '' }); }
    setGeneratingIcp(false);
  };

  const captureSnippet = `<!-- Sohamyoga Lead Capture Form -->
<form action="/api/public/leads/capture" method="POST">
  <input name="name" placeholder="Full Name" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="company" placeholder="Company" />
  <input name="phone" placeholder="Phone" />
  <input name="source" value="website_form" type="hidden" />
  <button type="submit">Get Started</button>
</form>`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Lead Management</h1>
        <p className="text-slate-300 text-sm mt-1">Generation · Enrichment · Scoring · ICP · Nurturing</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Total Leads" value={metrics?.total || 0} color="blue" />
              <KpiCard label="New" value={metrics?.new_leads || 0} color="blue" />
              <KpiCard label="Qualified" value={metrics?.qualified || 0} color="green" />
              <KpiCard label="Nurturing" value={metrics?.nurturing || 0} color="amber" />
              <KpiCard label="Converted" value={metrics?.converted || 0} color="emerald" />
              <KpiCard label="Avg Score" value={metrics?.avg_score ? `${metrics.avg_score}/100` : '—'} color="purple" />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Funnel Overview</h2>
              <div className="flex items-end gap-3">
                {[
                  { label: 'New', val: parseInt(metrics?.new_leads || '0'), color: 'bg-blue-400' },
                  { label: 'Qualified', val: parseInt(metrics?.qualified || '0'), color: 'bg-green-400' },
                  { label: 'Nurturing', val: parseInt(metrics?.nurturing || '0'), color: 'bg-amber-400' },
                  { label: 'Converted', val: parseInt(metrics?.converted || '0'), color: 'bg-emerald-500' },
                ].map(s => {
                  const max = parseInt(metrics?.total || '1') || 1;
                  const pct = Math.round((s.val / max) * 100);
                  return (
                    <div key={s.label} className="flex-1 text-center">
                      <div className="text-sm font-medium text-gray-600 mb-1">{s.val}</div>
                      <div className={`${s.color} rounded-t`} style={{ height: `${Math.max(8, pct * 2)}px` }} />
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Recent Leads</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Name</th><th>Company</th><th>Source</th><th>Score</th><th>Status</th></tr></thead>
                <tbody>{leads.slice(0, 5).map(l => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">{l.name}</td>
                    <td className="text-gray-600">{l.company || '—'}</td>
                    <td className="text-gray-500 text-xs">{l.source}</td>
                    <td><ScoreBadge score={l.score} /></td>
                    <td><Badge label={l.status} colorClass={STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div className="space-y-4">
            {actionMsg && <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">{actionMsg}</div>}
            <div className="flex gap-3 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, company..."
                className="border rounded px-3 py-2 text-sm flex-1 min-w-48" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="">All statuses</option>
                {['new','qualified','nurturing','converted','lost'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={fetchLeads} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Search</button>
            </div>
            {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
              <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr className="text-left text-gray-500">
                    <th className="px-4 py-3">Name</th><th className="px-4">Company</th><th className="px-4">Source</th>
                    <th className="px-4">Score</th><th className="px-4">ICP Fit</th><th className="px-4">Status</th><th className="px-4">Actions</th>
                  </tr></thead>
                  <tbody>{leads.map(l => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{l.name}<div className="text-xs text-gray-400">{l.email}</div></td>
                      <td className="px-4">{l.company || '—'}</td>
                      <td className="px-4 text-gray-500 text-xs">{l.source}</td>
                      <td className="px-4"><ScoreBadge score={l.score} /></td>
                      <td className="px-4">{l.icp_fit ? <Badge label={l.icp_fit} colorClass={ICP_FIT_COLORS[l.icp_fit] || 'bg-gray-100 text-gray-600'} /> : '—'}</td>
                      <td className="px-4"><Badge label={l.status} colorClass={STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-4">
                        <div className="flex gap-1">
                          <button onClick={() => scoreLead(l.id, l.name)} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">Score</button>
                          <button onClick={() => enrichLead(l.id)} className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded hover:bg-teal-200">Enrich</button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'icp' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">Generate ICP with AI</h2>
              <div className="space-y-3">
                <input value={newIcp.name} onChange={e => setNewIcp(p => ({ ...p, name: e.target.value }))}
                  placeholder="ICP name (optional)" className="border rounded px-3 py-2 text-sm w-full" />
                <textarea value={newIcp.description} onChange={e => setNewIcp(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your ideal customer (industry, size, problems they face, goals...)"
                  className="border rounded px-3 py-2 text-sm w-full h-24 resize-none" />
                <button onClick={generateIcp} disabled={generatingIcp || !newIcp.description}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                  {generatingIcp ? 'Generating...' : 'Generate ICP with Ollama'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {icpProfiles.map(p => (
                <div key={p.id} className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-800">{p.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Industry:</span> {p.industry || '—'}</p>
                    <p><span className="font-medium">Company size:</span> {p.company_size || '—'}</p>
                    {p.pain_points?.length ? (
                      <div><span className="font-medium">Pain points:</span>
                        <ul className="ml-3 list-disc text-xs text-gray-500">{p.pain_points.map((pp, i) => <li key={i}>{pp}</li>)}</ul>
                      </div>
                    ) : null}
                    {p.buying_signals?.length ? (
                      <div><span className="font-medium">Buying signals:</span>
                        <ul className="ml-3 list-disc text-xs text-gray-500">{p.buying_signals.map((bs, i) => <li key={i}>{bs}</li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'nurture' && (
          <div className="space-y-4">
            {nurture.map(seq => (
              <div key={seq.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">{seq.name}</h3>
                  <Badge label={seq.status} colorClass={seq.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {(seq.steps as Array<{ step: number; day: number; channel: string; subject: string; body: string }>).map((step, i) => (
                    <div key={i} className="min-w-48 bg-gray-50 border rounded p-3 text-xs">
                      <div className="font-medium text-gray-700">Step {step.step} — Day {step.day}</div>
                      <div className="text-blue-600 mt-1 capitalize">{step.channel}</div>
                      <div className="text-gray-600 mt-1 font-medium">{step.subject}</div>
                      <div className="text-gray-400 mt-1 line-clamp-2">{step.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'capture' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-2">Embeddable Lead Capture Form</h2>
              <p className="text-sm text-gray-500 mb-3">Copy and paste this snippet into any webpage to capture leads directly into your pipeline.</p>
              <pre className="bg-gray-900 text-green-300 text-xs rounded p-4 overflow-x-auto">{captureSnippet}</pre>
              <button onClick={() => navigator.clipboard?.writeText(captureSnippet)} className="mt-3 bg-gray-800 text-white px-4 py-2 rounded text-sm">Copy Snippet</button>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-2">Form Preview</h2>
              <div className="border rounded p-4 bg-gray-50 max-w-sm space-y-3">
                <div><label className="text-sm text-gray-600">Full Name</label><input className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="Full Name" /></div>
                <div><label className="text-sm text-gray-600">Email</label><input className="border rounded px-3 py-2 text-sm w-full mt-1" type="email" placeholder="Email" /></div>
                <div><label className="text-sm text-gray-600">Company</label><input className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="Company" /></div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm w-full">Get Started</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'ai-scoring' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h2 className="font-semibold text-gray-700">Bulk AI Rescoring</h2>
                  <p className="text-sm text-gray-500 mt-1">Rescore up to 10 leads using Ollama llama3.2 against your ICP profiles.</p>
                </div>
                <button onClick={bulkRescore} disabled={scoringInProgress || leads.length === 0}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                  {scoringInProgress ? 'Scoring...' : `Rescore Top 10 Leads`}
                </button>
              </div>
            </div>
            {scoringLog.length > 0 && (
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-gray-700 mb-3">Scoring Results</h2>
                <div className="space-y-3">
                  {scoringLog.map((entry, i) => (
                    <div key={i} className="border rounded p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{entry.name}</span>
                        <ScoreBadge score={entry.score} />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{entry.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
