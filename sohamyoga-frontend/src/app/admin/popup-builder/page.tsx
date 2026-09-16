'use client';
import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type PopupType = 'modal' | 'banner' | 'slide-in' | 'exit-intent' | 'inline';
type PopupStatus = 'draft' | 'active' | 'paused' | 'archived';
type TriggerType = 'timer' | 'scroll' | 'exit-intent' | 'click' | 'pageload';

interface Popup {
  id: number;
  name: string;
  type: PopupType;
  status: PopupStatus;
  trigger_type: TriggerType;
  trigger_value: string | null;
  target_pages: string[] | null;
  headline: string | null;
  body_text: string | null;
  cta_text: string | null;
  cta_url: string | null;
  background_color: string;
  text_color: string;
  show_once: boolean;
  show_after_close_days: number;
  impressions: number;
  clicks: number;
  closes: number;
  ctr: number;
  created_at: string;
}

interface FormState {
  name: string;
  type: PopupType;
  trigger_type: TriggerType;
  trigger_value: string;
  target_pages_raw: string;
  headline: string;
  body_text: string;
  cta_text: string;
  cta_url: string;
  background_color: string;
  text_color: string;
  show_once: boolean;
  show_after_close_days: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['live', 'all', 'create', 'analytics'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  live: 'Live Popups',
  all: 'All Popups',
  create: 'Create / Edit',
  analytics: 'Analytics',
};

const TYPE_OPTIONS: { value: PopupType; label: string; emoji: string; desc: string }[] = [
  { value: 'modal', label: 'Modal', emoji: '🪟', desc: 'Centered overlay dialog' },
  { value: 'banner', label: 'Banner', emoji: '📢', desc: 'Full-width top/bottom bar' },
  { value: 'slide-in', label: 'Slide-in', emoji: '↘️', desc: 'Corner slide-in card' },
  { value: 'exit-intent', label: 'Exit Intent', emoji: '🚪', desc: 'Shows on mouse leave' },
  { value: 'inline', label: 'Inline', emoji: '📌', desc: 'Embedded in page content' },
];

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'timer', label: 'Timer (seconds)' },
  { value: 'scroll', label: 'Scroll depth (%)' },
  { value: 'exit-intent', label: 'Exit intent' },
  { value: 'click', label: 'Click trigger' },
  { value: 'pageload', label: 'Page load' },
];

const STATUS_STYLES: Record<PopupStatus, string> = {
  active: 'bg-green-500/20 text-green-300 border border-green-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  draft: 'bg-white/10 text-white/60 border border-white/20',
  archived: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

const EMPTY_FORM: FormState = {
  name: '',
  type: 'modal',
  trigger_type: 'timer',
  trigger_value: '5',
  target_pages_raw: '',
  headline: '',
  body_text: '',
  cta_text: 'Get Started',
  cta_url: '',
  background_color: '#6366f1',
  text_color: '#ffffff',
  show_once: true,
  show_after_close_days: 7,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PopupStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

function TriggerDesc({ type, value }: { type: TriggerType; value: string | null }) {
  if (type === 'timer') return <span>After {value ?? '?'}s</span>;
  if (type === 'scroll') return <span>At {value ?? '?'}% scroll</span>;
  if (type === 'exit-intent') return <span>On exit intent</span>;
  if (type === 'click') return <span>On click</span>;
  return <span>On page load</span>;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
      <p className="text-white/60 text-sm mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}

function PopupPreview({ form }: { form: FormState }) {
  const bgStyle = { backgroundColor: form.background_color };
  const fgStyle = { color: form.text_color };

  if (form.type === 'banner') {
    return (
      <div className="rounded-lg p-3 text-sm flex items-center justify-between gap-2" style={bgStyle}>
        <span style={fgStyle} className="font-semibold truncate">{form.headline || 'Your headline here'}</span>
        {form.cta_text && (
          <button className="shrink-0 rounded px-3 py-1 text-xs font-bold border border-white/40" style={fgStyle}>
            {form.cta_text}
          </button>
        )}
      </div>
    );
  }

  if (form.type === 'slide-in') {
    return (
      <div className="rounded-xl p-4 text-sm w-56 shadow-2xl" style={bgStyle}>
        <p className="font-bold mb-1" style={fgStyle}>{form.headline || 'Your headline'}</p>
        <p className="text-xs opacity-80 mb-2" style={fgStyle}>{form.body_text || 'Body text goes here.'}</p>
        {form.cta_text && (
          <button className="rounded px-3 py-1 text-xs font-bold border border-white/40 w-full" style={fgStyle}>
            {form.cta_text}
          </button>
        )}
      </div>
    );
  }

  // modal / exit-intent / inline — centered card
  return (
    <div className="rounded-2xl p-5 text-sm max-w-xs mx-auto shadow-2xl" style={bgStyle}>
      <p className="font-bold text-base mb-2" style={fgStyle}>{form.headline || 'Your headline here'}</p>
      <p className="text-xs opacity-80 mb-3" style={fgStyle}>{form.body_text || 'Describe your offer or message here.'}</p>
      {form.cta_text && (
        <button className="rounded-lg px-4 py-2 text-xs font-bold border border-white/40 w-full" style={fgStyle}>
          {form.cta_text}
        </button>
      )}
      <p className="text-xs opacity-50 mt-2 text-center" style={fgStyle}>✕ close</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PopupBuilderPage() {
  const [tab, setTab] = useState<Tab>('live');
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // All-tab filter
  const [statusFilter, setStatusFilter] = useState<PopupStatus | 'all'>('all');

  // Create/edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPopups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/popups');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setPopups(data.popups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPopups(); }, [fetchPopups]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function startEdit(p: Popup) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      trigger_type: p.trigger_type,
      trigger_value: p.trigger_value ?? '',
      target_pages_raw: (p.target_pages ?? []).join(', '),
      headline: p.headline ?? '',
      body_text: p.body_text ?? '',
      cta_text: p.cta_text ?? '',
      cta_url: p.cta_url ?? '',
      background_color: p.background_color,
      text_color: p.text_color,
      show_once: p.show_once,
      show_after_close_days: p.show_after_close_days,
    });
    setTab('create');
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleStatusToggle(id: number, newStatus: PopupStatus) {
    try {
      const res = await fetch(`/api/admin/popups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await fetchPopups();
      showSuccess(`Popup ${newStatus}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this popup permanently?')) return;
    try {
      const res = await fetch('/api/admin/popups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchPopups();
      showSuccess('Popup deleted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(editingId !== null ? { id: editingId } : {}),
        name: form.name.trim(),
        type: form.type,
        trigger_type: form.trigger_type,
        trigger_value: form.trigger_value || null,
        target_pages: form.target_pages_raw
          ? form.target_pages_raw.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        headline: form.headline || null,
        body_text: form.body_text || null,
        cta_text: form.cta_text || null,
        cta_url: form.cta_url || null,
        background_color: form.background_color,
        text_color: form.text_color,
        show_once: form.show_once,
        show_after_close_days: form.show_after_close_days,
      };

      const res = await fetch('/api/admin/popups', {
        method: editingId !== null ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      await fetchPopups();
      showSuccess(editingId !== null ? 'Popup updated' : 'Popup created');
      resetForm();
      setTab('all');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const livePopups = popups.filter(p => p.status === 'active');
  const filteredPopups = statusFilter === 'all' ? popups : popups.filter(p => p.status === statusFilter);

  const totalImpressions = popups.reduce((a, p) => a + p.impressions, 0);
  const totalClicks = popups.reduce((a, p) => a + p.clicks, 0);
  const totalCloses = popups.reduce((a, p) => a + p.closes, 0);
  const avgCTR = popups.length > 0
    ? Math.round(popups.reduce((a, p) => a + p.ctr, 0) / popups.length * 100) / 100
    : 0;
  const top5 = [...popups].sort((a, b) => b.ctr - a.ctr).slice(0, 5);
  const maxImpressions = popups.reduce((m, p) => Math.max(m, p.impressions), 1);

  const needsTriggerValue = form.trigger_type === 'timer' || form.trigger_type === 'scroll';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Pop-up / CTA Builder 🎯</h1>
          <p className="text-white/60 mt-1">Create and manage conversion-focused overlays</p>
        </div>
        <button
          onClick={() => { resetForm(); setTab('create'); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Popup
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="float-right opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
            }`}
          >
            {TAB_LABELS[t]}
            {t === 'live' && livePopups.length > 0 && (
              <span className="ml-1.5 bg-green-500/30 text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                {livePopups.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-white/60 text-sm animate-pulse">Loading popups…</p>
      )}

      {/* ─── LIVE POPUPS ─── */}
      {tab === 'live' && !loading && (
        <div>
          {livePopups.length === 0 ? (
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-12 text-center">
              <p className="text-white/40 text-4xl mb-3">🎯</p>
              <p className="text-white/60">No active popups. Create one and set it to Active.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {livePopups.map(p => (
                <div key={p.id} className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-0.5 rounded">
                          {p.type}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm">
                    <TriggerDesc type={p.trigger_type} value={p.trigger_value} />
                    {p.target_pages && p.target_pages.length > 0 && (
                      <> · {p.target_pages.length} page{p.target_pages.length > 1 ? 's' : ''}</>
                    )}
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Impr.', value: p.impressions.toLocaleString() },
                      { label: 'Clicks', value: p.clicks.toLocaleString() },
                      { label: 'CTR%', value: `${p.ctr}%` },
                      { label: 'Closes', value: p.closes.toLocaleString() },
                    ].map(m => (
                      <div key={m.label} className="bg-white/5 rounded-lg p-2">
                        <p className="text-white/50 text-xs">{m.label}</p>
                        <p className="text-white font-bold text-sm">{m.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusToggle(p.id, 'paused')}
                      className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ALL POPUPS ─── */}
      {tab === 'all' && !loading && (
        <div className="space-y-4">
          {/* Status filter chips */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'paused', 'draft', 'archived'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && (
                  <span className="ml-1 opacity-60">
                    ({popups.filter(p => p.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Name', 'Type', 'Trigger', 'Pages', 'CTR%', 'Status', 'Created'].map(h => (
                    <th key={h} className="text-left text-white/60 font-medium px-4 py-3">{h}</th>
                  ))}
                  <th className="text-left text-white/60 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPopups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-white/40 py-10">
                      No popups match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredPopups.map(p => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-0.5 rounded">
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        <TriggerDesc type={p.trigger_type} value={p.trigger_value} />
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {p.target_pages && p.target_pages.length > 0
                          ? `${p.target_pages.length} page${p.target_pages.length > 1 ? 's' : ''}`
                          : 'All pages'}
                      </td>
                      <td className="px-4 py-3 text-white font-mono">{p.ctr}%</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-white/60">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 rounded transition-colors"
                          >
                            Edit
                          </button>
                          {p.status === 'active' ? (
                            <button
                              onClick={() => handleStatusToggle(p.id, 'paused')}
                              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs px-2 py-1 rounded transition-colors"
                            >
                              Pause
                            </button>
                          ) : p.status === 'paused' || p.status === 'draft' ? (
                            <button
                              onClick={() => handleStatusToggle(p.id, 'active')}
                              className="bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs px-2 py-1 rounded transition-colors"
                            >
                              Activate
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs px-2 py-1 rounded transition-colors"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CREATE / EDIT ─── */}
      {tab === 'create' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Form */}
          <form onSubmit={handleSubmit} className="xl:col-span-2 space-y-6">
            {editingId !== null && (
              <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-2">
                <p className="text-indigo-300 text-sm">Editing popup #{editingId}</p>
                <button type="button" onClick={resetForm} className="text-white/60 hover:text-white text-xs">
                  Cancel edit
                </button>
              </div>
            )}

            {/* Name */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Basic Info</h2>
              <div>
                <label className="block text-white/80 text-sm mb-1">Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleField('name', e.target.value)}
                  placeholder="e.g. Summer Sale Modal"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                  required
                />
              </div>
            </div>

            {/* Type */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Popup Type</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleField('type', opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      form.type === opt.value
                        ? 'bg-indigo-500/30 border-indigo-400 text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-xs opacity-60 text-center leading-tight">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Trigger</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-1">Trigger Type</label>
                  <select
                    value={form.trigger_type}
                    onChange={e => handleField('trigger_type', e.target.value as TriggerType)}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                  >
                    {TRIGGER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {needsTriggerValue && (
                  <div>
                    <label className="block text-white/80 text-sm mb-1">
                      {form.trigger_type === 'timer' ? 'Show after (seconds)' : 'Scroll depth (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.trigger_value}
                      onChange={e => handleField('trigger_value', e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Content</h2>
              <div>
                <label className="block text-white/80 text-sm mb-1">Headline</label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={e => handleField('headline', e.target.value)}
                  placeholder="Grab attention with a strong headline"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Body Text</label>
                <textarea
                  value={form.body_text}
                  onChange={e => handleField('body_text', e.target.value)}
                  rows={3}
                  placeholder="Describe your offer or message…"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={form.cta_text}
                    onChange={e => handleField('cta_text', e.target.value)}
                    placeholder="Get Started"
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-1">CTA URL</label>
                  <input
                    type="url"
                    value={form.cta_url}
                    onChange={e => handleField('cta_url', e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>

            {/* Targeting & Display */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Targeting &amp; Display</h2>
              <div>
                <label className="block text-white/80 text-sm mb-1">
                  Target Pages <span className="text-white/40 font-normal">(comma-separated paths, empty = all)</span>
                </label>
                <input
                  type="text"
                  value={form.target_pages_raw}
                  onChange={e => handleField('target_pages_raw', e.target.value)}
                  placeholder="/pricing, /classes, /contact"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.show_once}
                    onChange={e => handleField('show_once', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                </label>
                <span className="text-white/80 text-sm">Show once per visitor</span>
              </div>
              {form.show_once && (
                <div>
                  <label className="block text-white/80 text-sm mb-1">Re-show after (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.show_after_close_days}
                    onChange={e => handleField('show_after_close_days', Number(e.target.value))}
                    className="w-32 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              )}
            </div>

            {/* Colors */}
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-white font-semibold">Colors</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.background_color}
                      onChange={e => handleField('background_color', e.target.value)}
                      className="h-10 w-16 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-white/60 text-sm font-mono">{form.background_color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">Text Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.text_color}
                      onChange={e => handleField('text_color', e.target.value)}
                      className="h-10 w-16 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-white/60 text-sm font-mono">{form.text_color}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {saving ? 'Saving…' : editingId !== null ? 'Update Popup' : 'Create Popup'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Preview Panel */}
          <div className="space-y-4">
            <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl sticky top-6">
              <h2 className="text-white font-semibold mb-4">Live Preview</h2>
              <div className="bg-white/5 rounded-xl p-4 min-h-40 flex items-center justify-center">
                <PopupPreview form={form} />
              </div>
              <div className="mt-4 space-y-1 text-white/60 text-xs">
                <p>Type: <span className="text-white">{form.type}</span></p>
                <p>Trigger: <span className="text-white"><TriggerDesc type={form.trigger_type} value={form.trigger_value} /></span></p>
                <p>Pages: <span className="text-white">
                  {form.target_pages_raw ? form.target_pages_raw : 'All pages'}
                </span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ANALYTICS ─── */}
      {tab === 'analytics' && !loading && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Impressions" value={totalImpressions.toLocaleString()} />
            <MetricCard label="Total Clicks" value={totalClicks.toLocaleString()} />
            <MetricCard label="Total Closes" value={totalCloses.toLocaleString()} />
            <MetricCard label="Avg CTR" value={`${avgCTR}%`} />
          </div>

          {/* Top 5 by CTR */}
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-white font-semibold mb-4">Top 5 Popups by CTR</h2>
            {top5.length === 0 ? (
              <p className="text-white/40 text-sm">No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['#', 'Name', 'Type', 'Impressions', 'Clicks', 'CTR%', 'Status'].map(h => (
                      <th key={h} className="text-left text-white/60 font-medium px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top5.map((p, i) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 text-white/40">{i + 1}</td>
                      <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-white/80">{p.type}</td>
                      <td className="px-3 py-2 text-white/80">{p.impressions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-white/80">{p.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2 text-white font-bold">{p.ctr}%</td>
                      <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bar chart — impressions per popup */}
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-white font-semibold mb-4">Impressions by Popup</h2>
            {popups.length === 0 ? (
              <p className="text-white/40 text-sm">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {[...popups]
                  .sort((a, b) => b.impressions - a.impressions)
                  .map(p => (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/80 truncate max-w-xs">{p.name}</span>
                        <span className="text-white/60 shrink-0 ml-2">{p.impressions.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.round((p.impressions / maxImpressions) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
