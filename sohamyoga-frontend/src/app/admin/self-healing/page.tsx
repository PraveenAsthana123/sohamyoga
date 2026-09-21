'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HealingRule {
  rule_id: string;
  name: string;
  trigger_condition: string;
  action: string;
  priority: number;
  is_active: boolean;
  last_triggered: string | null;
}

interface Incident {
  id: number;
  module: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detection_method: 'auto' | 'manual';
  status: 'detecting' | 'healing' | 'resolved';
  time_to_detect_s: number | null;
  time_to_heal_s: number | null;
  created_at: string;
  resolved_at: string | null;
}

interface RepairLogEntry {
  id: number;
  module: string;
  action_taken: string;
  success: boolean;
  details: string;
  created_at: string;
}

interface SHSettings {
  scan_interval_seconds: string;
  max_auto_retries: string;
  alert_on_failure: string;
  escalate_after_n_failures: string;
}

interface HealthSummary {
  uptime_pct: number;
  mttr_min: number;
  auto_fixes_today: number;
}

interface SelfHealingData {
  rules: HealingRule[];
  incidents: Incident[];
  repair_log: RepairLogEntry[];
  settings: SHSettings;
  health_summary: HealthSummary;
}

type Tab = 'dashboard' | 'rules' | 'incidents' | 'repair_log' | 'settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-200 text-red-900',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[severity] ?? 'bg-gray-100 text-gray-700'}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    detecting: 'bg-yellow-100 text-yellow-800',
    healing: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SelfHealingPage() {
  const [data, setData] = useState<SelfHealingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [scanning, setScanning] = useState(false);
  const [settings, setSettings] = useState<SHSettings>({
    scan_interval_seconds: '30',
    max_auto_retries: '3',
    alert_on_failure: 'true',
    escalate_after_n_failures: '2',
  });
  const [ruleForm, setRuleForm] = useState({ name: '', trigger_condition: '', rule_action: '', priority: 5 });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/self-healing');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as SelfHealingData;
      setData(json);
      setSettings(json.settings);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTriggerScan = async () => {
    setScanning(true);
    await fetch('/api/admin/self-healing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_scan' }),
    });
    await fetchData();
    setScanning(false);
  };

  const handleToggleRule = async (ruleId: string, is_active: boolean) => {
    await fetch('/api/admin/self-healing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'rule', id: ruleId, is_active: !is_active }),
    });
    await fetchData();
  };

  const handleAddRule = async () => {
    if (!ruleForm.name || !ruleForm.trigger_condition || !ruleForm.rule_action) return;
    await fetch('/api/admin/self-healing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_rule', ...ruleForm }),
    });
    setRuleForm({ name: '', trigger_condition: '', rule_action: '', priority: 5 });
    await fetchData();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'rules', label: 'Rules' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'repair_log', label: 'Repair Log' },
    { id: 'settings', label: 'Settings' },
  ];

  if (loading) return <div className="p-8 text-gray-500">Loading Self-Healing data…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const { health_summary: hs } = data;
  const errorsDetected = data.incidents.length;
  const uptime = hs.uptime_pct ?? 99;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Self-Healing System</h1>
        <p className="text-gray-500 text-sm mt-1">Automated detection, repair, and recovery for the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Auto-Fixes Applied', value: hs.auto_fixes_today, color: 'text-green-600' },
          { label: 'Errors Detected', value: errorsDetected, color: 'text-red-500' },
          { label: 'MTTR (min)', value: hs.mttr_min.toFixed(1), color: 'text-blue-600' },
          { label: 'Uptime %', value: `${uptime.toFixed(1)}%`, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">System Health</h2>
              <button
                onClick={handleTriggerScan}
                disabled={scanning}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {scanning ? 'Scanning…' : 'Manual Health Scan'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={uptime >= 99 ? '#22c55e' : uptime >= 95 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${uptime} ${100 - uptime}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800 rotate-0">
                  {uptime.toFixed(0)}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="text-green-600 font-semibold">{hs.auto_fixes_today}</span> auto-fixes applied today
                </p>
                <p className="text-sm text-gray-600">
                  MTTR: <span className="font-semibold">{hs.mttr_min.toFixed(1)} min</span>
                </p>
                <p className="text-sm text-gray-600">
                  Active incidents: <span className={`font-semibold ${data.incidents.filter(i => i.status !== 'resolved').length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.incidents.filter(i => i.status !== 'resolved').length}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Recent Auto-Fix Events</h2>
            <div className="space-y-2">
              {data.repair_log.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-xs ${r.success ? 'bg-green-500' : 'bg-red-500'}`}>
                    {r.success ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{r.action_taken}</p>
                    <p className="text-xs text-gray-400">{r.module} · {fmt(r.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-800 mb-3">Add Rule</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                className="border border-gray-300 rounded px-3 py-1.5 text-sm col-span-2 md:col-span-1"
                placeholder="Rule name"
                value={ruleForm.name}
                onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="Trigger condition"
                value={ruleForm.trigger_condition}
                onChange={e => setRuleForm(f => ({ ...f, trigger_condition: e.target.value }))}
              />
              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={ruleForm.rule_action}
                onChange={e => setRuleForm(f => ({ ...f, rule_action: e.target.value }))}
              >
                <option value="">Select action…</option>
                {['restart_service', 'clear_cache', 'retry_job', 'alert_admin', 'scale_up'].map(a => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              <button
                onClick={handleAddRule}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Add Rule
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Rule Name', 'Trigger Condition', 'Action', 'Priority', 'Active', 'Last Triggered', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rules.map(r => (
                  <tr key={r.rule_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{r.trigger_condition}</td>
                    <td className="px-4 py-3">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">{r.action}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-600">{r.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                        {r.is_active ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.last_triggered ? fmt(r.last_triggered) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleRule(r.rule_id, r.is_active)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {r.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['ID', 'Module', 'Severity', 'Detected By', 'Status', 'TTD (s)', 'TTH (s)', 'Created', 'Resolved'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.incidents.map(inc => (
                <tr key={inc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">#{inc.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{inc.module}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${inc.detection_method === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {inc.detection_method}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{inc.time_to_detect_s ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{inc.time_to_heal_s ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(inc.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{inc.resolved_at ? fmt(inc.resolved_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Repair Log Tab */}
      {activeTab === 'repair_log' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Module', 'Action Taken', 'Result', 'Details', 'Timestamp'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.repair_log.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">#{r.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{r.module}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{r.action_taken}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {r.success ? 'success' : 'failed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-sm truncate">{r.details}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scan Interval: <strong>{settings.scan_interval_seconds}s</strong>
            </label>
            <input
              type="range" min={10} max={300} step={10}
              value={parseInt(settings.scan_interval_seconds, 10)}
              onChange={e => setSettings(s => ({ ...s, scan_interval_seconds: e.target.value }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>10s</span><span>300s</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Auto Retries: <strong>{settings.max_auto_retries}</strong>
            </label>
            <input
              type="range" min={1} max={10}
              value={parseInt(settings.max_auto_retries, 10)}
              onChange={e => setSettings(s => ({ ...s, max_auto_retries: e.target.value }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>10</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Escalate After N Failures: <strong>{settings.escalate_after_n_failures}</strong>
            </label>
            <input
              type="range" min={1} max={5}
              value={parseInt(settings.escalate_after_n_failures, 10)}
              onChange={e => setSettings(s => ({ ...s, escalate_after_n_failures: e.target.value }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>5</span></div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="alert_on_failure"
              checked={settings.alert_on_failure === 'true'}
              onChange={e => setSettings(s => ({ ...s, alert_on_failure: e.target.checked ? 'true' : 'false' }))}
              className="accent-blue-600 w-4 h-4"
            />
            <label htmlFor="alert_on_failure" className="text-sm font-medium text-gray-700">Alert on Failure</label>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            onClick={() => alert('Settings saved (UI only — wire PATCH endpoint to persist)')}
          >
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}
