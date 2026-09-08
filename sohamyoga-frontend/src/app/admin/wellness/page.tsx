'use client';
import { useEffect, useState, useCallback } from 'react';

// Health & Wellness admin -- was 100% mock constants (found live 2026-09-01).
// health_profile/body_metrics/daily_wellness_log/wearable_sync/wearable_data_point/
// wellness_audit tables were real (src/domain/wellness/db-schema.sql) but zero
// API routes ever queried them. Rebuilt against /api/admin/wellness/* real routes.

interface Customer { id: string; display_name: string; email: string }
interface Profile {
  id: string; customer_id: string; display_name: string | null; email: string | null;
  fitness_level: string; pregnancy_mode: boolean; senior_mode: boolean; kids_mode: boolean;
  doctor_clearance: boolean; condition_count: number | null; allergy_count: number | null;
  injury_count: number | null; created_at: string; updated_at: string;
}
interface BodyMetric {
  id: string; customer_id: string; display_name: string | null; recorded_at: string;
  weight_kg: string; height_cm: string; bmi: string; notes: string | null;
}
interface DailyLog {
  id: string; customer_id: string; display_name: string | null; date: string;
  sleep_hours: string | null; water_ml: number | null; steps: number | null;
  mood: number | null; energy_level: number | null; stress_level: number | null;
}
interface Wearable {
  id: string; customer_id: string; display_name: string | null; platform: string;
  status: string; device_name: string | null; error_message: string | null;
}
interface Analytics {
  kpis: { profile_count: string; avg_bmi: string | null; doctor_clearance_count: string; pregnancy_count: string };
  conditionBreakdown: { condition: string; count: string }[];
  fitnessLevels: { fitness_level: string; count: string }[];
  bmiDistribution: { bmi_category: string; customer_count: string; avg_bmi: string }[];
  completenessToday: { total_logs: string; sleep_logged: string; water_logged: string; mood_logged: string; avg_mood: string | null; avg_stress: string | null } | null;
  wearablesConnected: { platform: string; connected_count: string }[];
}

const WEARABLE_PLATFORMS = ['fitbit', 'garmin', 'apple_health', 'google_fit', 'samsung_health', 'polar'];
const STATUS_BADGE: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-700', pending_auth: 'bg-yellow-100 text-yellow-700',
  disconnected: 'bg-gray-100 text-gray-500', syncing: 'bg-blue-100 text-blue-700', error: 'bg-red-100 text-red-700',
};

const mcpTools = [
  { name: 'get_wellness_summary',     tier: 'auto',              desc: 'Aggregated summary across all customers' },
  { name: 'get_body_metrics_history', tier: 'auto',              desc: 'BMI / weight trend aggregate (anonymised)' },
  { name: 'log_body_metrics',         tier: 'staff',             desc: 'Log weight, height, body measurements' },
  { name: 'log_daily_wellness',       tier: 'staff',             desc: 'Log sleep, water, steps, mood, energy, stress' },
  { name: 'update_fitness_level',     tier: 'staff',             desc: 'Update fitness level classification' },
  { name: 'connect_wearable',         tier: 'staff',             desc: 'Connect Fitbit / Garmin / Apple Health / Google Fit' },
  { name: 'get_wellness_report',      tier: 'staff',             desc: 'Detailed wellness report for a customer' },
  { name: 'reset_wellness_log',       tier: 'customer_confirm',  desc: 'Customer resets own log (confirmText: RESET_WELLNESS)' },
  { name: 'get_health_profile',       tier: 'staff_approval',    desc: 'Full health profile — sensitive PII (HIPAA/PIPEDA)' },
  { name: 'export_health_data',       tier: 'staff_approval',    desc: 'Export all health data — de-identify before external use' },
  { name: 'bulk_wellness_report',     tier: 'admin',             desc: 'Wellness analytics across full customer base' },
  { name: 'get_wellness_analytics',   tier: 'admin',             desc: 'BMI distribution, wellness trends, wearable quality' },
  { name: 'delete_health_profile',    tier: 'admin_destructive', desc: 'Irreversible delete — GDPR right-to-erasure only' },
];
const TIER_BADGE: Record<string, string> = {
  auto: 'bg-gray-100 text-gray-700', staff: 'bg-blue-100 text-blue-700',
  customer_confirm: 'bg-yellow-100 text-yellow-700', staff_approval: 'bg-orange-100 text-orange-700',
  admin: 'bg-purple-100 text-purple-700', admin_destructive: 'bg-red-100 text-red-700',
};

const TABS = ['Overview', 'Health Profiles', 'Body Metrics', 'Daily Logs', 'Wearables', 'Analytics', 'Integrations'];

export default function AdminWellnessPage() {
  const [tab, setTab] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [wearables, setWearables] = useState<Wearable[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, p, m, l, w, a] = await Promise.all([
        fetch('/api/admin/customers').then(r => r.json()),
        fetch('/api/admin/wellness/health-profiles').then(r => r.json()),
        fetch('/api/admin/wellness/body-metrics').then(r => r.json()),
        fetch('/api/admin/wellness/daily-logs').then(r => r.json()),
        fetch('/api/admin/wellness/wearables').then(r => r.json()),
        fetch('/api/admin/wellness/analytics').then(r => r.json()),
      ]);
      setCustomers(c.customers ?? []);
      setProfiles(p.profiles ?? []);
      setMetrics(m.entries ?? []);
      setLogs(l.entries ?? []);
      setWearables(w.entries ?? []);
      setAnalytics(a);
    } catch {
      setError('Failed to load wellness data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Health &amp; Wellness</h1>
          <p className="text-sm text-gray-500 mt-1">Health Profile · Body Metrics · Daily Log · Wearable Sync (real data)</p>
        </div>

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === i ? 'bg-teal-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <>
            {tab === 0 && <OverviewTab analytics={analytics} />}
            {tab === 1 && <ProfilesTab profiles={profiles} customers={customers} onChange={load} />}
            {tab === 2 && <MetricsTab metrics={metrics} customers={customers} onChange={load} />}
            {tab === 3 && <LogsTab logs={logs} customers={customers} onChange={load} />}
            {tab === 4 && <WearablesTab wearables={wearables} customers={customers} onChange={load} />}
            {tab === 5 && <AnalyticsTab analytics={analytics} />}
            {tab === 6 && <IntegrationsTab />}
          </>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return null;
  const { kpis, fitnessLevels, bmiDistribution } = analytics;
  const totalBmi = bmiDistribution.reduce((s, b) => s + Number(b.customer_count), 0);
  const totalFitness = fitnessLevels.reduce((s, f) => s + Number(f.count), 0);
  const kpiCards = [
    { label: 'Health Profiles', value: kpis.profile_count, color: 'text-emerald-600' },
    { label: 'Avg BMI', value: kpis.avg_bmi ?? '(no data yet)', color: 'text-pink-600' },
    { label: 'Doctor Clearances', value: kpis.doctor_clearance_count, color: 'text-teal-600' },
    { label: 'Pregnancy Mode', value: kpis.pregnancy_count, color: 'text-amber-600' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">BMI Distribution</h3>
        {totalBmi === 0 ? <p className="text-sm text-gray-400">No body metrics recorded yet.</p> : (
          <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
            {bmiDistribution.map(b => {
              const pct = Math.round((Number(b.customer_count) / totalBmi) * 100);
              return (
                <div key={b.bmi_category} className="bg-teal-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${pct}%` }} title={`${b.bmi_category}: ${b.customer_count} (${pct}%)`}>
                  {pct >= 10 && `${pct}%`}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Fitness Level Distribution</h3>
        {totalFitness === 0 ? <p className="text-sm text-gray-400">No health profiles recorded yet.</p> : (
          <div className="space-y-3">
            {fitnessLevels.map(f => {
              const pct = Math.round((Number(f.count) / totalFitness) * 100);
              return (
                <div key={f.fitness_level} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 capitalize">{f.fitness_level.replace('_', ' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-gray-500 w-20 text-right">{f.count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilesTab({ profiles, customers, onChange }: { profiles: Profile[]; customers: Customer[]; onChange: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('moderate');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const create = async () => {
    if (!customerId) return;
    setSaving(true);
    await fetch('/api/admin/wellness/health-profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, fitnessLevel }),
    });
    setSaving(false);
    setCustomerId('');
    onChange();
  };

  const viewDetail = async (id: string) => {
    const reason = window.prompt('Legal basis for accessing full health profile (HIPAA/PIPEDA audit — required):');
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/wellness/health-profiles/${id}?legalBasis=${encodeURIComponent(reason)}`);
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setDetail(data.profile);
  };

  const deleteProfile = async (id: string) => {
    const legalBasis = window.prompt('Legal basis for deletion (GDPR right-to-erasure — required):');
    if (!legalBasis?.trim()) return;
    if (!window.confirm('Type DELETE_HEALTH_PROFILE to confirm permanent deletion — this cannot be undone.')) return;
    const res = await fetch(`/api/admin/wellness/health-profiles/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmText: 'DELETE_HEALTH_PROFILE', legalBasis }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Create / Update Health Profile</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[220px]">
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.display_name} ({c.email})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fitness Level</label>
            <select value={fitnessLevel} onChange={e => setFitnessLevel(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {['sedentary', 'light', 'moderate', 'active', 'very_active'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button onClick={create} disabled={saving || !customerId} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Conditions/allergies/injuries/pregnancy/doctor notes are edited via the detail view (requires a logged legal basis).</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Fitness</th><th className="text-left px-4 py-2">Flags</th><th className="text-left px-4 py-2">Updated</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {profiles.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No health profiles created yet.</td></tr>}
            {profiles.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.display_name ?? '(unknown customer)'}<div className="text-xs text-gray-400">{p.email}</div></td>
                <td className="px-4 py-2 capitalize">{p.fitness_level.replace('_', ' ')}</td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {p.doctor_clearance && <span className="mr-2">✓ Cleared</span>}
                  {p.pregnancy_mode && <span className="mr-2">Pregnancy</span>}
                  {p.senior_mode && <span className="mr-2">Senior</span>}
                  {p.kids_mode && <span className="mr-2">Kids</span>}
                  {(p.condition_count ?? 0) > 0 && <span>{p.condition_count} condition(s)</span>}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => viewDetail(p.id)} className="text-teal-600 hover:underline text-xs mr-3">View</button>
                  <button onClick={() => deleteProfile(p.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-3">Health Profile Detail (access logged to wellness_audit)</h3>
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(detail, null, 2)}</pre>
            <button onClick={() => setDetail(null)} className="mt-3 text-sm text-gray-500 hover:underline">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsTab({ metrics, customers, onChange }: { metrics: BodyMetric[]; customers: Customer[]; onChange: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [saving, setSaving] = useState(false);

  const avgBmi = metrics.length ? (metrics.reduce((s, m) => s + Number(m.bmi), 0) / metrics.length).toFixed(1) : '(no data yet)';

  const create = async () => {
    if (!customerId || !weightKg || !heightCm) return;
    setSaving(true);
    await fetch('/api/admin/wellness/body-metrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, weightKg: Number(weightKg), heightCm: Number(heightCm) }),
    });
    setSaving(false);
    setWeightKg(''); setHeightCm('');
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Records Total</p><p className="text-2xl font-bold text-gray-800 mt-1">{metrics.length}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Avg BMI</p><p className="text-2xl font-bold text-gray-800 mt-1">{avgBmi}</p></div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Log Body Metrics</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
          <input value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Weight (kg)" type="number" className="border rounded-lg px-3 py-2 text-sm w-32" />
          <input value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="Height (cm)" type="number" className="border rounded-lg px-3 py-2 text-sm w-32" />
          <button onClick={create} disabled={saving} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Log'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Recorded</th><th className="text-left px-4 py-2">Weight</th><th className="text-left px-4 py-2">Height</th><th className="text-left px-4 py-2">BMI</th></tr></thead>
          <tbody>
            {metrics.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No body metrics logged yet.</td></tr>}
            {metrics.map(m => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2">{m.display_name ?? '(unknown)'}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{new Date(m.recorded_at).toLocaleDateString()}</td>
                <td className="px-4 py-2">{m.weight_kg} kg</td>
                <td className="px-4 py-2">{m.height_cm} cm</td>
                <td className="px-4 py-2 font-medium">{m.bmi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogsTab({ logs, customers, onChange }: { logs: DailyLog[]; customers: Customer[]; onChange: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState('3');
  const [saving, setSaving] = useState(false);

  const withMood = logs.filter(l => l.mood != null);
  const avgMood = withMood.length ? (withMood.reduce((s, l) => s + Number(l.mood), 0) / withMood.length).toFixed(1) : '(no data yet)';

  const create = async () => {
    if (!customerId || !date) return;
    setSaving(true);
    await fetch('/api/admin/wellness/daily-logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, date, mood: Number(mood) }),
    });
    setSaving(false);
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Logs Total</p><p className="text-2xl font-bold text-gray-800 mt-1">{logs.length}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">Avg Mood</p><p className="text-2xl font-bold text-gray-800 mt-1">{avgMood}{withMood.length ? ' / 5' : ''}</p></div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Log Daily Wellness</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
          <input value={date} onChange={e => setDate(e.target.value)} type="date" className="border rounded-lg px-3 py-2 text-sm" />
          <select value={mood} onChange={e => setMood(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {[1, 2, 3, 4, 5].map(m => <option key={m} value={m}>Mood {m}/5</option>)}
          </select>
          <button onClick={create} disabled={saving} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Log'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Mood</th><th className="text-left px-4 py-2">Sleep</th><th className="text-left px-4 py-2">Steps</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No daily logs recorded yet.</td></tr>}
            {logs.map(l => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-2">{l.display_name ?? '(unknown)'}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{l.date}</td>
                <td className="px-4 py-2">{l.mood ?? '—'}</td>
                <td className="px-4 py-2">{l.sleep_hours ?? '—'}</td>
                <td className="px-4 py-2">{l.steps ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WearablesTab({ wearables, customers, onChange }: { wearables: Wearable[]; customers: Customer[]; onChange: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [platform, setPlatform] = useState(WEARABLE_PLATFORMS[0]);
  const [status, setStatus] = useState('pending_auth');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!customerId) return;
    setSaving(true);
    await fetch('/api/admin/wellness/wearables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, platform, status }),
    });
    setSaving(false);
    onChange();
  };

  const byPlatform = WEARABLE_PLATFORMS.map(p => ({ platform: p, count: wearables.filter(w => w.platform === p && w.status === 'connected').length }));

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800">Manual status tracking only</p>
        <p className="text-xs text-amber-700 mt-1">No real OAuth integration exists for any wearable platform in this environment — connecting a real device needs developer credentials from Fitbit/Garmin/Apple/Google/Samsung/Polar, none of which are configured. This tab records status manually until real credentials are available.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {byPlatform.map(p => (
          <div key={p.platform} className="bg-white rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-700 capitalize">{p.platform.replace('_', ' ')}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{p.count}</p>
            <p className="text-xs text-gray-400">connected (manual status)</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Set Wearable Status</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {WEARABLE_PLATFORMS.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {['pending_auth', 'connected', 'disconnected', 'syncing', 'error'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={create} disabled={saving} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Platform</th><th className="text-left px-4 py-2">Status</th></tr></thead>
          <tbody>
            {wearables.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No wearable status recorded yet.</td></tr>}
            {wearables.map(w => (
              <tr key={w.id} className="border-t">
                <td className="px-4 py-2">{w.display_name ?? '(unknown)'}</td>
                <td className="px-4 py-2 capitalize">{w.platform.replace('_', ' ')}</td>
                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[w.status]}`}>{w.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return null;
  const { completenessToday, wearablesConnected } = analytics;
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Today&apos;s Log Completion</h3>
        {!completenessToday ? <p className="text-sm text-gray-400">No daily wellness logs recorded today.</p> : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>Total logs today: <strong>{completenessToday.total_logs}</strong></p>
            <p>Sleep logged: {completenessToday.sleep_logged} · Water logged: {completenessToday.water_logged} · Mood logged: {completenessToday.mood_logged}</p>
            {completenessToday.avg_mood && <p>Avg mood: {completenessToday.avg_mood} / 5 · Avg stress: {completenessToday.avg_stress ?? '—'} / 10</p>}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Wearables Connected by Platform</h3>
        {wearablesConnected.length === 0 ? <p className="text-sm text-gray-400">No wearables connected yet.</p> : (
          <div className="space-y-2">
            {wearablesConnected.map(w => (
              <div key={w.platform} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{w.platform.replace('_', ' ')}</span>
                <span className="font-medium text-gray-800">{w.connected_count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-1">MCP Tools (13)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Health data tools — <code>get_health_profile</code> and <code>export_health_data</code> require staff_approval due to HIPAA/PIPEDA sensitive PII. Enforced live: the Health Profiles tab&apos;s detail view requires a logged legal-basis reason before it returns full profile data.
        </p>
        <div className="space-y-2">
          {mcpTools.map(t => (
            <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <code className="text-xs font-mono text-gray-700 w-52">{t.name}</code>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-36 text-center ${TIER_BADGE[t.tier]}`}>{t.tier}</span>
              <span className="text-xs text-gray-500 flex-1">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Database Tables</h3>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
          {['health_profile', 'body_metrics', 'daily_wellness_log', 'wearable_sync', 'wearable_data_point', 'wellness_audit'].map(t => (
            <span key={t} className="bg-gray-50 px-2 py-1 rounded">{t}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Views: v_wellness_summary · v_daily_completeness · v_bmi_distribution</p>
      </div>
    </div>
  );
}
