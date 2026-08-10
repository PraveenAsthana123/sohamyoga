'use client';
import { useState } from 'react';

// ── Mock data ──────────────────────────────────────────────────────────────────

const kpis = [
  { label: 'Health Profiles',     value: '1,248', delta: '+34 this week',  color: 'text-emerald-600' },
  { label: 'Daily Logs Today',    value: '742',   delta: '59% completion', color: 'text-blue-600'    },
  { label: 'Wearables Connected', value: '189',   delta: '15% of users',   color: 'text-violet-600'  },
  { label: 'Avg Wellness Score',  value: '72 /100', delta: '+3 vs last wk',color: 'text-amber-600'   },
  { label: 'Doctor Clearances',   value: '421',   delta: '34% of profiles',color: 'text-teal-600'    },
  { label: 'Avg BMI',             value: '23.8',  delta: 'Normal range',   color: 'text-pink-600'    },
];

const conditionStats = [
  { condition: 'anxiety',       count: 312, pct: 25 },
  { condition: 'hypertension',  count: 249, pct: 20 },
  { condition: 'arthritis',     count: 187, pct: 15 },
  { condition: 'depression',    count: 162, pct: 13 },
  { condition: 'chronic_pain',  count: 137, pct: 11 },
  { condition: 'diabetes',      count: 112, pct: 9  },
  { condition: 'asthma',        count: 87,  pct: 7  },
];

const bmiCategories = [
  { category: 'Underweight', count: 62,  pct: 5,  color: 'bg-yellow-400' },
  { category: 'Normal',      count: 799, pct: 64, color: 'bg-emerald-500' },
  { category: 'Overweight',  count: 299, pct: 24, color: 'bg-orange-400' },
  { category: 'Obese',       count: 88,  pct: 7,  color: 'bg-red-500'    },
];

const dailyLogToday = [
  { metric: 'Sleep',   logged: 621, total: 1248, avg: '6.8 hrs' },
  { metric: 'Water',   logged: 589, total: 1248, avg: '1,820 ml' },
  { metric: 'Steps',   logged: 412, total: 1248, avg: '7,240'    },
  { metric: 'Mood',    logged: 698, total: 1248, avg: '3.8 / 5'  },
  { metric: 'Energy',  logged: 678, total: 1248, avg: '3.6 / 5'  },
  { metric: 'Stress',  logged: 654, total: 1248, avg: '4.2 / 10' },
];

const wearables = [
  { platform: 'Fitbit',         connected: 89, status: 'connected',    icon: '⌚' },
  { platform: 'Garmin',         connected: 52, status: 'connected',    icon: '🏃' },
  { platform: 'Apple Health',   connected: 31, status: 'pending_auth', icon: '🍎' },
  { platform: 'Google Fit',     connected: 17, status: 'pending_auth', icon: '🔵' },
  { platform: 'Samsung Health', connected: 0,  status: 'disconnected', icon: '📱' },
  { platform: 'Polar',          connected: 0,  status: 'disconnected', icon: '🔴' },
];

const fitnessLevels = [
  { level: 'sedentary',   count: 249, pct: 20 },
  { level: 'light',       count: 312, pct: 25 },
  { level: 'moderate',    count: 437, pct: 35 },
  { level: 'active',      count: 187, pct: 15 },
  { level: 'very_active', count: 62,  pct: 5  },
];

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
  auto:              'bg-gray-100 text-gray-700',
  staff:             'bg-blue-100 text-blue-700',
  customer_confirm:  'bg-yellow-100 text-yellow-700',
  staff_approval:    'bg-orange-100 text-orange-700',
  admin:             'bg-purple-100 text-purple-700',
  admin_destructive: 'bg-red-100 text-red-700',
};

const STATUS_BADGE: Record<string, string> = {
  connected:    'bg-emerald-100 text-emerald-700',
  pending_auth: 'bg-yellow-100 text-yellow-700',
  disconnected: 'bg-gray-100 text-gray-500',
};

const TABS = ['Overview','Health Profiles','Body Metrics','Daily Logs','Wearables','Analytics','Integrations'];

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminWellnessPage() {
  const [tab, setTab] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Health &amp; Wellness</h1>
          <p className="text-sm text-gray-500 mt-1">Wave 17 — Health Profile · Body Metrics · Daily Log · Wearable Sync</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === i ? 'bg-teal-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpis.map(k => (
                <div key={k.label} className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.delta}</p>
                </div>
              ))}
            </div>

            {/* BMI distribution */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">BMI Distribution</h3>
              <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
                {bmiCategories.map(c => (
                  <div
                    key={c.category}
                    className={`${c.color} flex items-center justify-center text-white text-xs font-medium`}
                    style={{ width: `${c.pct}%` }}
                    title={`${c.category}: ${c.count} (${c.pct}%)`}
                  >
                    {c.pct >= 10 && `${c.pct}%`}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 flex-wrap">
                {bmiCategories.map(c => (
                  <div key={c.category} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${c.color}`} />
                    <span className="text-xs text-gray-600">{c.category} ({c.count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fitness level breakdown */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Fitness Level Distribution</h3>
              <div className="space-y-3">
                {fitnessLevels.map(f => (
                  <div key={f.level} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28 capitalize">{f.level.replace('_',' ')}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-teal-500" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">{f.count} ({f.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Health Profiles ── */}
        {tab === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Health Condition Frequency</h3>
              <div className="space-y-3">
                {conditionStats.map(c => (
                  <div key={c.condition} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-36 capitalize">{c.condition.replace('_',' ')}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full bg-rose-400" style={{ width: `${c.pct * 4}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-20 text-right">{c.count} ({c.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Special Modes</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Pregnancy Mode', count: 47,  color: 'text-pink-600'   },
                    { label: 'Senior Mode',     count: 89,  color: 'text-blue-600'   },
                    { label: 'Kids Mode',       count: 124, color: 'text-amber-600'  },
                    { label: 'Doctor Cleared',  count: 421, color: 'text-teal-600'   },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between">
                      <span className="text-sm text-gray-600">{m.label}</span>
                      <span className={`text-sm font-semibold ${m.color}`}>{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Top Allergies</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Pollen',    count: 287 },
                    { label: 'Dust',      count: 241 },
                    { label: 'Nuts',      count: 198 },
                    { label: 'Dairy',     count: 176 },
                    { label: 'Gluten',    count: 142 },
                  ].map(a => (
                    <div key={a.label} className="flex justify-between">
                      <span className="text-sm text-gray-600">{a.label}</span>
                      <span className="text-sm font-semibold text-gray-700">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Body Metrics ── */}
        {tab === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Records Total',  value: '3,742', sub: 'all time'    },
                { label: 'Avg Weight',     value: '68.4 kg', sub: 'latest'   },
                { label: 'Avg Height',     value: '167 cm',  sub: 'latest'   },
                { label: 'Avg BMI',        value: '23.8',    sub: 'normal'   },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">BMI Category Breakdown</h3>
              <div className="space-y-3">
                {bmiCategories.map(c => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28">{c.category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-20 text-right">{c.count} ({c.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Daily Logs ── */}
        {tab === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Today&apos;s Log Completion</h3>
              <div className="space-y-3">
                {dailyLogToday.map(d => {
                  const pct = Math.round(d.logged / d.total * 100);
                  return (
                    <div key={d.metric} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-16">{d.metric}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className="h-3 rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
                      <span className="text-xs font-medium text-gray-700 w-24 text-right">{d.avg}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Avg Sleep',  value: '6.8 hrs', icon: '😴', color: 'text-indigo-600' },
                { label: 'Avg Mood',   value: '3.8 / 5', icon: '😊', color: 'text-amber-600'  },
                { label: 'Avg Stress', value: '4.2 / 10',icon: '😤', color: 'text-red-500'    },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-5 text-center">
                  <div className="text-3xl">{s.icon}</div>
                  <p className={`text-2xl font-bold mt-2 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Wearables ── */}
        {tab === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {wearables.map(w => (
                <div key={w.platform} className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{w.icon}</span>
                    <span className="font-medium text-gray-800">{w.platform}</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{w.connected}</p>
                  <p className="text-xs text-gray-400 mb-3">connected devices</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[w.status]}`}>
                    {w.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">OAuth Configuration Required</p>
              <p className="text-xs text-amber-700 mt-1">
                Apple Health and Google Fit require OAuth app registration before customers can connect.
                Configure credentials in Settings → Integrations → Wearables.
              </p>
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {tab === 5 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">7-Day Wellness Score Trend</h3>
                {[
                  { day: 'Mon', score: 68 }, { day: 'Tue', score: 71 }, { day: 'Wed', score: 69 },
                  { day: 'Thu', score: 73 }, { day: 'Fri', score: 75 }, { day: 'Sat', score: 70 },
                  { day: 'Sun', score: 72 },
                ].map(d => (
                  <div key={d.day} className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-500 w-8">{d.day}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full bg-teal-500" style={{ width: `${d.score}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.score}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Wearable Data Quality</h3>
                <div className="space-y-2">
                  {[
                    { metric: 'Steps',      quality: 94 },
                    { metric: 'Heart Rate', quality: 87 },
                    { metric: 'Sleep',      quality: 79 },
                    { metric: 'Calories',   quality: 72 },
                    { metric: 'Stress',     quality: 61 },
                  ].map(m => (
                    <div key={m.metric} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24">{m.metric}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${m.quality >= 80 ? 'bg-emerald-500' : m.quality >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${m.quality}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{m.quality}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Integrations ── */}
        {tab === 6 && (
          <div className="space-y-6">
            {/* MCP Tools */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-1">MCP Tools (13)</h3>
              <p className="text-xs text-gray-500 mb-4">
                Health data tools — <code>get_health_profile</code> and <code>export_health_data</code> require staff_approval due to HIPAA/PIPEDA sensitive PII.
              </p>
              <div className="space-y-2">
                {mcpTools.map(t => (
                  <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <code className="text-xs font-mono text-gray-700 w-52">{t.name}</code>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-36 text-center ${TIER_BADGE[t.tier]}`}>
                      {t.tier}
                    </span>
                    <span className="text-xs text-gray-500 flex-1">{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DB Tables */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Database Tables</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
                {['health_profile','body_metrics','daily_wellness_log','wearable_sync',
                  'wearable_data_point','wellness_audit'].map(t => (
                  <span key={t} className="bg-gray-50 px-2 py-1 rounded">{t}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">Views: v_wellness_summary · v_daily_completeness · v_bmi_distribution</p>
            </div>

            {/* Foundation Tables */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Foundation Schema (db-foundation.sql)</h3>
              <p className="text-xs text-gray-500 mb-3">Core multi-tenancy + module config tables (shared across all waves)</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
                {['tenant','organization','app_user','module_config','module_config_audit'].map(t => (
                  <span key={t} className="bg-indigo-50 px-2 py-1 rounded">{t}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Master/Reference: ref_health_condition · ref_allergy · ref_injury_area · ref_yoga_style · ref_practice_goal · ref_wearable_platform · ref_milestone_type · ref_module_category
              </p>
            </div>

            {/* Wearable OAuth */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Wearable OAuth Platforms</h3>
              <div className="space-y-2">
                {wearables.map(w => (
                  <div key={w.platform} className="flex items-center gap-3 py-1">
                    <span className="text-lg">{w.icon}</span>
                    <span className="text-sm text-gray-700 w-36">{w.platform}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[w.status]}`}>
                      {w.status.replace('_',' ')}
                    </span>
                    {w.connected > 0 && (
                      <span className="text-xs text-gray-500">{w.connected} users connected</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
