'use client';
import { useEffect, useState } from 'react';

const TABS = ['overview', 'onboarding', 'health', 'pipeline', 'reporting'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  onboarding: 'Onboarding',
  health: 'Health Scores',
  pipeline: 'Pipeline',
  reporting: 'Reporting',
};

interface AgencyClient {
  id: string;
  company_name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  account_manager: string | null;
  status: string;
  monthly_retainer_cad: string | null;
  contract_start: string | null;
  contract_end: string | null;
  total_spend_cad: string;
  health_score: number;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  onboarding: 'bg-blue-100 text-blue-700',
  prospect: 'bg-purple-100 text-purple-700',
  at_risk: 'bg-amber-100 text-amber-700',
  churned: 'bg-red-100 text-red-600',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score > 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{score}</span>
    </div>
  );
}

const ONBOARDING_STEPS = [
  'Kick-off call',
  'Brand assets received',
  'Accounts connected',
  'First campaign live',
  'Reporting set up',
];

function fmtCad(val: string | number | null): string {
  if (val === null || val === undefined) return '—';
  return `$${Number(val).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-CA');
}

export default function AgencyClientsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editHealth, setEditHealth] = useState<number>(80);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/agency-clients', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setClients(d.clients ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load clients.'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch(`/api/admin/agency-clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus, health_score: editHealth }),
    });
    setEditId(null);
    setSaving(false);
    load();
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client record?')) return;
    await fetch(`/api/admin/agency-clients/${id}`, { method: 'DELETE' });
    load();
  }

  const active = clients.filter(c => c.status === 'active');
  const onboarding = clients.filter(c => c.status === 'onboarding');
  const prospects = clients.filter(c => c.status === 'prospect');
  const churned = clients.filter(c => c.status === 'churned');
  const atRisk = clients.filter(c => c.status === 'at_risk');

  const totalMRR = clients
    .filter(c => ['active', 'onboarding'].includes(c.status))
    .reduce((s, c) => s + Number(c.monthly_retainer_cad ?? 0), 0);
  const avgRetainer = active.length
    ? active.reduce((s, c) => s + Number(c.monthly_retainer_cad ?? 0), 0) / active.length
    : 0;

  // Simulated onboarding progress per client (based on health_score proxy)
  function onboardProgress(c: AgencyClient): number {
    if (c.health_score >= 90) return 5;
    if (c.health_score >= 75) return 4;
    if (c.health_score >= 60) return 3;
    if (c.health_score >= 40) return 2;
    return 1;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Agency Client Management</h1>
        <p className="mt-1 text-sm text-gray-500">Multi-client dashboard — track status, health, billing, and pipeline across all agency accounts.</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">Loading clients…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Clients" value={clients.length} color="blue" />
                <KpiCard label="Active Clients" value={active.length} sub={`+ ${atRisk.length} at-risk`} color="green" />
                <KpiCard label="Avg Monthly Retainer" value={fmtCad(avgRetainer)} sub="Active only" color="purple" />
                <KpiCard label="Total MRR" value={fmtCad(totalMRR)} sub="Active + Onboarding" color="amber" />
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-semibold text-gray-800">All Clients</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2">Company</th>
                        <th className="px-4 py-2">Industry</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Account Manager</th>
                        <th className="px-4 py-2">Retainer/mo</th>
                        <th className="px-4 py-2 w-40">Health</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clients.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{c.company_name}</div>
                            <div className="text-xs text-gray-400">{c.contact_name}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-600">{c.industry ?? '—'}</td>
                          <td className="px-4 py-3">
                            {editId === c.id ? (
                              <select
                                value={editStatus}
                                onChange={e => setEditStatus(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-xs"
                              >
                                {['prospect', 'onboarding', 'active', 'at_risk', 'churned'].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            ) : (
                              <Badge label={c.status} cls={STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{c.account_manager ?? '—'}</td>
                          <td className="px-4 py-3 font-medium">{fmtCad(c.monthly_retainer_cad)}</td>
                          <td className="px-4 py-3 w-40">
                            {editId === c.id ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editHealth}
                                onChange={e => setEditHealth(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-20"
                              />
                            ) : (
                              <HealthBar score={c.health_score} />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editId === c.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(c.id)}
                                  disabled={saving}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={() => setEditId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditId(c.id); setEditStatus(c.status); setEditHealth(c.health_score); }}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button onClick={() => deleteClient(c.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {clients.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm">No clients found.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ONBOARDING TAB */}
          {tab === 'onboarding' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Clients currently in onboarding — track completion of the 5-step checklist.</p>
              {onboarding.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">No clients currently onboarding.</div>
              )}
              {onboarding.map(c => {
                const done = onboardProgress(c);
                return (
                  <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{c.company_name}</h3>
                        <p className="text-xs text-gray-400">{c.contact_name} · {c.contact_email}</p>
                      </div>
                      <Badge label={`${done}/5 steps`} cls="bg-blue-100 text-blue-700" />
                    </div>
                    <div className="space-y-2">
                      {ONBOARDING_STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${i < done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {i < done ? '✓' : i + 1}
                          </div>
                          <span className={`text-sm ${i < done ? 'text-gray-700 line-through' : 'text-gray-500'}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    {c.notes && <p className="mt-3 text-xs text-gray-400 italic">{c.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* HEALTH SCORES TAB */}
          {tab === 'health' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Sorted by health score. Clients below 60 are flagged as at-risk.</p>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Account Manager</th>
                      <th className="px-4 py-2 w-48">Health Score</th>
                      <th className="px-4 py-2">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...clients].sort((a, b) => a.health_score - b.health_score).map(c => {
                      const isAtRisk = c.health_score < 60;
                      const isWarning = c.health_score >= 60 && c.health_score <= 80;
                      return (
                        <tr key={c.id} className={`hover:bg-gray-50 ${isAtRisk ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{c.company_name}</td>
                          <td className="px-4 py-3">
                            <Badge label={c.status} cls={STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{c.account_manager ?? '—'}</td>
                          <td className="px-4 py-3 w-48"><HealthBar score={c.health_score} /></td>
                          <td className="px-4 py-3">
                            {isAtRisk && <Badge label="At Risk" cls="bg-red-100 text-red-700" />}
                            {isWarning && <Badge label="Watch" cls="bg-amber-100 text-amber-700" />}
                            {!isAtRisk && !isWarning && <Badge label="Healthy" cls="bg-green-100 text-green-700" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {atRisk.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <strong>{atRisk.length} at-risk client{atRisk.length > 1 ? 's' : ''}</strong> — immediate account manager check-in recommended.
                </div>
              )}
            </div>
          )}

          {/* PIPELINE TAB */}
          {tab === 'pipeline' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Prospects" value={prospects.length} color="purple" />
                <KpiCard label="Onboarding" value={onboarding.length} color="blue" />
                <KpiCard label="Churned" value={churned.length} color="amber" />
                <KpiCard
                  label="Win Rate"
                  value={`${prospects.length + active.length + onboarding.length > 0 ? Math.round((active.length + onboarding.length) / Math.max(1, prospects.length + active.length + onboarding.length) * 100) : 0}%`}
                  sub="Active / (Active + Prospects)"
                  color="green"
                />
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-semibold text-gray-800">Prospects</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Contact</th>
                      <th className="px-4 py-2">Industry</th>
                      <th className="px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prospects.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.company_name}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_name} <span className="text-gray-400 text-xs">{c.contact_email}</span></td>
                        <td className="px-4 py-3 capitalize text-gray-500">{c.industry ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{c.notes ?? '—'}</td>
                      </tr>
                    ))}
                    {prospects.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No prospects in pipeline.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {churned.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h2 className="font-semibold text-gray-800">Churned Clients</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2">Company</th>
                        <th className="px-4 py-2">Total Spend</th>
                        <th className="px-4 py-2">Contract End</th>
                        <th className="px-4 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {churned.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{c.company_name}</td>
                          <td className="px-4 py-3">{fmtCad(c.total_spend_cad)}</td>
                          <td className="px-4 py-3">{fmtDate(c.contract_end)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{c.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* REPORTING TAB */}
          {tab === 'reporting' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Per-client summary — last activity, total spend, contract dates.</p>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Total Spend</th>
                      <th className="px-4 py-2">Retainer/mo</th>
                      <th className="px-4 py-2">Contract Start</th>
                      <th className="px-4 py-2">Contract End</th>
                      <th className="px-4 py-2">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.company_name}</td>
                        <td className="px-4 py-3">
                          <Badge label={c.status} cls={STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'} />
                        </td>
                        <td className="px-4 py-3 font-medium">{fmtCad(c.total_spend_cad)}</td>
                        <td className="px-4 py-3">{fmtCad(c.monthly_retainer_cad)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(c.contract_start)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(c.contract_end)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags ?? []).map(tag => (
                              <span key={tag} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
