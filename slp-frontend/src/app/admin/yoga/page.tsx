'use client';

import { useState } from 'react';

type Tab = 'overview' | 'asanas' | 'sequences' | 'pranayama' | 'meditation' | 'analytics' | 'integrations';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'asanas',       label: 'Asana Library' },
  { key: 'sequences',    label: 'Sequences' },
  { key: 'pranayama',    label: 'Pranayama' },
  { key: 'meditation',   label: 'Meditation' },
  { key: 'analytics',    label: 'Analytics' },
  { key: 'integrations', label: 'Integrations' },
];

interface KpiCard { label: string; value: string; sub?: string; color?: string; }

function KpiCard({ label, value, sub, color = 'bg-white' }: KpiCard) {
  return (
    <div className={`${color} rounded-xl border border-gray-100 p-5 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab() {
  const kpis: KpiCard[] = [
    { label: 'Total Asanas',        value: '84',  sub: '12 styles covered' },
    { label: 'Class Sequences',     value: '37',  sub: '14 templates' },
    { label: 'Pranayama Techniques',value: '18',  sub: '8 patterns' },
    { label: 'Meditation Sessions', value: '52',  sub: '9 styles' },
    { label: 'Mudras',              value: '24',  sub: '5 types' },
    { label: 'Published Content',   value: '143', sub: 'student-visible', color: 'bg-emerald-50' },
  ];
  const diffBreakdown = [
    { level: 'Beginner',     count: 34, pct: 40, color: 'bg-green-400' },
    { level: 'Intermediate', count: 29, pct: 35, color: 'bg-yellow-400' },
    { level: 'Advanced',     count: 13, pct: 15, color: 'bg-red-400' },
    { level: 'All Levels',   count: 8,  pct: 10, color: 'bg-blue-400' },
  ];
  const styleBreakdown = [
    { style: 'Hatha',      asanas: 28 },
    { style: 'Vinyasa',    asanas: 24 },
    { style: 'Yin',        asanas: 16 },
    { style: 'Restorative',asanas: 12 },
    { style: 'Prenatal',   asanas: 8 },
    { style: 'Kids',       asanas: 6 },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Asana Difficulty Breakdown</h3>
          <div className="space-y-3">
            {diffBreakdown.map(d => (
              <div key={d.level}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{d.level}</span><span>{d.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Styles by Asana Count</h3>
          <div className="space-y-2">
            {styleBreakdown.map(s => (
              <div key={s.style} className="flex justify-between text-sm border-b border-gray-50 pb-1">
                <span className="text-gray-700">{s.style}</span>
                <span className="font-semibold text-indigo-700">{s.asanas} asanas</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Asana Library ─────────────────────────────────────────────────────────────

function AsanasTab() {
  const bodyParts = [
    { part: 'Hips & Hamstrings', count: 32 },
    { part: 'Core',              count: 28 },
    { part: 'Shoulders & Back',  count: 24 },
    { part: 'Legs',              count: 20 },
    { part: 'Chest',             count: 15 },
    { part: 'Arms & Wrists',     count: 12 },
  ];
  const doshaMap = [
    { dosha: 'Vata',  count: 42, color: 'bg-blue-400' },
    { dosha: 'Pitta', count: 38, color: 'bg-orange-400' },
    { dosha: 'Kapha', count: 35, color: 'bg-green-400' },
  ];
  const samplePoses = [
    { name: 'Tadasana',           sanskrit: 'Mountain Pose',       difficulty: 'Beginner',     styles: 'Hatha, Vinyasa' },
    { name: 'Adho Mukha Svanasana',sanskrit: 'Downward Facing Dog',difficulty: 'Beginner',     styles: 'Vinyasa, Hatha' },
    { name: 'Virabhadrasana I',   sanskrit: 'Warrior I',           difficulty: 'Beginner',     styles: 'Hatha, Power' },
    { name: 'Vrksasana',          sanskrit: 'Tree Pose',           difficulty: 'Beginner',     styles: 'Hatha' },
    { name: 'Sirsasana',          sanskrit: 'Headstand',           difficulty: 'Advanced',     styles: 'Ashtanga' },
    { name: 'Kapotasana',         sanskrit: 'Pigeon Pose',         difficulty: 'Intermediate', styles: 'Yin, Vinyasa' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Targeted Body Parts</h3>
          <div className="space-y-2">
            {bodyParts.map(b => (
              <div key={b.part} className="flex justify-between text-sm border-b border-gray-50 pb-1">
                <span className="text-gray-700">{b.part}</span>
                <span className="font-semibold">{b.count} asanas</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Dosha Balance Coverage</h3>
          <div className="space-y-3">
            {doshaMap.map(d => (
              <div key={d.dosha}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{d.dosha}</span><span>{d.count} asanas</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100">
                  <div className={`h-3 rounded-full ${d.color}`} style={{ width: `${(d.count / 84) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Sample Poses</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Sanskrit Name</th>
                <th className="pb-2 font-medium">English Name</th>
                <th className="pb-2 font-medium">Difficulty</th>
                <th className="pb-2 font-medium">Styles</th>
              </tr>
            </thead>
            <tbody>
              {samplePoses.map(p => (
                <tr key={p.name} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-indigo-700">{p.name}</td>
                  <td className="py-2 text-gray-700">{p.sanskrit}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      p.difficulty === 'Beginner' ? 'bg-green-100 text-green-700'
                      : p.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'}`}>{p.difficulty}</span>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{p.styles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sequences ─────────────────────────────────────────────────────────────────

function SequencesTab() {
  const goals = [
    { goal: 'Flexibility',   count: 12 },
    { goal: 'Stress Relief', count: 10 },
    { goal: 'Strength',      count: 8 },
    { goal: 'Balance',       count: 6 },
    { goal: 'Energy',        count: 5 },
    { goal: 'Sleep',         count: 4 },
  ];
  const templates = [
    { title: '30-min Beginner Morning Flow',   style: 'Vinyasa',    difficulty: 'Beginner',     asanas: 12, duration: '30 min' },
    { title: 'Deep Hip Opener (Yin)',          style: 'Yin',        difficulty: 'All Levels',   asanas: 8,  duration: '45 min' },
    { title: 'Power Core Sequence',            style: 'Power',      difficulty: 'Advanced',     asanas: 16, duration: '60 min' },
    { title: 'Prenatal Gentle Flow',           style: 'Prenatal',   difficulty: 'All Levels',   asanas: 10, duration: '40 min' },
    { title: 'Restorative Evening Wind Down',  style: 'Restorative',difficulty: 'Beginner',     asanas: 7,  duration: '35 min' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Sequences" value="37" />
        <KpiCard label="Published"       value="28" />
        <KpiCard label="Templates"       value="14" sub="teacher-reusable" />
        <KpiCard label="Avg Asanas/Seq"  value="11" sub="avg per sequence" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Goals Covered</h3>
          <div className="space-y-2">
            {goals.map(g => (
              <div key={g.goal} className="flex justify-between text-sm border-b border-gray-50 pb-1">
                <span className="text-gray-700">{g.goal}</span>
                <span className="font-semibold text-purple-700">{g.count} sequences</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {[
              { status: 'Published', count: 28, color: 'bg-green-500' },
              { status: 'Draft',     count: 6,  color: 'bg-gray-400' },
              { status: 'Archived',  count: 3,  color: 'bg-slate-300' },
            ].map(s => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  <span className="text-sm text-gray-700">{s.status}</span>
                </div>
                <span className="text-sm font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Studio Templates</h3>
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.title} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-500">{t.style} · {t.asanas} asanas · {t.duration}</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                t.difficulty === 'Beginner' ? 'bg-green-100 text-green-700'
                : t.difficulty === 'All Levels' ? 'bg-blue-100 text-blue-700'
                : t.difficulty === 'Advanced' ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
              }`}>{t.difficulty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pranayama ─────────────────────────────────────────────────────────────────

function PranayamaTab() {
  const techniques = [
    { name: 'Sama Vritti',    english: 'Box Breathing',         pattern: '4-4-4-4', rounds: 5, difficulty: 'Beginner' },
    { name: 'Nadi Shodhana',  english: 'Alternate Nostril',     pattern: 'A:4-H:16-E:8', rounds: 10, difficulty: 'Intermediate' },
    { name: 'Kapalabhati',    english: 'Skull Shining Breath',  pattern: 'rapid bellows', rounds: 3, difficulty: 'Intermediate' },
    { name: 'Bhramari',       english: 'Humming Bee Breath',    pattern: 'I:4-H:4-E:8(hum)', rounds: 7, difficulty: 'Beginner' },
    { name: 'Ujjayi',         english: 'Ocean Breath',          pattern: 'I:4-E:6', rounds: 10, difficulty: 'Beginner' },
    { name: 'Sitali',         english: 'Cooling Breath',        pattern: 'I:4-H:2-E:4', rounds: 8, difficulty: 'Beginner' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Techniques"  value="18" />
        <KpiCard label="Energising"        value="5"  sub="Kapalabhati, Bhastrika..." />
        <KpiCard label="Calming"           value="13" sub="Nadi Shodhana, Bhramari..." />
        <KpiCard label="Avg Rounds"        value="7"  sub="across all techniques" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Technique Catalog</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Sanskrit</th>
                <th className="pb-2 font-medium">English</th>
                <th className="pb-2 font-medium">Pattern</th>
                <th className="pb-2 font-medium">Rounds</th>
                <th className="pb-2 font-medium">Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {techniques.map(t => (
                <tr key={t.name} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-indigo-700">{t.name}</td>
                  <td className="py-2 text-gray-700">{t.english}</td>
                  <td className="py-2 font-mono text-xs text-gray-600">{t.pattern}</td>
                  <td className="py-2 text-center">{t.rounds}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      t.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{t.difficulty}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Meditation ────────────────────────────────────────────────────────────────

function MeditationTab() {
  const styles = [
    { style: 'Mindfulness',         sessions: 14, avgDuration: '10 min', avgPlays: 124 },
    { style: 'Yoga Nidra',          sessions: 8,  avgDuration: '30 min', avgPlays: 198 },
    { style: 'Body Scan',           sessions: 6,  avgDuration: '15 min', avgPlays: 87 },
    { style: 'Guided Visualization',sessions: 7,  avgDuration: '20 min', avgPlays: 76 },
    { style: 'Mantra',              sessions: 5,  avgDuration: '20 min', avgPlays: 65 },
    { style: 'Loving Kindness',     sessions: 4,  avgDuration: '10 min', avgPlays: 54 },
    { style: 'Chakra',              sessions: 4,  avgDuration: '25 min', avgPlays: 43 },
    { style: 'Breathing',           sessions: 3,  avgDuration: '5 min',  avgPlays: 112 },
    { style: 'Movement',            sessions: 1,  avgDuration: '10 min', avgPlays: 28 },
  ];
  const topSessions = [
    { title: 'Deep Sleep Yoga Nidra',    plays: 312, duration: '30 min' },
    { title: '10-min Morning Mindfulness',plays: 287, duration: '10 min' },
    { title: 'Stress Release Body Scan', plays: 241, duration: '15 min' },
    { title: 'Loving Kindness for Self', plays: 198, duration: '12 min' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Sessions"    value="52"   sub="9 styles" />
        <KpiCard label="Published"         value="44"   />
        <KpiCard label="Total Plays"       value="4,820" sub="this month" color="bg-indigo-50" />
        <KpiCard label="Avg Duration"      value="16 min" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Sessions by Style</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Style</th>
                <th className="pb-2 font-medium">Sessions</th>
                <th className="pb-2 font-medium">Avg Duration</th>
                <th className="pb-2 font-medium">Avg Plays</th>
              </tr>
            </thead>
            <tbody>
              {styles.map(s => (
                <tr key={s.style} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{s.style}</td>
                  <td className="py-2 font-semibold">{s.sessions}</td>
                  <td className="py-2 text-gray-500">{s.avgDuration}</td>
                  <td className="py-2 text-indigo-700 font-medium">{s.avgPlays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Most Played Sessions</h3>
        <div className="space-y-3">
          {topSessions.map((s, i) => (
            <div key={s.title} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-300">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.duration}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-indigo-700">{s.plays} plays</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const weeklySearches = [38, 52, 61, 47, 58, 74, 63];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxSearches = Math.max(...weeklySearches);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Library Searches (7d)" value="393" sub="+12% vs last week" />
        <KpiCard label="Practice Plan Saves"   value="127" sub="SAVE_TO_PLAN confirms" />
        <KpiCard label="Sequence Uses (7d)"    value="84"  sub="in live classes" />
        <KpiCard label="Contraindication Checks" value="52" sub="7-day window" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Library Searches per Day</h3>
        <div className="flex items-end gap-2 h-32">
          {weeklySearches.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-indigo-400" style={{ height: `${(v / maxSearches) * 100}%` }} />
              <span className="text-xs text-gray-500">{weekDays[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Most Searched Goals</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { goal: 'Flexibility',   pct: 28 },
            { goal: 'Stress Relief', pct: 24 },
            { goal: 'Strength',      pct: 18 },
            { goal: 'Sleep',         pct: 14 },
            { goal: 'Energy',        pct: 10 },
            { goal: 'Balance',       pct: 6 },
          ].map(g => (
            <div key={g.goal} className="rounded-lg bg-gray-50 p-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{g.goal}</span><span>{g.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${g.pct * 3}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Integrations ──────────────────────────────────────────────────────────────

const MCP_TOOLS = [
  { name: 'search_asana',             tier: 'auto',              desc: 'Pose catalog search (public)' },
  { name: 'search_meditation',        tier: 'auto',              desc: 'Meditation catalog (public)' },
  { name: 'create_asana',             tier: 'staff',             desc: 'Add pose to library' },
  { name: 'update_asana',             tier: 'staff',             desc: 'Update pose properties' },
  { name: 'create_sequence',          tier: 'staff',             desc: 'Create class sequence' },
  { name: 'create_pranayama',         tier: 'staff',             desc: 'Add breathing technique' },
  { name: 'publish_meditation',       tier: 'staff',             desc: 'Publish meditation session' },
  { name: 'save_to_practice_plan',    tier: 'customer_confirm',  desc: 'SAVE_TO_PLAN confirm required' },
  { name: 'bulk_import_library',      tier: 'staff_approval',    desc: 'Bulk import — approval + quality check' },
  { name: 'export_library_data',      tier: 'staff_approval',    desc: 'Export — verify licensing' },
  { name: 'publish_sequence_template',tier: 'admin',             desc: 'Promote to studio template' },
  { name: 'archive_asana',            tier: 'admin',             desc: 'Hide from catalog (soft delete)' },
  { name: 'delete_asana',             tier: 'admin_destructive', desc: 'DELETE_ASANA + approval' },
];

const TIER_COLOURS: Record<string, string> = {
  auto:              'bg-green-100 text-green-700',
  staff:             'bg-blue-100 text-blue-700',
  customer_confirm:  'bg-yellow-100 text-yellow-700',
  staff_approval:    'bg-orange-100 text-orange-700',
  admin:             'bg-purple-100 text-purple-700',
  admin_destructive: 'bg-red-100 text-red-700',
};

const DB_TABLES = [
  { table: 'asana',                     desc: 'Pose entity — name, difficulty, duration' },
  { table: 'asana_body_part',           desc: 'M:M — asana ↔ body part' },
  { table: 'asana_style',               desc: 'M:M — asana ↔ yoga style' },
  { table: 'asana_dosha',               desc: 'M:M — asana ↔ dosha balance' },
  { table: 'asana_contraindication',    desc: 'Per-asana conditions to avoid' },
  { table: 'asana_prop',                desc: 'Required props per asana' },
  { table: 'pranayama',                 desc: 'Breathing technique header' },
  { table: 'pranayama_ratio_step',      desc: 'Ordered phase/count steps' },
  { table: 'class_sequence',            desc: 'Sequence header — draft/published/archived' },
  { table: 'sequence_item',             desc: 'Ordered asana items with cues' },
  { table: 'meditation_session',        desc: 'Guided meditation with play count' },
  { table: 'mudra',                     desc: 'Hand/body gesture library' },
];

const REF_TABLES = [
  'ref_yoga_style', 'ref_difficulty_level', 'ref_body_part',
  'ref_dosha_type', 'ref_session_goal', 'ref_pranayama_pattern', 'ref_meditation_style',
];

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          MCP Tool Registry <span className="ml-2 text-xs text-gray-400 font-normal">13 tools — 2/5/1/2/2/1</span>
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MCP_TOOLS.map(t => (
            <div key={t.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div>
                <p className="text-xs font-mono font-semibold text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
              <span className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${TIER_COLOURS[t.tier]}`}>
                {t.tier}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Domain DB Tables</h3>
          <div className="space-y-2">
            {DB_TABLES.map(t => (
              <div key={t.table} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs font-mono font-semibold text-blue-700">{t.table}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Reference Tables</h3>
          <div className="space-y-2">
            {REF_TABLES.map(t => (
              <div key={t} className="rounded-lg bg-emerald-50 px-3 py-2">
                <p className="text-xs font-mono font-semibold text-emerald-700">{t}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">Views</p>
            <p className="text-xs text-indigo-600">v_asana_catalog — v_asana_sequence_usage — v_meditation_stats</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function YogaAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Yoga Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Wave 19 — DDD + TDD · 4 new domain models · 167 tests · table-driven + tenant-driven
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview'     && <OverviewTab />}
        {tab === 'asanas'       && <AsanasTab />}
        {tab === 'sequences'    && <SequencesTab />}
        {tab === 'pranayama'    && <PranayamaTab />}
        {tab === 'meditation'   && <MeditationTab />}
        {tab === 'analytics'    && <AnalyticsTab />}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}
