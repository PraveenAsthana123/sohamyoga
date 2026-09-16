'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiOffering {
  id: string;
  platform: string;
  api_version: string | null;
  api_name: string;
  endpoint_path: string;
  http_method: string;
  capability: string;
  category: string;
  auth_type: string;
  required_scopes: string[];
  required_env_vars: string[];
  rate_limit_calls: number | null;
  rate_limit_window: string | null;
  rate_limit_tier: string;
  implementation_status: string;
  our_api_route: string | null;
  is_stable: boolean;
  requires_review: boolean;
  notes: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  error_count_30d: number;
  success_count_30d: number;
  avg_latency_ms: number | null;
}

interface QuotaSummary {
  platform: string;
  total_calls: number;
  total_throttled: number;
  total_errors: number;
  max_quota_pct: string;
  last_call_at: string | null;
}

interface ChangelogEntry {
  id: string;
  platform: string;
  change_type: string;
  endpoint_path: string | null;
  description: string;
  effective_date: string | null;
  impact: string | null;
  our_action_required: boolean;
  our_action_taken: string | null;
  source_url: string | null;
  created_at: string;
}

interface TestResult {
  id: string;
  platform: string;
  endpoint_path: string;
  http_method: string;
  status: string;
  http_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  run_at: string;
}

interface GapItem {
  id: string;
  platform: string;
  category: string;
  capability: string;
  http_method: string;
  endpoint_path: string;
  current_status: string;
  estimated_effort: string;
  business_impact: number;
}

interface CoverageMatrix {
  matrix: Record<string, Record<string, string>>;
  platforms: string[];
  categories: string[];
  counts: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  built: 'bg-green-100 text-green-800',
  verified: 'bg-teal-100 text-teal-800',
  partial: 'bg-yellow-100 text-yellow-800',
  stub: 'bg-blue-100 text-blue-800',
  not_built: 'bg-gray-100 text-gray-700',
  deprecated: 'bg-red-100 text-red-800',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-gray-100 text-gray-700',
  POST: 'bg-green-100 text-green-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-blue-100 text-blue-800',
  PUT: 'bg-purple-100 text-purple-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  publish: 'bg-indigo-100 text-indigo-800',
  read: 'bg-sky-100 text-sky-800',
  analytics: 'bg-violet-100 text-violet-800',
  messaging: 'bg-orange-100 text-orange-800',
  review: 'bg-pink-100 text-pink-800',
  campaign: 'bg-amber-100 text-amber-800',
  insight: 'bg-emerald-100 text-emerald-800',
  webhook: 'bg-teal-100 text-teal-800',
  auth: 'bg-slate-100 text-slate-800',
  media: 'bg-rose-100 text-rose-800',
};

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const STATUS_EMOJI: Record<string, string> = {
  built: '✅', verified: '✅', partial: '🟡', stub: '🔵', not_built: '⬜', deprecated: '🔴',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function QuotaBar({ pct }: { pct: number }) {
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [coverage, setCoverage] = useState<CoverageMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/platform-api-catalog/coverage-matrix')
      .then((r) => r.json())
      .then((d: CoverageMatrix) => setCoverage(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading overview…</div>;
  if (!coverage) return null;

  const counts = coverage.counts ?? {};
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const built = (counts['built'] ?? 0) + (counts['verified'] ?? 0);
  const partial = counts['partial'] ?? 0;
  const notBuilt = counts['not_built'] ?? 0;
  const deprecated = counts['deprecated'] ?? 0;

  const DISPLAY_CATEGORIES = ['publish', 'read', 'analytics', 'messaging', 'review', 'campaign', 'auth', 'webhook'];
  const displayPlatforms = coverage.platforms.slice(0, 20); // show first 20

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-bold text-gray-900">{total}</div>
          <div className="text-sm text-gray-500 mt-1">Total Offerings</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100 text-center">
          <div className="text-3xl font-bold text-green-700">{built}</div>
          <div className="text-sm text-green-600 mt-1">Built / Verified</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-100 text-center">
          <div className="text-3xl font-bold text-yellow-700">{partial}</div>
          <div className="text-sm text-yellow-600 mt-1">Partial</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-3xl font-bold text-gray-600">{notBuilt}</div>
          <div className="text-sm text-gray-500 mt-1">Not Built</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 shadow-sm border border-red-100 text-center">
          <div className="text-3xl font-bold text-red-700">{deprecated}</div>
          <div className="text-sm text-red-600 mt-1">Deprecated</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4 shadow-sm border border-indigo-100 text-center">
          <div className="text-3xl font-bold text-indigo-700">{coverage.platforms.length}</div>
          <div className="text-sm text-indigo-600 mt-1">Platforms</div>
        </div>
      </div>

      {/* Coverage Matrix */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Coverage Matrix (first 20 platforms)</h2>
          <p className="text-xs text-gray-500 mt-1">
            ✅ built/verified &nbsp; 🟡 partial &nbsp; ⬜ not_built &nbsp; 🔴 deprecated &nbsp; — none tracked
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-gray-600 font-medium sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Platform</th>
                {DISPLAY_CATEGORIES.map((cat) => (
                  <th key={cat} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap">
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPlatforms.map((plat) => (
                <tr key={plat} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">
                    {plat}
                  </td>
                  {DISPLAY_CATEGORIES.map((cat) => {
                    const st = coverage.matrix[plat]?.[cat];
                    return (
                      <td key={cat} className="px-2 py-2 text-center">
                        {st ? STATUS_EMOJI[st] ?? '⬜' : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Catalog ─────────────────────────────────────────────────────────────

function CatalogTab() {
  const [offerings, setOfferings] = useState<ApiOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiOffering | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [fPlatform, setFPlatform] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fAuth, setFAuth] = useState('');

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (fPlatform) sp.set('platform', fPlatform);
    if (fCategory) sp.set('category', fCategory);
    if (fStatus) sp.set('status', fStatus);
    if (fAuth) sp.set('auth_type', fAuth);
    const res = await fetch(`/api/admin/platform-api-catalog/offerings?${sp}`);
    const data = await res.json() as { offerings: ApiOffering[] };
    setOfferings(data.offerings ?? []);
    setLoading(false);
  }, [fPlatform, fCategory, fStatus, fAuth]);

  useEffect(() => { void loadOfferings(); }, [loadOfferings]);

  const selectOffering = (o: ApiOffering) => {
    setSelected(o);
    setEditStatus(o.implementation_status);
    setEditNotes(o.notes ?? '');
    setTestResult(null);
  };

  const saveEdits = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/admin/platform-api-catalog/offerings/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ implementation_status: editStatus, notes: editNotes }),
    });
    setSaving(false);
    void loadOfferings();
    setSelected(null);
  };

  const testEndpoint = async () => {
    if (!selected) return;
    setTesting(true);
    const res = await fetch('/api/admin/platform-api-catalog/test-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offering_id: selected.id }),
    });
    const data = await res.json() as Record<string, unknown>;
    setTestResult(data);
    setTesting(false);
  };

  const platforms = [...new Set(offerings.map((o) => o.platform))].sort();
  const categories = [...new Set(offerings.map((o) => o.category))].sort();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300">
          <option value="">All Platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300">
          <option value="">All Statuses</option>
          {['built', 'verified', 'partial', 'stub', 'not_built', 'deprecated'].map((s) =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fAuth} onChange={(e) => setFAuth(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300">
          <option value="">All Auth Types</option>
          {['oauth2', 'api_key', 'bearer_token', 'basic', 'none'].map((a) =>
            <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={loadOfferings}
          className="ml-auto px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          Filter
        </button>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
          + Add Offering
        </button>
      </div>

      {showAddForm && <AddOfferingForm onSaved={() => { setShowAddForm(false); void loadOfferings(); }} />}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Platform</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Method</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Endpoint</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Capability</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Category</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Rate Limit</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Auth</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id}
                  className="border-t border-gray-50 hover:bg-indigo-50 cursor-pointer"
                  onClick={() => selectOffering(o)}>
                  <td className="px-3 py-2">
                    <Badge label={o.platform} colorClass="bg-indigo-50 text-indigo-700" />
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={o.http_method} colorClass={METHOD_COLORS[o.http_method] ?? 'bg-gray-100 text-gray-700'} />
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs text-gray-700 font-mono">{o.endpoint_path}</code>
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{o.capability}</td>
                  <td className="px-3 py-2">
                    <Badge label={o.category} colorClass={CATEGORY_COLORS[o.category] ?? 'bg-gray-100 text-gray-700'} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {o.rate_limit_calls ? `${o.rate_limit_calls}/${o.rate_limit_window}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{o.auth_type}</td>
                  <td className="px-3 py-2">
                    <Badge label={o.implementation_status} colorClass={STATUS_COLORS[o.implementation_status] ?? 'bg-gray-100 text-gray-700'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {offerings.length} offerings shown
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <Badge label={selected.platform} colorClass="bg-indigo-50 text-indigo-700" />
                <span className="ml-2 font-semibold text-gray-900">{selected.api_name}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge label={selected.http_method} colorClass={METHOD_COLORS[selected.http_method] ?? 'bg-gray-100 text-gray-700'} />
                <code className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">{selected.endpoint_path}</code>
              </div>
              <p className="text-gray-700">{selected.capability}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Category:</span> <Badge label={selected.category} colorClass={CATEGORY_COLORS[selected.category] ?? 'bg-gray-100 text-gray-700'} /></div>
                <div><span className="text-gray-500">Auth:</span> <span className="font-medium">{selected.auth_type}</span></div>
                <div><span className="text-gray-500">Rate Limit:</span> {selected.rate_limit_calls ? `${selected.rate_limit_calls} / ${selected.rate_limit_window}` : 'Unknown'}</div>
                <div><span className="text-gray-500">Tier:</span> {selected.rate_limit_tier}</div>
                <div><span className="text-gray-500">Stable:</span> {selected.is_stable ? 'Yes' : 'No'}</div>
                <div><span className="text-gray-500">Requires Review:</span> {selected.requires_review ? 'Yes' : 'No'}</div>
                {selected.our_api_route && (
                  <div className="col-span-2"><span className="text-gray-500">Our Route:</span> <code className="text-xs font-mono text-indigo-600">{selected.our_api_route}</code></div>
                )}
              </div>

              {selected.required_scopes.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Required Scopes:</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.required_scopes.map((s) => (
                      <code key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</code>
                    ))}
                  </div>
                </div>
              )}

              {selected.required_env_vars.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Required Env Vars:</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.required_env_vars.map((v) => (
                      <code key={v} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">{v}</code>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Notes:</div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{selected.notes}</p>
                </div>
              )}

              {/* Edit status */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Implementation Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
                    {['not_built', 'stub', 'partial', 'built', 'verified', 'deprecated'].map((s) =>
                      <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                    rows={3} placeholder="Add notes about this endpoint…"
                    className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdits} disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={testEndpoint} disabled={testing}
                    className="px-4 py-2 bg-gray-700 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50">
                    {testing ? 'Testing…' : 'Test Endpoint'}
                  </button>
                </div>
                {testResult && (() => {
                  const trStatus = String(testResult['status'] ?? '');
                  const trMessage = testResult['message'] ? String(testResult['message']) : null;
                  const trHttp = testResult['http_status'] ? String(testResult['http_status']) : null;
                  const trMs = String(testResult['response_time_ms'] ?? 0);
                  const trErr = testResult['error_message'] ? String(testResult['error_message']) : null;
                  const trBg = trStatus === 'pass' ? 'bg-green-50 text-green-800' : trStatus === 'skip' ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800';
                  return (
                    <div className={`rounded-lg p-3 text-sm ${trBg}`}>
                      <div className="font-medium">Test result: {trStatus}</div>
                      {trMessage && <div className="text-xs mt-1">{trMessage}</div>}
                      {trHttp && <div className="text-xs mt-1">HTTP {trHttp} in {trMs}ms</div>}
                      {trErr && <div className="text-xs mt-1">{trErr}</div>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Offering Form ────────────────────────────────────────────────────────

function AddOfferingForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    platform: '', api_version: '', api_name: '', endpoint_path: '',
    http_method: 'GET', capability: '', category: 'publish',
    auth_type: 'oauth2', implementation_status: 'not_built', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/platform-api-catalog/offerings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
  };

  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 grid grid-cols-2 gap-3">
      <h3 className="col-span-2 font-semibold text-gray-800">Add New Offering</h3>
      {[
        ['platform', 'Platform', 'text'],
        ['api_name', 'API Name', 'text'],
        ['api_version', 'API Version', 'text'],
        ['endpoint_path', 'Endpoint Path', 'text'],
        ['capability', 'Capability', 'text'],
      ].map(([k, label, type]) => (
        <div key={k}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input type={type} value={form[k as keyof typeof form]} onChange={upd(k)}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full" />
        </div>
      ))}
      <div>
        <label className="block text-xs text-gray-500 mb-1">HTTP Method</label>
        <select value={form.http_method} onChange={upd('http_method')}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Category</label>
        <select value={form.category} onChange={upd('category')}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
          {['publish', 'read', 'analytics', 'messaging', 'review', 'campaign', 'auth', 'webhook', 'insight', 'media'].map((c) =>
            <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Auth Type</label>
        <select value={form.auth_type} onChange={upd('auth_type')}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
          {['oauth2', 'api_key', 'bearer_token', 'basic', 'none'].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select value={form.implementation_status} onChange={upd('implementation_status')}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
          {['not_built', 'stub', 'partial', 'built', 'verified', 'deprecated'].map((s) =>
            <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea value={form.notes} onChange={upd('notes')} rows={2}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full resize-none" />
      </div>
      <div className="col-span-2 flex gap-2">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Offering'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Quota Monitor ───────────────────────────────────────────────────────

function QuotaMonitorTab() {
  const [summary, setSummary] = useState<QuotaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fPlatform, setFPlatform] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (fPlatform) sp.set('platform', fPlatform);
    const res = await fetch(`/api/admin/platform-api-catalog/quota?${sp}`);
    const data = await res.json() as { summary: QuotaSummary[] };
    setSummary(data.summary ?? []);
    setLoading(false);
  }, [fPlatform]);

  useEffect(() => { void load(); }, [load]);

  const syncQuota = async () => {
    setSyncing(true);
    await fetch('/api/admin/platform-api-catalog/sync-quota', { method: 'POST' });
    setSyncing(false);
    void load();
  };

  const alerts = summary.filter((s) => parseFloat(s.max_quota_pct) > 80);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm">
          <option value="">All Platforms</option>
          {summary.map((s) => <option key={s.platform} value={s.platform}>{s.platform}</option>)}
        </select>
        <button onClick={syncQuota} disabled={syncing}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {syncing ? 'Syncing…' : 'Sync Quota'}
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-red-700">Quota Warnings ({alerts.length})</h3>
          {alerts.map((a) => (
            <div key={a.platform} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-4">
              <span className="text-red-600 text-lg">⚠️</span>
              <div>
                <div className="font-medium text-red-800">{a.platform}</div>
                <div className="text-xs text-red-600">{parseFloat(a.max_quota_pct).toFixed(1)}% quota used today</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : summary.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No quota data for today yet. Run Sync Quota or wait for the cron job.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((s) => {
            const pct = parseFloat(s.max_quota_pct);
            return (
              <div key={s.platform} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-800">{s.platform}</span>
                  <span className={`text-sm font-bold ${pct > 85 ? 'text-red-600' : pct > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <QuotaBar pct={pct} />
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>Calls: <span className="font-medium text-gray-700">{s.total_calls ?? 0}</span></div>
                  <div>Throttled: <span className={`font-medium ${(s.total_throttled ?? 0) > 0 ? 'text-orange-600' : 'text-gray-700'}`}>{s.total_throttled ?? 0}</span></div>
                  <div>Errors: <span className={`font-medium ${(s.total_errors ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>{s.total_errors ?? 0}</span></div>
                </div>
                {s.last_call_at && (
                  <div className="mt-1 text-xs text-gray-400">
                    Last call: {new Date(s.last_call_at).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Testing ─────────────────────────────────────────────────────────────

function TestingTab() {
  const [offerings, setOfferings] = useState<ApiOffering[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);
  const [fPlatform, setFPlatform] = useState('');
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (fPlatform) sp.set('platform', fPlatform);
    const res = await fetch(`/api/admin/platform-api-catalog/offerings?${sp}`);
    const data = await res.json() as { offerings: ApiOffering[] };
    setOfferings(data.offerings ?? []);
    setLoading(false);
  }, [fPlatform]);

  useEffect(() => { void loadOfferings(); }, [loadOfferings]);

  const runTest = async (offering: ApiOffering) => {
    setRunningId(offering.id);
    const res = await fetch('/api/admin/platform-api-catalog/test-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offering_id: offering.id }),
    });
    const data = await res.json() as TestResult;
    setTestResults((prev) => ({ ...prev, [offering.id]: data }));
    setRunningId(null);
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const o of offerings) {
      await runTest(o);
    }
    setRunningAll(false);
  };

  const platforms = [...new Set(offerings.map((o) => o.platform))].sort();

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm">
          <option value="">All Platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => void loadOfferings()}
          className="px-3 py-1.5 border border-gray-300 text-sm rounded-md hover:bg-gray-50">
          Filter
        </button>
        <button onClick={runAll} disabled={runningAll}
          className="ml-auto px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-50">
          {runningAll ? 'Running…' : `Run All Tests (${offerings.length})`}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Platform</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Method</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Endpoint</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Last Result</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Time (ms)</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => {
                const r = testResults[o.id];
                return (
                  <tr key={o.id} className="border-t border-gray-50">
                    <td className="px-3 py-2">
                      <Badge label={o.platform} colorClass="bg-indigo-50 text-indigo-700" />
                    </td>
                    <td className="px-3 py-2">
                      <Badge label={o.http_method} colorClass={METHOD_COLORS[o.http_method] ?? 'bg-gray-100 text-gray-700'} />
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-xs font-mono text-gray-700">{o.endpoint_path}</code>
                    </td>
                    <td className="px-3 py-2">
                      {r ? (
                        <Badge label={String(r.status ?? 'unknown')} colorClass={
                          r.status === 'pass' ? 'bg-green-100 text-green-800' :
                          r.status === 'skip' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        } />
                      ) : <span className="text-gray-400 text-xs">Not run</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {r?.response_time_ms != null ? `${String(r.response_time_ms)}ms` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => void runTest(o)}
                        disabled={runningId === o.id || runningAll}
                        className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50">
                        {runningId === o.id ? '…' : 'Test'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Changelog ───────────────────────────────────────────────────────────

function ChangelogTab() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [breakingChanges, setBreakingChanges] = useState<Record<string, unknown>[] | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    platform: '', change_type: 'deprecated', endpoint_path: '', description: '',
    effective_date: '', impact: 'medium', our_action_required: false, source_url: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/platform-api-catalog/changelog');
    const data = await res.json() as { entries: ChangelogEntry[] };
    setEntries(data.entries ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checkBreaking = async () => {
    setChecking(true);
    const res = await fetch('/api/admin/platform-api-catalog/check-breaking-changes', { method: 'POST' });
    const data = await res.json() as { breaking_changes: Record<string, unknown>[] };
    setBreakingChanges(data.breaking_changes ?? []);
    setChecking(false);
  };

  const saveEntry = async () => {
    setSaving(true);
    await fetch('/api/admin/platform-api-catalog/changelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEntry),
    });
    setSaving(false);
    setShowAddForm(false);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
          + Add Changelog Entry
        </button>
        <button onClick={checkBreaking} disabled={checking}
          className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50">
          {checking ? 'Checking…' : 'Check Breaking Changes'}
        </button>
      </div>

      {breakingChanges && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-semibold text-orange-800 mb-2">Breaking Changes Detected: {breakingChanges.length}</h3>
          {breakingChanges.length === 0 ? (
            <p className="text-sm text-orange-700">No breaking changes detected in the last 7 days.</p>
          ) : (
            <ul className="space-y-1">
              {breakingChanges.map((bc, i) => (
                <li key={i} className="text-sm text-orange-800">
                  {String(bc['platform'])} — {String(bc['endpoint_path'])} — Last test: {String(bc['last_test_status'])}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 grid grid-cols-2 gap-3">
          <h3 className="col-span-2 font-semibold text-gray-800">Add Changelog Entry</h3>
          {[['platform', 'Platform'], ['endpoint_path', 'Endpoint Path'], ['description', 'Description'], ['source_url', 'Source URL']].map(([k, label]) => (
            <div key={k} className={k === 'description' ? 'col-span-2' : ''}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input value={newEntry[k as keyof typeof newEntry] as string}
                onChange={(e) => setNewEntry((f) => ({ ...f, [k]: e.target.value }))}
                className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Change Type</label>
            <select value={newEntry.change_type} onChange={(e) => setNewEntry((f) => ({ ...f, change_type: e.target.value }))}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
              {['deprecated', 'new', 'breaking_change', 'rate_limit_change', 'scope_change'].map((t) =>
                <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Impact</label>
            <select value={newEntry.impact} onChange={(e) => setNewEntry((f) => ({ ...f, impact: e.target.value }))}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full">
              {['low', 'medium', 'high', 'critical'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Effective Date</label>
            <input type="date" value={newEntry.effective_date}
              onChange={(e) => setNewEntry((f) => ({ ...f, effective_date: e.target.value }))}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-full" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="action-required" checked={newEntry.our_action_required}
              onChange={(e) => setNewEntry((f) => ({ ...f, our_action_required: e.target.checked }))}
              className="rounded" />
            <label htmlFor="action-required" className="text-sm text-gray-700">Our action required</label>
          </div>
          <div className="col-span-2">
            <button onClick={saveEntry} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No changelog entries yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Platform</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Type</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Endpoint</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Description</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Date</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Impact</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Action?</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-50">
                  <td className="px-3 py-2"><Badge label={e.platform} colorClass="bg-indigo-50 text-indigo-700" /></td>
                  <td className="px-3 py-2"><Badge label={e.change_type} colorClass="bg-gray-100 text-gray-700" /></td>
                  <td className="px-3 py-2"><code className="text-xs font-mono text-gray-600">{e.endpoint_path ?? '—'}</code></td>
                  <td className="px-3 py-2 text-gray-700 max-w-sm truncate">{e.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{e.effective_date ?? '—'}</td>
                  <td className="px-3 py-2">
                    {e.impact && <Badge label={e.impact} colorClass={IMPACT_COLORS[e.impact] ?? 'bg-gray-100 text-gray-700'} />}
                  </td>
                  <td className="px-3 py-2">
                    {e.our_action_required && <Badge label="Action needed" colorClass="bg-orange-100 text-orange-800" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Implementation Gaps ─────────────────────────────────────────────────

function ImplementationGapsTab() {
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [top10, setTop10] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/platform-api-catalog/implementation-gaps');
    const data = await res.json() as { gaps: GapItem[]; top10: GapItem[] };
    setGaps(data.gaps ?? []);
    setTop10(data.top10 ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markInProgress = async (id: string) => {
    setMarkingId(id);
    await fetch(`/api/admin/platform-api-catalog/offerings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ implementation_status: 'stub' }),
    });
    setMarkingId(null);
    void load();
  };

  const effortColor = (effort: string) => {
    if (effort === 'Low') return 'bg-green-100 text-green-800';
    if (effort === 'High') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      {/* Top 10 */}
      {!loading && top10.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Top 10 Highest-Impact API Gaps</h2>
          <ol className="space-y-2">
            {top10.map((g, i) => (
              <li key={g.id} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">{i + 1}</span>
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{g.platform}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <Badge label={g.category} colorClass={CATEGORY_COLORS[g.category] ?? 'bg-gray-100 text-gray-700'} />
                  <span className="ml-2 text-gray-700">{g.capability}</span>
                </div>
                <Badge label={g.estimated_effort} colorClass={effortColor(g.estimated_effort)} />
                <span className="text-xs text-gray-400">Impact: {g.business_impact}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Full table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Gaps ({gaps.length})</h2>
          <span className="text-xs text-gray-400">Sorted by business impact</span>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Platform</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Category</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Capability</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Status</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Effort</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Impact</th>
                <th className="px-3 py-2 text-left text-xs text-gray-600 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2"><Badge label={g.platform} colorClass="bg-indigo-50 text-indigo-700" /></td>
                  <td className="px-3 py-2"><Badge label={g.category} colorClass={CATEGORY_COLORS[g.category] ?? 'bg-gray-100 text-gray-700'} /></td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{g.capability}</td>
                  <td className="px-3 py-2"><Badge label={g.current_status} colorClass={STATUS_COLORS[g.current_status] ?? 'bg-gray-100 text-gray-700'} /></td>
                  <td className="px-3 py-2"><Badge label={g.estimated_effort} colorClass={effortColor(g.estimated_effort)} /></td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-700">{g.business_impact}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => void markInProgress(g.id)} disabled={markingId === g.id}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
                      {markingId === g.id ? '…' : 'Mark In Progress'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Seed Banner ──────────────────────────────────────────────────────────────

function SeedBanner({ offeringsCount }: { offeringsCount: number }) {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const seed = async () => {
    setSeeding(true);
    const res = await fetch('/api/admin/platform-api-catalog/seed');
    const data = await res.json() as { inserted: number; skipped: number };
    setSeedResult(data);
    setSeeding(false);
  };

  if (offeringsCount > 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-4">
      <span className="text-2xl">🌱</span>
      <div className="flex-1">
        <div className="font-semibold text-amber-800">No API offerings in database yet</div>
        <div className="text-sm text-amber-700">Click Seed to load all 150+ platform API offerings.</div>
        {seedResult && (
          <div className="text-sm text-green-700 mt-1">Seeded: {seedResult.inserted} inserted, {seedResult.skipped} skipped.</div>
        )}
      </div>
      <button onClick={seed} disabled={seeding}
        className="px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50">
        {seeding ? 'Seeding…' : 'Seed All Offerings'}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'catalog' | 'quota-monitor' | 'testing' | 'changelog' | 'implementation-gaps';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'catalog', label: '📋 Catalog' },
  { id: 'quota-monitor', label: '📈 Quota Monitor' },
  { id: 'testing', label: '🧪 Testing' },
  { id: 'changelog', label: '📝 Changelog' },
  { id: 'implementation-gaps', label: '🔍 Gaps' },
];

export default function PlatformApiCatalogPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const [offeringsCount, setOfferingsCount] = useState<number>(-1);

  useEffect(() => {
    fetch('/api/admin/platform-api-catalog/offerings?')
      .then((r) => r.json())
      .then((d: { total: number }) => setOfferingsCount(d.total ?? 0))
      .catch(() => setOfferingsCount(0));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔌 Platform API Capabilities Catalog</h1>
          <p className="text-gray-500 mt-1">
            Registry of every API endpoint offered by all 36 platforms — implementation status, rate limits, auth types, quota monitoring, and gap analysis.
          </p>
        </div>
        {offeringsCount >= 0 && (
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {offeringsCount} offerings tracked
          </div>
        )}
      </div>

      {/* Seed Banner */}
      {offeringsCount === 0 && <SeedBanner offeringsCount={offeringsCount} />}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'quota-monitor' && <QuotaMonitorTab />}
        {tab === 'testing' && <TestingTab />}
        {tab === 'changelog' && <ChangelogTab />}
        {tab === 'implementation-gaps' && <ImplementationGapsTab />}
      </div>
    </div>
  );
}
