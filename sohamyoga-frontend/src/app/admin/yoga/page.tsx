'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface YogaSummary {
  totalAsanas: number;
  totalStyles: number;
  totalSequences: number;
  totalGoals: number;
  planPoses: number;
  difficultyBreakdown: Record<string, number>;
}

interface Asana {
  id: string;
  sanskrit_name: string;
  english_name: string;
  difficulty_level: string;
  duration_seconds: number | null;
  is_active: boolean;
  styles: string[];
  goals: string[];
}

interface YogaStyle {
  id: string;
  name: string;
  description?: string;
  asana_count: string | number;
}

// ── Shared UI ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Asanas', 'Yoga Styles', 'Sequences', 'Class Sequences'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

function diffColor(level: string) {
  const l = level?.toLowerCase() ?? '';
  if (l === 'beginner') return 'green';
  if (l === 'intermediate') return 'amber';
  if (l === 'advanced') return 'red';
  return 'blue';
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}

// ── Add Asana Modal ───────────────────────────────────────────────────────────

interface AddAsanaModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddAsanaModal({ onClose, onCreated }: AddAsanaModalProps) {
  const [form, setForm] = useState({
    sanskrit_name: '',
    english_name: '',
    difficulty_level: 'beginner',
    duration_seconds: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setSaving(true);
    setErr('');
    const res = await fetch('/api/admin/yoga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
      }),
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setErr(d.error ?? 'Failed to create asana');
      setSaving(false);
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add New Asana</h2>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sanskrit Name *</label>
            <input value={form.sanskrit_name} onChange={e => setForm(f => ({ ...f, sanskrit_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Tadasana" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">English Name *</label>
            <input value={form.english_name} onChange={e => setForm(f => ({ ...f, english_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Mountain Pose" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty Level *</label>
            <select value={form.difficulty_level} onChange={e => setForm(f => ({ ...f, difficulty_level: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="all_levels">All Levels</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Duration (seconds)</label>
            <input type="number" value={form.duration_seconds}
              onChange={e => setForm(f => ({ ...f, duration_seconds: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 30" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={submit} disabled={saving || !form.sanskrit_name || !form.english_name}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Asana'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ summary }: { summary: YogaSummary }) {
  const diff = summary.difficultyBreakdown;
  const totalForBar = Object.values(diff).reduce((a, b) => a + b, 0) || 1;
  const barColors: Record<string, string> = {
    beginner:     'bg-green-400',
    intermediate: 'bg-yellow-400',
    advanced:     'bg-red-400',
    all_levels:   'bg-blue-400',
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Asanas"    value={summary.totalAsanas}    />
        <KpiCard label="Yoga Styles"     value={summary.totalStyles}    />
        <KpiCard label="Class Sequences" value={summary.totalSequences} />
        <KpiCard label="Goals"           value={summary.totalGoals}     />
        <KpiCard label="Plan Poses"      value={summary.planPoses}      />
      </div>

      {Object.keys(diff).length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Asana Difficulty Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(diff).map(([level, count]) => (
              <div key={level}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="capitalize">{level.replace('_', ' ')}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full ${barColors[level] ?? 'bg-gray-400'}`}
                    style={{ width: `${(count / totalForBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Asanas Tab ────────────────────────────────────────────────────────────────

function AsanasTab() {
  const [asanas, setAsanas] = useState<Asana[]>([]);
  const [filtered, setFiltered] = useState<Asana[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/yoga?type=asanas', { cache: 'no-store' })
      .then(r => r.json() as Promise<{ asanas: Asana[] }>)
      .then(d => { setAsanas(d.asanas ?? []); setFiltered(d.asanas ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(asanas.filter(a =>
      a.sanskrit_name.toLowerCase().includes(q) ||
      a.english_name.toLowerCase().includes(q)
    ));
  }, [search, asanas]);

  async function toggleActive(a: Asana) {
    setTogglingId(a.id);
    await fetch('/api/admin/yoga', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
    });
    setAsanas(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
    setTogglingId(null);
  }

  return (
    <>
      {showModal && <AddAsanaModal onClose={() => setShowModal(false)} onCreated={load} />}
      <div className="space-y-4">
        <div className="flex gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search asanas by Sanskrit or English name…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            + Add Asana
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Loading asanas…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? `No asanas matching "${search}"` : 'No asanas in the database yet.'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => (
              <div key={a.id} className={`border rounded-xl p-4 bg-white shadow-sm ${!a.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{a.sanskrit_name}</p>
                    <p className="text-xs text-gray-500">{a.english_name}</p>
                  </div>
                  <Badge label={a.difficulty_level} color={diffColor(a.difficulty_level)} />
                </div>
                {a.styles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.styles.map(s => <Badge key={s} label={s} color="blue" />)}
                  </div>
                )}
                {a.goals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.goals.map(g => <Badge key={g} label={g} color="purple" />)}
                  </div>
                )}
                {a.duration_seconds != null && (
                  <p className="text-xs text-gray-400 mb-2">{a.duration_seconds}s hold</p>
                )}
                <button
                  onClick={() => toggleActive(a)}
                  disabled={togglingId === a.id}
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    a.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {togglingId === a.id ? '…' : a.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Yoga Styles Tab ───────────────────────────────────────────────────────────

function YogaStylesTab() {
  const [styles, setStyles] = useState<YogaStyle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/yoga?type=styles', { cache: 'no-store' })
      .then(r => r.json() as Promise<{ styles: YogaStyle[] }>)
      .then(d => setStyles(d.styles ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading styles…</div>;
  if (!styles.length) return <EmptyState message="No yoga styles found. Styles are seeded via ref_yoga_style." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {styles.map(s => (
        <div key={s.id} className="border rounded-xl p-5 bg-white shadow-sm">
          <p className="font-semibold text-gray-900">{s.name}</p>
          {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
          <p className="mt-3 text-2xl font-bold text-indigo-700">{s.asana_count}</p>
          <p className="text-xs text-gray-400">asanas</p>
        </div>
      ))}
    </div>
  );
}

// ── Sequences Tab ─────────────────────────────────────────────────────────────

function SequencesTab() {
  return (
    <div className="space-y-4">
      <EmptyState message="No class sequences yet. Sequences are stored in the class_sequence table — create your first one via the API or class scheduling module." />
      <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        Class sequences are built from <code className="bg-gray-100 px-1 rounded">class_sequence</code> and
        <code className="bg-gray-100 px-1 rounded ml-1">sequence_item</code> tables.
        Once sequences exist, this tab will display them with their asana list and duration.
      </div>
    </div>
  );
}

// ── Class Sequences Tab ───────────────────────────────────────────────────────

function ClassSequencesTab() {
  return (
    <div className="space-y-4">
      <EmptyState message="No class sequences linked to the booking system yet." />
      <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        Class sequences can be linked to bookable class types via the booking system.
        To connect sequences to the booking module, navigate to{' '}
        <strong>Admin &rarr; Bookings &rarr; Class Types</strong> and assign a sequence template.
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function YogaAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [summary, setSummary] = useState<YogaSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    fetch('/api/admin/yoga', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json() as { summary?: YogaSummary; error?: string };
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        if (d.summary) setSummary(d.summary);
      })
      .catch((e: unknown) => setSummaryError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setSummaryLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Yoga Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Asanas, yoga styles, sequences, and goals — live from database.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t
                  ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {summaryError && (
          <div className="mb-4 border border-red-200 bg-red-50 rounded-lg p-3 text-sm text-red-700">{summaryError}</div>
        )}

        {tab === 'Overview' && (
          summaryLoading
            ? <div className="text-sm text-gray-400 py-8 text-center">Loading overview…</div>
            : summary
              ? <OverviewTab summary={summary} />
              : <EmptyState message="Could not load summary." />
        )}
        {tab === 'Asanas'          && <AsanasTab />}
        {tab === 'Yoga Styles'     && <YogaStylesTab />}
        {tab === 'Sequences'       && <SequencesTab />}
        {tab === 'Class Sequences' && <ClassSequencesTab />}
      </div>
    </div>
  );
}
