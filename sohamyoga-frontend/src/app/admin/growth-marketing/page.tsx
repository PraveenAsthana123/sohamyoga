'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Experiment {
  id: number;
  name: string;
  hypothesis: string;
  channel: string | null;
  growth_lever: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  metric_primary: string | null;
  baseline_value: string | null;
  target_value: string | null;
  actual_value: string | null;
  lift_pct: string | null;
  investment_usd: string;
  roi_pct: string | null;
  notes: string | null;
  learnings: string | null;
  created_at: string;
}

interface MetricSnapshot {
  metric_name: string;
  value: string;
  recorded_at: string;
  source: string;
}

interface AARRRData {
  acquisition: { visitors: number; newSignups: number };
  activation: { count: number };
  retention: { activeCount: number };
  referral: { count: number };
  revenue: { mrr: number };
}

interface ApiData {
  experiments: Experiment[];
  latestMetrics: MetricSnapshot[];
  aarrr: AARRRData;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS = ['organic', 'paid', 'email', 'social', 'referral', 'product', 'partnership'];
const GROWTH_LEVERS = ['acquisition', 'activation', 'retention', 'referral', 'revenue'];
const EXPERIMENT_STATUSES = ['idea', 'planned', 'running', 'completed', 'cancelled'];
const KEY_METRICS = ['mrr', 'dau', 'churn_rate', 'ltv', 'cac', 'nps', 'activation_rate', 'referral_rate'];

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500/20 text-green-300 border-green-500/30',
  planned: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  idea: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const LEVER_COLORS: Record<string, string> = {
  acquisition: 'bg-blue-500/20 text-blue-200',
  activation: 'bg-green-500/20 text-green-200',
  retention: 'bg-teal-500/20 text-teal-200',
  referral: 'bg-violet-500/20 text-violet-200',
  revenue: 'bg-orange-500/20 text-orange-200',
};

const CHANNEL_COLORS: Record<string, string> = {
  organic: 'bg-emerald-500/20 text-emerald-200',
  paid: 'bg-red-500/20 text-red-200',
  email: 'bg-blue-500/20 text-blue-200',
  social: 'bg-pink-500/20 text-pink-200',
  referral: 'bg-violet-500/20 text-violet-200',
  product: 'bg-cyan-500/20 text-cyan-200',
  partnership: 'bg-amber-500/20 text-amber-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function fmt(n: number | string | null | undefined, prefix = '') {
  const val = Number(n ?? 0);
  return isNaN(val) ? '—' : `${prefix}${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

// ─── AARRR Dashboard Tab ──────────────────────────────────────────────────────

function AARRRDashboard({ aarrr }: { aarrr: AARRRData }) {
  const stages = [
    {
      label: 'Acquisition',
      icon: '🎯',
      color: 'border-blue-400/40 bg-blue-500/10',
      metrics: [
        { label: 'Page Visitors', value: fmt(aarrr.acquisition.visitors) },
        { label: 'New Signups (30d)', value: fmt(aarrr.acquisition.newSignups) },
      ],
      target: 1000,
      current: aarrr.acquisition.newSignups,
    },
    {
      label: 'Activation',
      icon: '⚡',
      color: 'border-green-400/40 bg-green-500/10',
      metrics: [
        { label: 'Onboarding Complete', value: fmt(aarrr.activation.count) },
      ],
      target: 100,
      current: aarrr.activation.count,
    },
    {
      label: 'Retention',
      icon: '🔄',
      color: 'border-teal-400/40 bg-teal-500/10',
      metrics: [
        { label: 'Active Users (30d)', value: fmt(aarrr.retention.activeCount) },
      ],
      target: 200,
      current: aarrr.retention.activeCount,
    },
    {
      label: 'Referral',
      icon: '📣',
      color: 'border-violet-400/40 bg-violet-500/10',
      metrics: [
        { label: 'Referral Signups', value: fmt(aarrr.referral.count) },
      ],
      target: 50,
      current: aarrr.referral.count,
    },
    {
      label: 'Revenue',
      icon: '💰',
      color: 'border-orange-400/40 bg-orange-500/10',
      metrics: [
        { label: 'MRR', value: `$${Number(aarrr.revenue.mrr).toLocaleString()}` },
      ],
      target: 10000,
      current: aarrr.revenue.mrr,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {stages.map(s => {
        const pct = s.target > 0 ? Math.min((s.current / s.target) * 100, 100) : 0;
        const trend = pct >= 80 ? '↑' : pct >= 40 ? '→' : '↓';
        const trendColor = pct >= 80 ? 'text-green-300' : pct >= 40 ? 'text-yellow-300' : 'text-red-300';

        return (
          <div key={s.label} className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl ${s.color}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{s.icon}</span>
              <span className={`text-lg font-bold ${trendColor}`}>{trend}</span>
            </div>
            <h3 className="text-white font-semibold text-sm mb-2">{s.label}</h3>
            {s.metrics.map(m => (
              <div key={m.label} className="mt-1">
                <p className="text-white/50 text-xs">{m.label}</p>
                <p className="text-white font-bold text-lg">{m.value}</p>
              </div>
            ))}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>{pct.toFixed(0)}% of target</span>
                <span>/{s.target.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full">
                <div className="h-full rounded-full bg-white/40 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Experiments Tab ──────────────────────────────────────────────────────────

function Experiments({ experiments, onUpdate }: {
  experiments: Experiment[];
  onUpdate: () => void;
}) {
  const statusGroups = ['running', 'planned', 'completed', 'idea', 'cancelled'];

  return (
    <div className="space-y-6">
      {statusGroups.map(status => {
        const group = experiments.filter(e => e.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wide mb-3 capitalize">
              {status} ({group.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.map(exp => {
                const lift = Number(exp.lift_pct ?? 0);
                const roi = Number(exp.roi_pct ?? 0);
                return (
                  <GlassCard key={exp.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-white font-semibold">{exp.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[exp.status] ?? 'bg-gray-500/20 text-gray-200 border-gray-500/30'}`}>
                        {exp.status}
                      </span>
                    </div>
                    <p className="text-white/60 text-xs mb-3 italic">&ldquo;{exp.hypothesis}&rdquo;</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {exp.channel && <Badge label={exp.channel} color={CHANNEL_COLORS[exp.channel] ?? 'bg-gray-500/20 text-gray-200'} />}
                      {exp.growth_lever && <Badge label={exp.growth_lever} color={LEVER_COLORS[exp.growth_lever] ?? 'bg-gray-500/20 text-gray-200'} />}
                      {exp.metric_primary && <Badge label={exp.metric_primary} color="bg-white/10 text-white/60" />}
                    </div>
                    {exp.metric_primary && (
                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-white/40">Baseline</p>
                          <p className="text-white font-mono">{exp.baseline_value ?? '—'}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-white/40">Target</p>
                          <p className="text-white font-mono">{exp.target_value ?? '—'}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-white/40">Actual</p>
                          <p className="text-white font-mono">{exp.actual_value ?? '—'}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {exp.lift_pct !== null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${lift >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                          Lift: {lift >= 0 ? '+' : ''}{lift.toFixed(1)}%
                        </span>
                      )}
                      {exp.roi_pct !== null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roi >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                          ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {exp.learnings && (
                      <div className="mt-3 bg-white/5 rounded-xl p-3">
                        <p className="text-white/40 text-xs mb-1">Learnings</p>
                        <p className="text-white/70 text-xs">{exp.learnings}</p>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>
        );
      })}
      {experiments.length === 0 && <p className="text-white/40 text-center py-8">No experiments yet. Run your first one!</p>}
    </div>
  );
}

// ─── Run Experiment Tab ───────────────────────────────────────────────────────

function RunExperiment({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', hypothesis: '', channel: '', growth_lever: '', metric_primary: '',
    baseline_value: '', target_value: '', investment_usd: '',
    start_date: '', end_date: '', notes: '', status: 'idea',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/growth-marketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setMsg('Experiment created!'); onCreated(); }
      else { const d = await res.json(); setMsg(d.error ?? 'Error'); }
    } finally { setSaving(false); }
  }

  return (
    <GlassCard>
      <h2 className="text-white font-semibold text-lg mb-6">Run New Experiment</h2>
      {msg && <div className="mb-4 text-sm text-green-300">{msg}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-white/60 text-xs mb-1">Experiment Name *</label>
          <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 text-xs mb-1">Hypothesis * (We believe that…)</label>
          <textarea required value={form.hypothesis} onChange={e => set('hypothesis', e.target.value)}
            rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Channel</label>
          <select value={form.channel} onChange={e => set('channel', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            <option value="">Select channel</option>
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Growth Lever (AARRR)</label>
          <select value={form.growth_lever} onChange={e => set('growth_lever', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            <option value="">Select lever</option>
            {GROWTH_LEVERS.map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Primary Metric</label>
          <input type="text" value={form.metric_primary} onChange={e => set('metric_primary', e.target.value)}
            placeholder="e.g. signup rate, MRR"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30" />
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm">
            {EXPERIMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {[
          { label: 'Baseline Value', key: 'baseline_value' },
          { label: 'Target Value', key: 'target_value' },
          { label: 'Investment (USD)', key: 'investment_usd' },
        ].map(({ label, key }) => (
          <div key={key}>
            <label className="block text-white/60 text-xs mb-1">{label}</label>
            <input type="number" value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
          </div>
        ))}

        <div>
          <label className="block text-white/60 text-xs mb-1">Start Date</label>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">End Date</label>
          <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-white/60 text-xs mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-medium">
            {saving ? 'Creating…' : 'Create Experiment'}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}

// ─── Growth Metrics Tab ───────────────────────────────────────────────────────

function GrowthMetrics({ latestMetrics, onUpdated }: {
  latestMetrics: MetricSnapshot[];
  onUpdated: () => void;
}) {
  const metricMap = new Map(latestMetrics.map(m => [m.metric_name, m]));
  const [updateMetric, setUpdateMetric] = useState<string | null>(null);
  const [updateValue, setUpdateValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleUpdate(metricName: string) {
    setSaving(true);
    try {
      await fetch('/api/admin/growth-marketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'metric_snapshot', metric_name: metricName, value: Number(updateValue) }),
      });
      setUpdateMetric(null);
      setUpdateValue('');
      onUpdated();
    } finally { setSaving(false); }
  }

  const METRIC_LABELS: Record<string, string> = {
    mrr: 'MRR', dau: 'DAU', churn_rate: 'Churn Rate',
    ltv: 'LTV', cac: 'CAC', nps: 'NPS',
    activation_rate: 'Activation Rate', referral_rate: 'Referral Rate',
  };

  const METRIC_ICONS: Record<string, string> = {
    mrr: '💰', dau: '👥', churn_rate: '🔻', ltv: '📈',
    cac: '📉', nps: '⭐', activation_rate: '⚡', referral_rate: '📣',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {KEY_METRICS.map(metric => {
        const snap = metricMap.get(metric);
        return (
          <GlassCard key={metric}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{METRIC_ICONS[metric]}</span>
              <button
                onClick={() => { setUpdateMetric(metric === updateMetric ? null : metric); setUpdateValue(''); }}
                className="text-white/40 hover:text-white/80 text-xs"
              >
                Update
              </button>
            </div>
            <p className="text-white/50 text-xs uppercase tracking-wide">{METRIC_LABELS[metric] ?? metric}</p>
            <p className="text-white text-2xl font-bold mt-1">
              {snap ? Number(snap.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </p>
            {snap && <p className="text-white/30 text-xs mt-1">{snap.recorded_at}</p>}
            {updateMetric === metric && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number" value={updateValue} onChange={e => setUpdateValue(e.target.value)}
                  placeholder="New value"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs"
                />
                <button onClick={() => void handleUpdate(metric)} disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs">
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

// ─── Channel Mix Tab ──────────────────────────────────────────────────────────

function ChannelMix({ experiments }: { experiments: Experiment[] }) {
  const byChannel = CHANNELS.map(ch => ({
    channel: ch,
    count: experiments.filter(e => e.channel === ch).length,
    avgRoi: (() => {
      const exps = experiments.filter(e => e.channel === ch && e.roi_pct !== null);
      return exps.length > 0 ? exps.reduce((s, e) => s + Number(e.roi_pct), 0) / exps.length : null;
    })(),
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  const byLever = GROWTH_LEVERS.map(lever => ({
    lever,
    count: experiments.filter(e => e.growth_lever === lever).length,
  })).filter(c => c.count > 0);

  const maxCount = Math.max(...byChannel.map(c => c.count), 1);
  const maxLeverCount = Math.max(...byLever.map(c => c.count), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Experiments by Channel</h3>
        <div className="space-y-3">
          {byChannel.map(c => (
            <div key={c.channel}>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span className="capitalize">{c.channel}</span>
                <span>{c.count} experiments{c.avgRoi !== null ? ` · ROI: ${c.avgRoi >= 0 ? '+' : ''}${c.avgRoi.toFixed(1)}%` : ''}</span>
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500/60"
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {byChannel.length === 0 && <p className="text-white/40 text-sm">No experiment data yet.</p>}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Experiments by AARRR Lever</h3>
        <div className="space-y-3">
          {byLever.map(c => (
            <div key={c.lever}>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span className="capitalize">{c.lever}</span>
                <span>{c.count}</span>
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/60"
                  style={{ width: `${(c.count / maxLeverCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {byLever.length === 0 && <p className="text-white/40 text-sm">No lever data yet.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Playbook Tab ─────────────────────────────────────────────────────────────

const PLAYBOOKS: Record<string, { icon: string; tactics: string[] }> = {
  Acquisition: {
    icon: '🎯',
    tactics: ['SEO content marketing & keyword targeting', 'Paid ads (Google, Meta, LinkedIn)', 'Social media organic growth', 'Referral program with incentives', 'Conference & community presence'],
  },
  Activation: {
    icon: '⚡',
    tactics: ['Streamlined onboarding flow', 'Welcome email sequence', 'In-app tooltips & walkthroughs', 'First value moment optimization', 'Onboarding completion rewards'],
  },
  Retention: {
    icon: '🔄',
    tactics: ['Loyalty program & points', 'Re-engagement email campaigns', 'Personalized content recommendations', 'Usage-based push notifications', 'Weekly digest / progress reports'],
  },
  Referral: {
    icon: '📣',
    tactics: ['Affiliate partner program', 'Share-to-earn incentives', 'Word-of-mouth amplification', 'Partner co-marketing', 'Community ambassador program'],
  },
  Revenue: {
    icon: '💰',
    tactics: ['Upsell & cross-sell campaigns', 'Pricing tier optimization', 'Expansion revenue from existing customers', 'Annual plan discounts', 'Enterprise pricing conversations'],
  },
};

function Playbook() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Object.entries(PLAYBOOKS).map(([stage, { icon, tactics }]) => (
        <GlassCard key={stage}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-white font-semibold">{stage}</h3>
          </div>
          <ul className="space-y-2">
            {tactics.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-indigo-400 mt-0.5">→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['AARRR Dashboard', 'Experiments', 'Run Experiment', 'Growth Metrics', 'Channel Mix', 'Playbook'] as const;
type Tab = typeof TABS[number];

export default function GrowthMarketingPage() {
  const [tab, setTab] = useState<Tab>('AARRR Dashboard');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/growth-marketing');
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runningCount = data?.experiments.filter(e => e.status === 'running').length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Growth Marketing Hub 🚀</h1>
            <p className="text-white/50 text-sm mt-1">AARRR funnel · experiments · metrics · playbooks</p>
          </div>
          {runningCount > 0 && (
            <div className="backdrop-blur-md bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
              <p className="text-green-300 font-semibold text-sm">🟢 {runningCount} experiments running</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <TabButton key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-white/40 py-12 text-center">Loading…</div>
        ) : (
          <>
            {tab === 'AARRR Dashboard' && data && <AARRRDashboard aarrr={data.aarrr} />}
            {tab === 'Experiments' && data && (
              <Experiments experiments={data.experiments} onUpdate={load} />
            )}
            {tab === 'Run Experiment' && (
              <RunExperiment onCreated={() => { void load(); setTab('Experiments'); }} />
            )}
            {tab === 'Growth Metrics' && data && (
              <GrowthMetrics latestMetrics={data.latestMetrics} onUpdated={load} />
            )}
            {tab === 'Channel Mix' && data && <ChannelMix experiments={data.experiments} />}
            {tab === 'Playbook' && <Playbook />}
          </>
        )}
      </div>
    </div>
  );
}
