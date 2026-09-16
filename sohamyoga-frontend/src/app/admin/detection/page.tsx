'use client';

import { useEffect, useState, useCallback } from 'react';

interface DetectionAlert {
  id: number;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  detected_value: number | null;
  threshold_value: number | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
}

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-500',
  low: 'border-green-500',
};
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/30 text-red-200',
  high: 'bg-orange-500/30 text-orange-200',
  medium: 'bg-amber-500/30 text-amber-200',
  low: 'bg-green-500/30 text-green-200',
};
const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-500/30 text-blue-200',
  investigating: 'bg-purple-500/30 text-purple-200',
  resolved: 'bg-green-500/30 text-green-200',
  false_positive: 'bg-gray-500/30 text-gray-200',
};

type Tab = 'active' | 'all' | 'run' | 'rules' | 'analytics';

export default function DetectionPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [alerts, setAlerts] = useState<DetectionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [running, setRunning] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rules, setRules] = useState([
    { name: 'High Request Volume (Intrusion)', threshold: 100, entity: 'IP Address', period: '1 hour' },
    { name: 'Bot Session Activity', threshold: 1000, entity: 'Session ID', period: '1 hour' },
    { name: 'Suspicious Order Value (Fraud)', threshold: 10, entity: 'Order', period: '7 days', note: '10x avg' },
  ]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAlerts = useCallback(async (params: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const q = new URLSearchParams(params);
      const res = await fetch(`/api/admin/detection?${q}`);
      const data = await res.json() as { alerts: DetectionAlert[] };
      setAlerts(data.alerts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'active') loadAlerts({ status: 'open' });
    else if (tab === 'all') loadAlerts({});
    else if (tab === 'analytics') loadAlerts({});
  }, [tab, loadAlerts]);

  const updateStatus = async (id: number, status: string) => {
    await fetch('/api/admin/detection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    showToast(`Status updated to ${status}`);
    loadAlerts(tab === 'active' ? { status: 'open' } : {});
  };

  const runDetection = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/detection/run', { method: 'POST' });
      const data = await res.json() as { alerts_created: number };
      showToast(`Detection complete — ${data.alerts_created} alert(s) created`);
      loadAlerts({ status: 'open' });
      setTab('active');
    } finally {
      setRunning(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterType && a.alert_type !== filterType) return false;
    if (filterSeverity && a.severity !== filterSeverity) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  const alertTypes = [...new Set(alerts.map((a) => a.alert_type))];
  const typeCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
    return acc;
  }, {});
  const severityCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});
  const resolved = alerts.filter((a) => a.status === 'resolved' || a.status === 'false_positive').length;
  const resolutionRate = alerts.length ? Math.round((resolved / alerts.length) * 100) : 0;

  const renderAlertCard = (a: DetectionAlert) => (
    <div key={a.id} className={`rounded-xl border-l-4 bg-white/5 border border-white/10 p-4 ${SEVERITY_BORDER[a.severity] || 'border-white/20'}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[a.severity]}`}>{a.severity}</span>
            <span className="text-xs text-white/50 bg-white/10 rounded-full px-2 py-0.5">{a.alert_type}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[a.status]}`}>{a.status}</span>
          </div>
          <p className="font-semibold text-white">{a.title}</p>
          {a.description && <p className="text-sm text-white/60 mt-1">{a.description}</p>}
          {a.detected_value !== null && (
            <p className="text-xs text-white/40 mt-1">
              Detected: <span className="text-white/70">{a.detected_value}</span>
              {a.threshold_value !== null && <> / Threshold: <span className="text-white/70">{a.threshold_value}</span></>}
            </p>
          )}
          <p className="text-xs text-white/30 mt-1">{new Date(a.created_at).toLocaleString()}</p>
        </div>
        {a.status === 'open' && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => updateStatus(a.id, 'investigating')} className="text-xs rounded-lg bg-purple-500/20 border border-purple-500/30 px-2 py-1 text-purple-200 hover:bg-purple-500/30">Investigate</button>
            <button onClick={() => updateStatus(a.id, 'resolved')} className="text-xs rounded-lg bg-green-500/20 border border-green-500/30 px-2 py-1 text-green-200 hover:bg-green-500/30">Resolve</button>
            <button onClick={() => updateStatus(a.id, 'false_positive')} className="text-xs rounded-lg bg-gray-500/20 border border-gray-500/30 px-2 py-1 text-gray-200 hover:bg-gray-500/30">False +</button>
          </div>
        )}
        {a.status === 'investigating' && (
          <button onClick={() => updateStatus(a.id, 'resolved')} className="text-xs rounded-lg bg-green-500/20 border border-green-500/30 px-2 py-1 text-green-200 hover:bg-green-500/30">Resolve</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white backdrop-blur-md shadow-xl">{toast}</div>
      )}
      <h1 className="mb-6 text-3xl font-bold text-white">Detection 🔍</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['active','all','run','rules','analytics'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'active' ? 'Active Alerts' : t === 'all' ? 'All Alerts' : t === 'run' ? 'Run Detection' : t === 'rules' ? 'Anomaly Rules' : 'Analytics'}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Active Alerts</h2>
          {loading ? <p className="text-white/60">Loading…</p> : (
            <div className="space-y-3">
              {alerts.map(renderAlertCard)}
              {!alerts.length && <p className="py-8 text-center text-white/40">No active alerts — system looks clean</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">All Alerts</h2>
          <div className="mb-4 flex gap-2 flex-wrap">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none">
              <option value="" className="bg-slate-800">All Types</option>
              {alertTypes.map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
            </select>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none">
              <option value="" className="bg-slate-800">All Severities</option>
              {['low','medium','high','critical'].map((s) => <option key={s} value={s} className="bg-slate-800">{s}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none">
              <option value="" className="bg-slate-800">All Statuses</option>
              {['open','investigating','resolved','false_positive'].map((s) => <option key={s} value={s} className="bg-slate-800">{s}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {filteredAlerts.map(renderAlertCard)}
            {!filteredAlerts.length && <p className="py-8 text-center text-white/40">No alerts match filters</p>}
          </div>
        </div>
      )}

      {tab === 'run' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Run Detection Engine</h2>
          <p className="text-sm text-white/60 mb-6">Runs all built-in anomaly detection rules against live data and creates alerts for any violations found.</p>
          <button onClick={runDetection} disabled={running}
            className="mb-6 rounded-xl bg-red-600 px-8 py-3 text-white font-semibold hover:bg-red-500 disabled:opacity-50 text-lg">
            {running ? '⚡ Running…' : '⚡ Run Detection Engine'}
          </button>
          <div className="space-y-3">
            {[
              { title: 'Intrusion Detection', desc: 'Scans api_request_log for any IP address making more than 100 requests within the last hour.', severity: 'high' },
              { title: 'Bot Detection', desc: 'Scans customer_event for any session_id generating more than 1,000 events within the last hour.', severity: 'high' },
              { title: 'Fraud Detection', desc: 'Scans sales_order for orders with a value more than 10x the 30-day average order value.', severity: 'critical' },
            ].map(({ title, desc, severity }) => (
              <div key={title} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">{title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_BADGE[severity]}`}>{severity}</span>
                </div>
                <p className="text-sm text-white/60">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Anomaly Rules</h2>
          <p className="text-sm text-white/50 mb-4">Note: threshold values edited here are UI-only. For persistence, configure via environment variables.</p>
          <div className="space-y-4">
            {rules.map((rule, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="font-semibold text-white mb-3">{rule.name}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Threshold</label>
                    <input type="number" value={rule.threshold}
                      onChange={(e) => setRules((rs) => rs.map((r, j) => j === i ? { ...r, threshold: parseInt(e.target.value) } : r))}
                      className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Entity</label>
                    <input value={rule.entity} readOnly className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white/60" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Time Window</label>
                    <input value={rule.period} readOnly className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white/60" />
                  </div>
                </div>
                {rule.note && <p className="text-xs text-white/30 mt-2">{rule.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={glass}>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wide">By Type</p>
              <div className="space-y-2">
                {Object.entries(typeCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-white/80">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-red-400/60 rounded" style={{ width: `${Math.max(8, (count / alerts.length) * 80)}px` }} />
                      <span className="text-sm text-white font-semibold">{count}</span>
                    </div>
                  </div>
                ))}
                {!Object.keys(typeCounts).length && <p className="text-white/40 text-sm">No data</p>}
              </div>
            </div>
            <div className={glass}>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wide">By Severity</p>
              <div className="space-y-2">
                {Object.entries(severityCounts).map(([sev, count]) => (
                  <div key={sev} className="flex items-center justify-between">
                    <span className={`text-sm rounded-full px-2 py-0.5 ${SEVERITY_BADGE[sev]}`}>{sev}</span>
                    <span className="text-sm text-white font-semibold">{count}</span>
                  </div>
                ))}
                {!Object.keys(severityCounts).length && <p className="text-white/40 text-sm">No data</p>}
              </div>
            </div>
            <div className={glass}>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wide">Resolution Rate</p>
              <p className="text-4xl font-bold text-white">{resolutionRate}%</p>
              <p className="text-sm text-white/50 mt-1">{resolved} of {alerts.length} resolved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
