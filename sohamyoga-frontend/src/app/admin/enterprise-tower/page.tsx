'use client';

import { useState, useEffect, useCallback } from 'react';

interface ETService {
  service_id: string; name: string; status: string;
  uptime_pct: string; cost_today_usd: string; last_checked: string;
}
interface ETIncident {
  id: number; severity: string; service_id: string; description: string;
  status: string; declared_at: string; resolved_at: string | null;
}
interface ETRunbook {
  runbook_id: string; title: string; service_id: string;
  steps: string[]; last_updated: string;
}
interface Stats {
  activeServices: number; activeIncidents: number; slaCompliance: number; costToday: number;
}

type Tab = 'service-map' | 'sla' | 'cost' | 'incidents' | 'runbooks';

const STATUS_COLOR: Record<string, string> = {
  operational: 'bg-green-500', degraded: 'bg-amber-500', outage: 'bg-red-500', unknown: 'bg-gray-400',
};
const SEV_COLOR: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 border-red-200', P1: 'bg-orange-100 text-orange-700 border-orange-200',
  P2: 'bg-amber-100 text-amber-700 border-amber-200', P3: 'bg-blue-100 text-blue-700 border-blue-200',
};

function KpiCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}{unit && <span className="text-lg ml-1 font-normal text-gray-500">{unit}</span>}</p>
    </div>
  );
}

export default function EnterpriseTowerPage() {
  const [tab, setTab] = useState<Tab>('service-map');
  const [services, setServices] = useState<ETService[]>([]);
  const [incidents, setIncidents] = useState<ETIncident[]>([]);
  const [runbooks, setRunbooks] = useState<ETRunbook[]>([]);
  const [stats, setStats] = useState<Stats>({ activeServices: 0, activeIncidents: 0, slaCompliance: 0, costToday: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Incident form state
  const [showIncForm, setShowIncForm] = useState(false);
  const [incSev, setIncSev] = useState('P2');
  const [incSvc, setIncSvc] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Runbook modal
  const [viewRb, setViewRb] = useState<ETRunbook | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/enterprise-tower', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setStats(d.stats); setServices(d.services); setIncidents(d.incidents); setRunbooks(d.runbooks);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const declareIncident = async () => {
    if (!incSvc || !incDesc.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/enterprise-tower', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: incSev, service_id: incSvc, description: incDesc }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowIncForm(false); setIncDesc('');
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  };

  const resolveIncident = async (id: number) => {
    try {
      await fetch('/api/admin/enterprise-tower', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved' }),
      });
      await load();
    } catch { /* ignore */ }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'service-map', label: 'Service Map' },
    { key: 'sla', label: 'SLA Dashboard' },
    { key: 'cost', label: 'Cost Monitor' },
    { key: 'incidents', label: 'Incident Command' },
    { key: 'runbooks', label: 'Runbooks' },
  ];

  const totalCost = services.reduce((s, r) => s + parseFloat(r.cost_today_usd), 0);
  const topCostDrivers = [...services].sort((a, b) => parseFloat(b.cost_today_usd) - parseFloat(a.cost_today_usd)).slice(0, 3);
  const monthProjection = (totalCost * 30).toFixed(0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Enterprise Control Tower</h1>
        <p className="text-gray-500 text-sm mt-1">Infrastructure health, SLA compliance, cost monitoring and incident command</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Services" value={loading ? '...' : stats.activeServices} color="text-green-600" />
        <KpiCard label="Active Incidents" value={loading ? '...' : stats.activeIncidents} color={stats.activeIncidents > 0 ? 'text-red-600' : 'text-green-600'} />
        <KpiCard label="SLA Compliance" value={loading ? '...' : stats.slaCompliance} unit="%" color={stats.slaCompliance >= 99 ? 'text-green-600' : 'text-amber-600'} />
        <KpiCard label="Cost Today" value={loading ? '...' : `$${stats.costToday.toFixed(2)}`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Service Map */}
      {tab === 'service-map' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {services.map(s => (
            <div key={s.service_id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLOR[s.status] ?? 'bg-gray-400'}`} />
                <span className="text-sm font-semibold text-gray-800 truncate">{s.name}</span>
              </div>
              <p className="text-xs text-gray-500 capitalize">{s.status}</p>
              <p className="text-xs text-gray-500">Uptime: <span className="font-medium text-gray-800">{parseFloat(s.uptime_pct).toFixed(2)}%</span></p>
              <p className="text-xs text-gray-400 mt-1">Checked {new Date(s.last_checked).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* SLA Dashboard */}
      {tab === 'sla' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Service', 'SLA Target', 'Actual Uptime', 'Breaches / Month', 'Next Review'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map(s => {
                const actual = parseFloat(s.uptime_pct);
                const breach = actual < 99.9;
                return (
                  <tr key={s.service_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">99.9%</td>
                    <td className={`px-4 py-3 font-semibold ${breach ? 'text-red-600' : 'text-green-600'}`}>{actual.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-gray-600">{breach ? <span className="text-red-600 font-medium">1</span> : '0'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost Monitor */}
      {tab === 'cost' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm col-span-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Daily Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">${totalCost.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Month projection: <span className="font-semibold text-gray-700">${monthProjection}</span></p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm col-span-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">Top 3 Cost Drivers</p>
              <div className="space-y-2">
                {topCostDrivers.map(s => (
                  <div key={s.service_id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-40 truncate">{s.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600 rounded-full"
                        style={{ width: `${(parseFloat(s.cost_today_usd) / totalCost * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-800 w-12 text-right">${parseFloat(s.cost_today_usd).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">Cost Breakdown by Service</h3>
            </div>
            <div className="p-4 space-y-3">
              {[...services].sort((a, b) => parseFloat(b.cost_today_usd) - parseFloat(a.cost_today_usd)).map(s => (
                <div key={s.service_id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-48 truncate">{s.name}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(parseFloat(s.cost_today_usd) / totalCost * 100).toFixed(0)}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 w-16 text-right">${parseFloat(s.cost_today_usd).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Incident Command */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Active Incidents</h3>
            <button onClick={() => setShowIncForm(v => !v)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              + Declare Incident
            </button>
          </div>

          {showIncForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-4">Declare New Incident</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                  <select value={incSev} onChange={e => setIncSev(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {['P0','P1','P2','P3'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
                  <select value={incSvc} onChange={e => setIncSvc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Select service --</option>
                    {services.map(s => <option key={s.service_id} value={s.service_id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={incDesc} onChange={e => setIncDesc(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Describe the incident..." />
              </div>
              <div className="flex gap-2">
                <button onClick={declareIncident} disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Declaring...' : 'Declare'}
                </button>
                <button onClick={() => setShowIncForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Severity', 'Service', 'Description', 'Status', 'Declared', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${SEV_COLOR[inc.severity] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{inc.severity}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inc.service_id}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{inc.description}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${inc.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(inc.declared_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {inc.status === 'active' && (
                        <button onClick={() => resolveIncident(inc.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No incidents declared</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Runbooks */}
      {tab === 'runbooks' && (
        <div className="space-y-4">
          {viewRb && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-screen overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900">{viewRb.title}</h3>
                  <button onClick={() => setViewRb(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Service: {viewRb.service_id} · Updated: {new Date(viewRb.last_updated).toLocaleDateString()}</p>
                <ol className="space-y-3">
                  {viewRb.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="text-sm text-gray-700 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runbooks.map(rb => (
              <div key={rb.runbook_id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-1">{rb.title}</h4>
                <p className="text-xs text-gray-500 mb-1">Service: {rb.service_id}</p>
                <p className="text-xs text-gray-400 mb-3">
                  {rb.steps.length} steps · Updated {new Date(rb.last_updated).toLocaleDateString()}
                </p>
                <button onClick={() => setViewRb(rb)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View Steps →</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
